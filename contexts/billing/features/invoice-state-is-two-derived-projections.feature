Feature: An invoice's lifecycle and settlement are two independently derived projections

  ADR-0022 retires `invoice.status`, which carried an assigned lifecycle fact and a derived balance
  fact in one enum — so no invariant could be stated about either half. The two v1 defect
  populations are one of each: 86 orders hold a stale denormalized status (api-cloudrun#453), and
  voided invoices still carry balances the external ledger closed (api-cloudrun#436, recorded as
  GROWING rather than historical).

  Both fields are now derived. `issued` is a fact about the ledger, not an operator's assertion
  about it.

  @REQ-BIL-002
  Scenario: Lifecycle follows the posting history, not an operator
    Given an invoice with no receivable posting
    Then its lifecycle is draft
    When a receivable posting is made for it
    Then its lifecycle is issued
    When a reversal of that posting is made
    Then its lifecycle is voided

  @REQ-BIL-002
  Scenario: No writer can assign either state
    Given an invoice whose lifecycle is draft
    When a caller attempts to set its lifecycle to issued
    Then the attempt is refused
    And the lifecycle remains draft
    And no receivable posting has been created as a side effect

  @REQ-BIL-002
  Scenario: Settlement follows the receivable balance
    Given an issued invoice for one hundred dollars
    Then its settlement is unpaid
    When forty dollars is settled against it
    Then its settlement is part_paid
    When the remaining sixty dollars is settled
    Then its settlement is paid

  @REQ-BIL-003
  Scenario: The projection is rebuildable and the rebuild is checked against the ledger
    This is the independent property. Checking a rebuild against whatever wrote the projection is a
    fixed-point check and would have certified all 86 stale rows as correct — the ledger is not the
    normalizer, which is exactly why it can disagree.

    Given a set of invoices whose stored projections have been discarded
    When the projections are rebuilt from the ledger
    Then every invoice's lifecycle and settlement are restored
    And each restored value is compared against the ledger rather than against the projector

  @REQ-BIL-003
  Scenario: A drifted projection is detected rather than trusted
    Given a stored projection that disagrees with the ledger
    When the reconciliation runs
    Then the disagreement is reported
    And the ledger is treated as authoritative
    And the count of drifted invoices is reported rather than silently corrected

  @REQ-BIL-004
  Scenario: A voided invoice cannot hold a balance
    Given an issued invoice for one hundred dollars with nothing settled
    When the invoice is voided
    Then a reversal of its receivable posting exists
    And its receivable balance is zero
    And there is no sequence of operations that leaves it voided with a non-zero balance

  @REQ-BIL-004
  Scenario: Voiding is a reversal, never a deletion
    Given an issued invoice inside an open period
    When it is voided
    Then the original posting is still present
    And a reversing posting is present alongside it
    And the invoice is still addressable by its identifier

  @REQ-BIL-005
  Scenario: An invoice paid before voiding reports both facts
    The single enum had to pick one of these and therefore lost a real fact. The pair disagreeing
    is the correct history, not a conflict to resolve.

    Given an issued invoice that has been fully settled
    When the invoice is voided
    Then its lifecycle is voided
    And its settlement is paid
    And neither value is suppressed in favour of the other

  @REQ-BIL-005
  Scenario: No precedence rule collapses the pair
    Given an invoice whose lifecycle and settlement disagree
    When its state is read
    Then both values are returned
    And no configured precedence resolves them to a single value
