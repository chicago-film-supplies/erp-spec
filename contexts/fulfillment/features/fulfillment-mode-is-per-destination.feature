Feature: Fulfillment mode is per destination and the collecting flags are per leg

  ADR-0011 settles OQ-003 and OQ-007: mode belongs to the destination, the collecting and returning
  flags belong to the leg. Its own consequence names the failure — one order can mix modes, counter
  pickup for one destination and delivery for another, so any read that assumes a single mode per
  order is wrong.

  Measured 2026-08-09 across all 977 orders (HOT-002): 97.2% of revenue is symmetric, and 2.77%
  sits on asymmetric combinations across 26 orders. That small share is the whole point — a read
  that assumes one mode per order is right on almost everything, and wrong on exactly the orders
  where somebody is asking.

  @REQ-FUL-003
  Scenario: One order carries two destinations with different modes
    Given an order with two destinations
    And the first destination is collected by the customer at the counter
    And the second destination is delivered by CFS
    When the order's fulfillment is read
    Then each destination reports its own mode
    And the order itself reports no single mode

  @REQ-FUL-003
  Scenario: A read that wants one mode for an order must state which destination it means
    Given an order whose destinations do not share a mode
    When a caller requests the order's fulfillment mode without naming a destination
    Then the request is refused
    And the refusal names the destinations that disagree

  @REQ-FUL-003
  Scenario: Collecting and returning are answered per leg, not per destination
    The current system stores these on the destination, which is why a leg-level actor cannot be
    reconstructed from history. Asymmetry is the case that proves the two are distinct.

    Given a destination CFS delivers to and the customer returns from
    When its legs are read
    Then the outbound leg is performed by CFS
    And the return leg is performed by the customer
    And neither leg's performer is derived from the other

  @REQ-FUL-003
  Scenario: An asymmetric destination is costed on the CFS leg alone
    Given a destination CFS delivers to and the customer returns from
    When labor cost is attributed for that destination
    Then only the outbound leg contributes a person-day
    And the customer-performed return contributes none
