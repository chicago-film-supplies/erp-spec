Feature: A posting declares every key its rule names, and no other

  ADR-0036 supersedes ADR-0018: a posting records KEYS — causal order(s), invoice link, line
  identity — and never a classification. A product line is `products.uid_tracking_category`, a
  mutable field on a mutable master that moved twice in one month, and freezing it into an immutable
  transfer is the defect whichever field holds it. Every classification is derived at report time.

  The obligation is READ OFF THE POSTING RULE in ledger/posting-rules.yaml, never off the account
  and never inferred from a class. Which keys a posting owes is a property of what happened, not of
  where it landed: `settlement_recorded` credits 1200 and names an invoice, `credit_note_issued`
  debits a revenue account and deliberately does not — because a note is issued against a settlement
  point and attached to no invoice until it is allocated (ADR-0033).

  ⚠️ THIS FILE WAS `dimensional-postings.feature` UNTIL 2026-08-16, and every scenario in it
  asserted a dimension. The rule it exercises did not change shape — what is refused is still
  ABSENCE rather than null, and a declared null is still a determination someone can be asked about.
  What changed is the subject, and ADR-0036 says the new one is stronger: a category can defensibly
  be absent from a document that never had one, while a posting with no causal order is
  unallocatable.

  ⚠️ AND THE NULL ARM IS NOT HYPOTHETICAL. 30 of 1,010 issued invoices carry no `order` divider at
  all — 87 revenue-bearing lines worth $87,839.76, with 0 of 30 referencing an order and 30 of 30
  carrying a `crms_id`. They are legacy CRMS imports. Refusing them outright would make 30
  historical invoices unpostable, which ADR-0020's "the restatement must not alter any amount"
  forbids. Owner, 2026-08-16: "we can allow source order null."

  Every scenario below names its POSTING RULE, and validate gate 10p checks the keys it asserts
  against what that rule declares — the applicability check erp-spec#20 asked for and could not have
  while the join target was the chart's `dimensions:` lists, which ADR-0036 deletes. Gate 10n
  checks that the rule and any account named resolve at all. ⚠️ Three scenarios said "a revenue
  posting to a dimensioned account" before this rewrite, which named a class and gave the check
  nothing to join to; none does now.

  @REQ-LED-001
  Scenario: A revenue posting carries the causal order, the invoice and the line
    Given a posting under the rule invoice_issued
    And the posting carries the causal order "ORD-VEC-0001"
    And the posting carries the invoice "INV-VEC-0001"
    And the posting carries the line "ORD-VEC-0001/DEST-VEC-0001/GRP-VEC-0001/ITEM-VEC-0001"
    When the posting is submitted to the ledger
    Then the posting is recorded
    And its balance is reportable sliced by product line

  @REQ-LED-001
  Scenario: One key serves all three, because the line's path begins with its causal order
    INVOICE_ITEM_LEVELS is [order, destination, group] against ORDER_ITEM_LEVELS's
    [destination, group], so an invoice item's path is the order item's path prefixed by an order
    divider and path[0] IS the causal order. That is the economy ADR-0036 turns on, and the owner
    ruled on 2026-08-16 that v1 may re-base order paths to match invoice paths (api-cloudrun#538),
    which turns "where the two agree" from a conditional into an invariant.

    Given a posting under the rule invoice_issued
    And the posting carries the line "ORD-VEC-0001/DEST-VEC-0001/GRP-VEC-0001/ITEM-VEC-0001"
    When the posting is submitted to the ledger
    Then the causal order is read from the first segment of the line
    And no separate causal-order reference is stored

  @REQ-LED-001
  Scenario: A posting missing its causal order is rejected
    Given a posting under the rule invoice_issued
    And the posting carries no causal order
    When the posting is submitted to the ledger
    Then the posting is rejected
    And nothing is recorded
    And the rejection names the missing key

  @REQ-LED-001
  Scenario: A declared null causal order is recorded
    Given a posting under the rule invoice_issued
    And the posting declares its causal order as null
    When the posting is submitted to the ledger
    Then the posting is recorded
    And the posting is counted in the population with no causal order

  @REQ-LED-001
  Scenario: An empty causal-order list is rejected
    The plural key's equivalent of the empty string. It satisfies a naive presence check while
    stating nothing, so it is refused alongside absence rather than treated as a null.

    Given a posting under the rule invoice_issued
    And the posting declares its causal order as an empty list
    When the posting is submitted to the ledger
    Then the posting is rejected
    And no placeholder or default key value is written in its place

  @REQ-LED-001
  Scenario: A posting carrying a key its rule does not name is rejected
    Presence of an unowed key is refused, not merely pointless. erp-spec#20 recorded this as
    "genuinely undecided"; it was already enforced when that was written — gate 10h has refused it
    on every golden vector, and was fired red against a vendor_bill_received vector on 2026-08-16.

    Given a posting under the rule credit_note_issued
    And the posting carries the unowed invoice "INV-VEC-1767"
    When the posting is submitted to the ledger
    Then the posting is rejected
    And the rejection names the key the rule does not carry

  @REQ-LED-001
  Scenario Outline: Labor no order caused is the one posting whose causal order is always null
    ADR-0019 and ADR-0038: a paid day no order caused is a real cost attributable to no job, and it
    is an OPERATING EXPENSE rather than cost of sales — it debits 6600 Wages, and its posting
    declares `causal_orders: null` — DECLARED, not omitted, so "hours attributable to no job" stays a
    countable population. If the rule had no null arm the unabsorbed posting could not be written at
    all, and the pressure would be to attach it to a job, which is the failure this scenario exists
    to forbid. The absorbed leg has no null arm for the mirror-image reason: absorbed means "into a
    job", so hours belonging to none are unabsorbed by definition.

    This outline named 5801 Cost of Goods Sold: Wages (Unabsorbed) until 2026-08-17. ADR-0038
    removed that account — where no order caused the hire there is no revenue the cost is applicable
    to — and the rule now debits 6600. The key obligation is unchanged, which is the point: it was
    never a property of the account.

    Given a posting under the rule shift_recorded to <account>
    When the posting declares its causal order as <declaration>
    Then the posting is <outcome>

    Examples:
      | account                                     | declaration   | outcome  |
      | 5800 Cost of Goods Sold: Wages (Absorbed)   | a causal job  | recorded |
      | 5800 Cost of Goods Sold: Wages (Absorbed)   | null          | rejected |
      | 5800 Cost of Goods Sold: Wages (Absorbed)   | nothing at all| rejected |
      | 6600 Wages                                  | null          | recorded |
      | 6600 Wages                                  | a causal job  | rejected |
      | 6600 Wages                                  | nothing at all| rejected |
