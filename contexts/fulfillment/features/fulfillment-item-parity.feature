Feature: A fulfillment's items stay in parity with its order's

  ADR-0011 names this "the constraint most likely to be broken by giving legs their own lifecycle".
  First-class legs must not become a second, divergent copy of the order's items.

  The verification is the interesting part, and it is why these scenarios are shaped the way they
  are. "The fulfillment's items equal what the recompute produces" is a FIXED-POINT check — it is
  defined in terms of the normalizer and can therefore only ever agree with it. That is exactly how
  79 provably-wrong invoice items were certified clean corpus-wide until 2026-07-28. So every
  scenario below asserts a property that holds WITHOUT consulting the normalizer.

  @REQ-FUL-004
  Scenario: A leg references order items rather than copying them
    Given an order with three items
    And a leg that moves two of them
    When the leg is read
    Then it names the two order items it moves
    And it holds no independently editable copy of their quantities or prices

  @REQ-FUL-004
  Scenario: Removing an item from an order cannot leave a leg pointing at nothing
    Given an order item that a recorded leg references
    When the item is removed from the order
    Then the removal is refused while the leg references it
    And the refusal names the leg

  @REQ-FUL-004
  Scenario: Every fulfilled item traces to an item still on the order
    This is the independent property. It consults the ORDER, not the path normalizer, so it can
    disagree with the normalizer — which is the only way it can catch the normalizer being wrong.

    Given a fulfillment with any number of items
    When each fulfilled item is looked up on its order
    Then every one of them is found
    And no fulfilled item exists that the order does not carry

  @REQ-FUL-004
  Scenario: Fulfilled quantity never exceeds ordered quantity for the same item
    A second property that holds independently: it compares two recorded numbers rather than
    recomputing either.

    Given an order item with a quantity of ten
    And legs that have moved four and then five of it
    When one more leg attempts to move two
    Then the attempt is refused
    And the refusal states that one remains

  @REQ-FUL-004
  Scenario: A divergent copy is detectable without recomputing paths
    Given a fulfillment whose stored item list disagrees with its order
    When the parity check runs
    Then the disagreement is reported
    And it is reported by comparing against the order rather than against a recomputed list
