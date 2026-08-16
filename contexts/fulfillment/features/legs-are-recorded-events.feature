Feature: A fulfillment leg is a recorded event, and an unrecorded one is visible as such

  ADR-0011 makes legs first-class because a derived leg cannot carry an actor, a clock-in or a
  shift — and without those there is no basis for charging a crew-day to the job that caused it.
  Verified 2026-08-08: today's flags live on the DESTINATION, so the current corpus contains no
  leg-level actor or shift anywhere and none can be reconstructed.

  The second half of this file is the harder half. A leg that nobody recorded and a leg that never
  happened are both empty, and only one of them is correct.

  @REQ-FUL-001
  Scenario: A recorded leg carries its actor, its clock and its shift
    Given a delivery leg has been performed by a crew member
    When the leg is recorded
    Then the leg has its own identity
    And it names the crew member who performed it
    And it carries a clock-in time and a clock-out time
    And it names the shift the crew member was working

  @REQ-FUL-001
  Scenario: A leg is never inferred from an order's flags
    An inferred leg is indistinguishable from a recorded one once written, which is how a costing
    model ends up charging person-days nobody worked.

    Given an order whose destination is marked as CFS-delivered
    And no leg has been recorded against it
    When fulfillment legs for the order are read
    Then no leg is returned
    And no leg is synthesised from the destination's flags

  @REQ-FUL-001
  Scenario: A leg records the crew member even when the leg carries no labour cost
    Given a leg performed by a crew member on an unpaid shift
    When the leg is recorded
    Then it still names the crew member who performed it
    And the absence of labour cost is a property of the shift, not of the leg

  @REQ-FUL-002
  Scenario: A leg that did not occur is distinguishable from one that was not recorded
    Given a destination the customer collects from and returns to themselves
    And a destination CFS delivered to, whose leg nobody recorded
    When the two destinations are examined
    Then the customer-collected destination reports that no CFS leg occurs
    And the delivered destination reports a leg that is missing
    And the two are not reported by the same value

  @REQ-FUL-002
  Scenario: Costing reports its unrecorded population rather than treating it as zero
    Without this, absorption silently improves as capture degrades — fewer recorded legs means
    fewer person-days charged to jobs, which reads as better margin. The number has to be on the
    face of the report, not discoverable by going looking.

    Given a period in which some performed legs were never recorded
    When labour costing is run for that period
    Then the result states how many expected legs have no record
    And that count is reported alongside the absorbed and unabsorbed totals
    And the costing is not presented as complete

  @REQ-FUL-002
  Scenario: An unrecorded leg cannot be closed by a default
    Given a leg that was performed but never recorded
    When the period is prepared for close
    Then no actor, clock or shift is defaulted onto it
    And the leg remains reported as unrecorded
