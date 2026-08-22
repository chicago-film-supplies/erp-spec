// Can a MongoDB write and a TigerBeetle posting disagree across crash and retry?
//
// ADR-0003 / SPIKE-002. The protocol is: TB pending -> Mongo write -> TB post,
// or TB void if the Mongo write never landed.
//
// Two modules. `two_store_commit` is the protocol as specified and its invariant
// must HOLD. `naive_sweeper` differs in one action and its invariant must FAIL —
// an oracle that cannot fail proves nothing, so the companion is what shows the
// invariant has teeth.

module two_store_commit {
  /// TigerBeetle's view of the single transfer this protocol commits.
  type TbState = TbNone | TbPending | TbPosted | TbVoided
  /// MongoDB's view of the single document this protocol writes.
  type MongoState = MongoAbsent | MongoWritten

  var tb: TbState
  var mongo: MongoState
  /// How many times a post TOOK EFFECT. The double-post question is `<= 1`.
  var posts: int
  /// The writer process is dead. Only a retry or recovery may act.
  var dead: bool
  /// Recovery has run to completion.
  var recovered: bool

  val settled: bool = tb == TbPosted or tb == TbVoided

  action init = all {
    tb' = TbNone, mongo' = MongoAbsent, posts' = 0, dead' = false, recovered' = false,
  }

  /// 1. Reserve. TB's transfer id is the idempotency key, so this is guarded on
  /// TbNone — a retry cannot mint a second pending for the same operation.
  action reserve = all {
    not(dead), tb == TbNone,
    tb' = TbPending,
    mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }

  /// 2. Write the document.
  action writeDoc = all {
    not(dead), tb == TbPending, mongo == MongoAbsent,
    mongo' = MongoWritten,
    tb' = tb, posts' = posts, dead' = dead, recovered' = recovered,
  }

  /// 3a. Post — legal only once the document is durable.
  action post = all {
    not(dead), tb == TbPending, mongo == MongoWritten,
    tb' = TbPosted, posts' = posts + 1,
    mongo' = mongo, dead' = dead, recovered' = recovered,
  }

  /// 3b. Void — the compensation when the document never landed.
  action voidTransfer = all {
    not(dead), tb == TbPending, mongo == MongoAbsent,
    tb' = TbVoided,
    mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }

  /// The writer dies at an arbitrary point.
  action crash = all {
    not(dead),
    dead' = true,
    tb' = tb, mongo' = mongo, posts' = posts, recovered' = recovered,
  }

  /// A redelivered task resumes the same operation.
  action retry = all {
    dead,
    dead' = false,
    tb' = tb, mongo' = mongo, posts' = posts, recovered' = recovered,
  }

  /// Recovery READS MONGO and completes the operation, rather than blindly
  /// voiding on timeout. This is the load-bearing detail — see `naive_sweeper`.
  action recoverVoid = all {
    tb == TbPending, mongo == MongoAbsent,
    tb' = TbVoided, recovered' = true,
    mongo' = mongo, posts' = posts, dead' = dead,
  }

  action recoverPost = all {
    tb == TbPending, mongo == MongoWritten,
    tb' = TbPosted, posts' = posts + 1, recovered' = true,
    mongo' = mongo, dead' = dead,
  }

  action step = any {
    reserve, writeDoc, post, voidTransfer, crash, retry, recoverVoid, recoverPost,
  }

  // ── the three failure questions SPIKE-002 must rule out ──

  /// Q3. Can a retry double-post?
  val noDoublePost = posts <= 1

  /// Q2. Can a document exist with no posted transfer behind it?
  val noUnbackedDoc = (settled and mongo == MongoWritten) implies (tb == TbPosted)

  /// Q1. Can a pending transfer be orphaned? Recovery is the answer, so once it
  /// has run nothing may remain pending.
  val noOrphanedPending = recovered implies (tb != TbPending)

  val inv = noDoublePost and noUnbackedDoc and noOrphanedPending
}

/// The companion. Identical except that recovery voids on timeout WITHOUT reading
/// Mongo — the obvious implementation of "a pending transfer times out". Its
/// invariant must FAIL: a document that landed just before the timeout is left
/// backed by a voided transfer, which is failure mode 2 exactly.
module naive_sweeper {
  type TbState = TbNone | TbPending | TbPosted | TbVoided
  type MongoState = MongoAbsent | MongoWritten

  var tb: TbState
  var mongo: MongoState
  var posts: int
  var dead: bool
  var recovered: bool

  val settled: bool = tb == TbPosted or tb == TbVoided

  action init = all {
    tb' = TbNone, mongo' = MongoAbsent, posts' = 0, dead' = false, recovered' = false,
  }
  action reserve = all {
    not(dead), tb == TbNone,
    tb' = TbPending, mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }
  action writeDoc = all {
    not(dead), tb == TbPending, mongo == MongoAbsent,
    mongo' = MongoWritten, tb' = tb, posts' = posts, dead' = dead, recovered' = recovered,
  }
  action post = all {
    not(dead), tb == TbPending, mongo == MongoWritten,
    tb' = TbPosted, posts' = posts + 1, mongo' = mongo, dead' = dead, recovered' = recovered,
  }
  action crash = all {
    not(dead), dead' = true,
    tb' = tb, mongo' = mongo, posts' = posts, recovered' = recovered,
  }
  /// The defect: voids any pending transfer, without consulting Mongo.
  action blindTimeout = all {
    tb == TbPending,
    tb' = TbVoided, recovered' = true,
    mongo' = mongo, posts' = posts, dead' = dead,
  }

  action step = any { reserve, writeDoc, post, crash, blindTimeout }

  val noUnbackedDoc = (settled and mongo == MongoWritten) implies (tb == TbPosted)
  val inv = noUnbackedDoc
}

/// The SECOND companion, added 2026-08-22, and it is not a strawman — it is the
/// protocol as specified PLUS TigerBeetle's own `Transfer.timeout`.
///
/// `pending_transfer_expired = 35` is a real result code in `tigerbeetle-node@0.17.9`'s
/// `bindings.d.ts`, and the docs are explicit: "A pending transfer may optionally be
/// created with a timeout. If the timeout interval passes before the transfer is either
/// posted or voided, the transfer expires and the full amount is returned to the
/// original account." TigerBeetle does this ITSELF, consults nothing, and cannot be
/// asked not to once `timeout > 0`.
///
/// ⚠️ The first companion, `naive_sweeper`, models a recovery process that voids on
/// timeout without reading Mongo, and proves it unsafe. **TigerBeetle's built-in expiry
/// IS that process** — it is blind by construction. So this module asks whether the
/// protocol survives when the blind sweeper is the DATABASE rather than our code.
///
/// Its invariant must FAIL. If it ever passes, this module is broken, not the protocol.
module expiring_timeout {
  type TbState = TbNone | TbPending | TbPosted | TbVoided | TbExpired
  type MongoState = MongoAbsent | MongoWritten

  var tb: TbState
  var mongo: MongoState
  var posts: int
  var dead: bool
  var recovered: bool

  /// TbExpired settles the transfer as surely as a void: the funds are released and
  /// the pending transfer can never be posted again.
  val settled: bool = tb == TbPosted or tb == TbVoided or tb == TbExpired

  action init = all {
    tb' = TbNone, mongo' = MongoAbsent, posts' = 0, dead' = false, recovered' = false,
  }
  action reserve = all {
    not(dead), tb == TbNone,
    tb' = TbPending, mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }
  action writeDoc = all {
    not(dead), tb == TbPending, mongo == MongoAbsent,
    mongo' = MongoWritten, tb' = tb, posts' = posts, dead' = dead, recovered' = recovered,
  }
  action post = all {
    not(dead), tb == TbPending, mongo == MongoWritten,
    tb' = TbPosted, posts' = posts + 1, mongo' = mongo, dead' = dead, recovered' = recovered,
  }
  action voidTransfer = all {
    not(dead), tb == TbPending, mongo == MongoAbsent,
    tb' = TbVoided, mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }
  action crash = all {
    not(dead), dead' = true,
    tb' = tb, mongo' = mongo, posts' = posts, recovered' = recovered,
  }
  action retry = all {
    dead, dead' = false,
    tb' = tb, mongo' = mongo, posts' = posts, recovered' = recovered,
  }
  /// Recovery reads Mongo — the protocol's own load-bearing detail, unchanged.
  action recoverVoid = all {
    tb == TbPending, mongo == MongoAbsent,
    tb' = TbVoided, recovered' = true, mongo' = mongo, posts' = posts, dead' = dead,
  }
  /// ⚠️ Guarded on TbPending, and that guard is the whole finding: once TigerBeetle has
  /// expired the transfer, recovery CANNOT post it. `pending_transfer_expired` is what
  /// the real client returns, so this action simply does not fire.
  action recoverPost = all {
    tb == TbPending, mongo == MongoWritten,
    tb' = TbPosted, posts' = posts + 1, recovered' = true, mongo' = mongo, dead' = dead,
  }
  /// The database expires the pending transfer on its own. Not guarded on `dead`,
  /// because TigerBeetle does not know or care whether our writer is alive.
  action expire = all {
    tb == TbPending,
    tb' = TbExpired, mongo' = mongo, posts' = posts, dead' = dead, recovered' = recovered,
  }

  action step = any {
    reserve, writeDoc, post, voidTransfer, crash, retry, recoverVoid, recoverPost, expire,
  }

  val noUnbackedDoc = (settled and mongo == MongoWritten) implies (tb == TbPosted)
  val inv = noUnbackedDoc
}
