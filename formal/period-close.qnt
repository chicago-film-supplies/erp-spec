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
  action validate =
    nondet p = PERIODS.oneOf()
    all {
      pending == NONE,
      not(closedPeriods.contains(p)),
      pending' = p,
      closedPeriods' = closedPeriods, landed' = landed, landedWhileClosed' = landedWhileClosed,
    }

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
  action closePeriod =
    nondet p = PERIODS.oneOf()
    all {
      not(closedPeriods.contains(p)),
      closedPeriods' = closedPeriods.union(Set(p)),
      pending' = pending, landed' = landed, landedWhileClosed' = landedWhileClosed,
    }

  action step = any { validate, commit, refuse, closePeriod }

  /// The question, stated directly: no posting ever took effect against a period
  /// that was closed at the moment it committed.
  val noPostingIntoClosedPeriod = not(landedWhileClosed)
  val inv = noPostingIntoClosedPeriod
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

  action validate =
    nondet p = PERIODS.oneOf()
    all {
      pending == NONE,
      not(closedPeriods.contains(p)),
      pending' = p,
      closedPeriods' = closedPeriods, landed' = landed, landedWhileClosed' = landedWhileClosed,
    }

  /// The defect: no re-check. Validation already passed, so commit proceeds.
  action commit = all {
    pending != NONE,
    landed' = landed + 1,
    landedWhileClosed' = (landedWhileClosed or closedPeriods.contains(pending)),
    pending' = NONE,
    closedPeriods' = closedPeriods,
  }

  action closePeriod =
    nondet p = PERIODS.oneOf()
    all {
      not(closedPeriods.contains(p)),
      closedPeriods' = closedPeriods.union(Set(p)),
      pending' = pending, landed' = landed, landedWhileClosed' = landedWhileClosed,
    }

  action step = any { validate, commit, closePeriod }

  val noPostingIntoClosedPeriod = not(landedWhileClosed)
  val inv = noPostingIntoClosedPeriod
}
