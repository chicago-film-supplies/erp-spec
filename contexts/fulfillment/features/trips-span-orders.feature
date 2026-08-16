Feature: A trip is its own record and may span orders

  ADR-0011 settles OQ-002: a trip is a fulfillment-level aggregate that MAY span orders, "so it
  cannot live under one" and "is not reachable by walking down from an order". A shared van run
  serving two customers is one trip, and its travel cost must be split across the jobs that caused
  it rather than duplicated onto each or assigned arbitrarily to one.

  What is NOT specified here is the basis that divides it — `trip_travel` is one of the three pools
  erp-spec#12 records as named but not yet expressible. These scenarios oblige the trip to be
  addressable and its cost attributable; ADR-0031 owns how it splits.

  @REQ-FUL-005
  Scenario: One trip carries legs belonging to two different orders
    Given a van run that delivers to a destination on order A
    And on the same run delivers to a destination on order B
    When the trip is recorded
    Then the trip is a record in its own right
    And both legs reference the same trip
    And the trip belongs to neither order

  @REQ-FUL-005
  Scenario: A trip is not reachable by walking down from an order
    Given a trip spanning two orders
    When order A is read on its own
    Then the trip is reachable from A's legs
    And reading order A does not present the trip as A's

  @REQ-FUL-005
  Scenario: A trip's shared cost is not duplicated onto each order it served
    The failure this prevents: charging the full van run to both orders, which double-counts the
    cost and makes both jobs look worse than they are.

    Given a trip whose travel cost is one hundred dollars
    And the trip served two orders
    When travel cost is attributed
    Then the total attributed across both orders is one hundred dollars
    And neither order is charged the full amount

  @REQ-FUL-005
  Scenario: A trip serving one order is the general shape with one member
    Given a van run that serves a single order
    When the trip is recorded
    Then it is the same kind of record as a multi-order trip
    And no special case is required to cost it

  @REQ-FUL-005
  Scenario: Travel cost that cannot yet be divided is reported as unattributed
    Until a basis exists, silence is the wrong answer. ADR-0029's rule applies — the ledger records
    the unallocated fact rather than inferring a split nobody specified.

    Given a trip whose cost has no declared allocation basis
    When travel cost is attributed
    Then the cost is reported as unattributed
    And it is not spread evenly as a default
