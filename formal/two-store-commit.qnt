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
