Feature: A jurisdiction is a registration, and a stored one records who asserted it

  ADR-0045, ruled by the owner 2026-08-23. CFS is registered to collect in a handful of Illinois
  jurisdictions. A delivery outside every one of them carries no obligation; a delivery into one
  carries that one; everything else in Illinois sources to the selling location.

  The framing is the substance. A customer collection is a DETERMINATION — the buyer's location is
  the seller's counter — and the answer asserts only that CFS is REGISTERED there, never that the
  property is used there. That distinction is the whole subject of the Chicago lease transaction
  tax, whose predicate is use rather than delivery.

  What a derivation cannot reproduce is who asserted a departure from it, and under what authority.
  A coordinator holds project access and not organization access, and at a large customer no contact
  holds organization access at all — so an organization-level value is CFS's own default while a
  project-level one is the customer's representation.

  @REQ-TAX-006
  Scenario: A delivery outside every registered jurisdiction carries no obligation
    Given a destination whose address resolves to a state CFS is not registered in
    When the jurisdiction is resolved for that destination
    Then the result is the explicit no-obligation answer
    And no tax is applied to any line addressed to that destination

  @REQ-TAX-006
  Scenario: A delivery into a registered jurisdiction carries that jurisdiction
    Given a destination whose address resolves to a jurisdiction CFS is registered in
    When the jurisdiction is resolved for that destination
    Then the result is that jurisdiction

  @REQ-TAX-006
  Scenario: A delivery elsewhere in the state sources to the selling location
    Given a destination in the same state as the selling location
    And its municipality is not one CFS is registered in
    When the jurisdiction is resolved for that destination
    Then the result is the selling location's own jurisdiction
    And the result does not name a municipality that was never registered

  @REQ-TAX-006
  Scenario: The selling location's jurisdiction is a property of the location, not a constant
    Given the selling location's jurisdiction is changed
    When a destination that sources to the selling location is resolved
    Then the result follows the changed location
    And no jurisdiction literal is embedded in the rule

  @REQ-TAX-007
  Scenario: An attested statement of intended use overrides the derived jurisdiction
    Given a destination that derives to the selling location's jurisdiction
    And the customer has attested exclusive use in a different registered jurisdiction
    When the jurisdiction is resolved for that destination
    Then the result is the attested jurisdiction

  @REQ-TAX-007
  Scenario: An override may not name a jurisdiction CFS is not registered in
    Given a jurisdiction CFS has retired
    When an override to that jurisdiction is attempted
    Then the override is refused
    And a document already storing it still resolves and still renders

  @REQ-TAX-007
  Scenario: An override may name the explicit no-obligation answer
    Given a customer attests exclusive use outside every registered jurisdiction
    When an override to the no-obligation answer is recorded
    Then the override is accepted
    And no tax is applied to the lines it governs

  @REQ-TAX-008
  Scenario: An organization jurisdiction initializes a new document and nothing else
    Given an organization carrying a jurisdiction
    When an order is created for that organization
    Then the order's own destination carries that jurisdiction
    And the resolution consults the order's stored value alone

  @REQ-TAX-008
  Scenario: Changing an organization's jurisdiction does not restate an existing document
    Given an order created while its organization carried one jurisdiction
    When the organization's jurisdiction is changed
    And the order is repriced
    Then the order still resolves to the jurisdiction it was created with

  @REQ-TAX-008
  Scenario: An absent stored jurisdiction means the value was derived
    Given a document whose destination carries no stored jurisdiction
    When the jurisdiction is resolved
    Then the result is the derived answer
    And the absence is not read as an instruction to consult another record

  @REQ-TAX-009
  Scenario: An override records its asserter and their authority
    Given a customer attests exclusive use for one project
    When the override is recorded
    Then the record names the party who asserted it
    And the record names the tree level their authority reached
    And the record does not name which rung of the precedence supplied the value

  @REQ-TAX-009
  Scenario: An organization-level and a project-level assertion are distinguishable
    Given two documents resolving to the same jurisdiction
    And one was initialized from an organization-level value
    And the other carries a project-level attestation
    When each record is examined
    Then the two are distinguishable by the authority recorded against them

  @REQ-TAX-010
  Scenario: A correction is a new assertion at the document level
    Given a document whose stored jurisdiction is wrong
    And the document carries no payment
    When a corrected jurisdiction is asserted on it
    Then the document resolves to the corrected jurisdiction
    And the correction uses the same override the original assertion used

  @REQ-TAX-010
  Scenario: A paid document refuses a jurisdiction correction
    Given a document carrying a payment
    When a corrected jurisdiction is asserted on it
    Then the correction is refused
    And the document's billed amount is unchanged

  @REQ-TAX-011
  Scenario: An item CFS consumes sources to the location that supplied it
    Given a line for an item CFS itself consumes
    And the document is addressed to a destination in another registered jurisdiction
    When the jurisdiction is resolved for that line
    Then the result is the jurisdiction of the CFS location that supplied it

  @REQ-TAX-011
  Scenario: A customer assertion does not reach a line CFS consumes
    Given a customer has attested exclusive use in another jurisdiction
    And a line for an item CFS itself consumes
    When the jurisdiction is resolved for that line
    Then the attestation does not change the result
