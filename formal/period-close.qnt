// Can a posting land in a closed period?
//
// ADR-0010 / ADR-0017. A posting's period is determined by its ACCOUNTING DATE,
// not by when it is recorded — so a posting may legitimately name an earlier
// period than the current one. That is the back-dated case m5 names, and it is
// what makes this more than a trivial guard.
//
// Two modules. `period_close` re-checks the period at commit and its invariant
// must HOLD. `validate_then_commit` checks only at validation time and its
// invariant must FAIL — the classic time-of-check/time-of-use race, and the
// obvious way to implement this wrong.

module period_close {
  /// Two accounting periods is enough to express back-dating: a posting may name
  /// period 0 while period 1 is current.
  val PERIODS = Set(0, 1)
  /// No posting in flight.
  val NONE = -1

  var closedPeriods: Set[int]
  /// The period named by a posting that has passed validation but not committed.
  var pending: int
  var landed: int
  /// Set if a commit ever took effect against a period that was closed at that moment.
  var landedWhileClosed: bool

  action init = all {
    closedPeriods' = Set(), pending' = NONE, landed' = 0, landedWhileClosed' = false,
  }

  /// Validate a posting against the period its accounting date falls in. The
  /// period is chosen nondeterministically, so back-dated postings are in scope.
  /// `validateFor` / `closePeriodFor` fix the period, so the `run` tests below can name one.
  action validateFor(p: int): bool = all {
    pending == NONE,
    not(closedPeriods.contains(p)),
    pending' = p,
    closedPeriods' = closedPeriods, landed' = landed, landedWhileClosed' = landedWhileClosed,
  }
  action validate = nondet p = PERIODS.oneOf() validateFor(p)

  /// Commit, RE-CHECKING the period. The re-check is the fix; see the companion.
  action commit = all {
    pending != NONE,
    not(closedPeriods.contains(pending)),
    landed' = landed + 1,
    landedWhileClosed' = (landedWhileClosed or closedPeriods.contains(pending)),
    pending' = NONE,
    closedPeriods' = closedPeriods,
  }

  /// A posting whose period closed underneath it is refused, not silently dropped
  /// and not silently landed.
  action refuse = all {
    pending != NONE,
    closedPeriods.contains(pending),
    pending' = NONE,
    closedPeriods' = closedPeriods, landed' = landed, landedWhileClosed' = landedWhileClosed,
  }

  /// Close a period. May happen at any point, including while a posting for that
  /// period is in flight — which is the whole question.
  action closePeriodFor(p: int): bool = all {
    not(closedPeriods.contains(p)),
    closedPeriods' = closedPeriods.union(Set(p)),
    pending' = pending, landed' = landed, landedWhileClosed' = landedWhileClosed,
  }
  action closePeriod = nondet p = PERIODS.oneOf() closePeriodFor(p)

  action step = any { validate, commit, refuse, closePeriod }

  /// The question, stated directly: no posting ever took effect against a period
  /// that was closed at the moment it committed.
  val noPostingIntoClosedPeriod = not(landedWhileClosed)
  val inv = noPostingIntoClosedPeriod

  // ── `run` tests — the named cases as fixed traces, beside the random search ──
  // `quint test` runs every `run` whose name ends in `Test`. `inv` alone holds on a protocol that
  // never lands anything; these fail on that, because they require a posting to land.

  /// A back-dated posting — period 0 while period 1 is already closed — lands.
  run backdatedPostingIntoOpenPeriodLandsTest =
    init
      .then(closePeriodFor(1))
      .then(validateFor(0))
      .then(commit)
      .then(all { assert(landed == 1), assert(not(landedWhileClosed)), validateFor(0) })

  /// The race: the period closes between validate and commit. Commit is disabled…
  run commitAfterCloseIsDisabledTest =
    init
      .then(validateFor(0))
      .then(closePeriodFor(0))
      .then(commit)
      .fail()

  /// …and the posting is refused — not dropped, not landed.
  run postingWhosePeriodClosedIsRefusedTest =
    init
      .then(validateFor(0))
      .then(closePeriodFor(0))
      .then(refuse)
      .then(all {
        assert(pending == NONE),
        assert(landed == 0),
        assert(not(landedWhileClosed)),
        closePeriodFor(1),
      })

  /// A posting into an already-closed period does not pass validation.
  run validateIntoClosedPeriodIsDisabledTest =
    init
      .then(closePeriodFor(0))
      .then(validateFor(0))
      .fail()
}

/// The companion. Identical except that `commit` does NOT re-check — the period
/// was open when the posting was validated, and that is taken as sufficient.
/// Its invariant must FAIL: close the period between validate and commit.
module validate_then_commit {
  val PERIODS = Set(0, 1)
  val NONE = -1

  var closedPeriods: Set[int]
  var pending: int
  var landed: int
  var landedWhileClosed: bool

  action init = all {
    closedPeriods' = Set(), pending' = NONE, landed' = 0, landedWhileClosed' = false,
  }

  action validateFor(p: int): bool = all {
    pending == NONE,
    not(closedPeriods.contains(p)),
    pending' = p,
    closedPeriods' = closedPeriods, landed' = landed, landedWhileClosed' = landedWhileClosed,
  }
  action validate = nondet p = PERIODS.oneOf() validateFor(p)

  /// The defect: no re-check. Validation already passed, so commit proceeds.
  action commit = all {
    pending != NONE,
    landed' = landed + 1,
    landedWhileClosed' = (landedWhileClosed or closedPeriods.contains(pending)),
    pending' = NONE,
    closedPeriods' = closedPeriods,
  }

  action closePeriodFor(p: int): bool = all {
    not(closedPeriods.contains(p)),
    closedPeriods' = closedPeriods.union(Set(p)),
    pending' = pending, landed' = landed, landedWhileClosed' = landedWhileClosed,
  }
  action closePeriod = nondet p = PERIODS.oneOf() closePeriodFor(p)

  action step = any { validate, commit, closePeriod }

  val noPostingIntoClosedPeriod = not(landedWhileClosed)
  val inv = noPostingIntoClosedPeriod

  /// The defect as a fixed trace. This test PASSES: it demonstrates, deterministically, the
  /// violation the random search and Apalache find.
  run raceLandsPostingInClosedPeriodTest =
    init
      .then(validateFor(0))
      .then(closePeriodFor(0))
      .then(commit)
      .then(all { assert(landedWhileClosed), closePeriodFor(1) })
}
