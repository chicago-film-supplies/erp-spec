Feature: Revenue and COGS postings carry both mandatory dimensions

  ADR-0018 took dimensions off account identity and put them on the posting, which makes this
  rule the ONLY thing enforcing dimensionality. Nothing structural catches a missing dimension
  any more — there is no account whose absence would fail the write.

  Measured on the current system 2026-08-09: 383 of 9,197 invoice line items carry no product
  line — 4.16% of lines but 28.74% of revenue ($485,821.72 of $1,689,895.68). The dimension was
  optional, and that is the entire cause.

  @REQ-LED-001
  Scenario: A revenue posting carrying both dimensions is recorded
    Given a revenue posting to a dimensioned account
    And the posting carries the product line "Transport"
    And the posting carries the cost type "delivery"
    When the posting is submitted to the ledger
    Then the posting is recorded
    And its balance is reportable sliced by product line

  @REQ-LED-001
  Scenario: A revenue posting missing the product line is rejected
    Given a revenue posting to a dimensioned account
    And the posting carries no product line
    When the posting is submitted to the ledger
    Then the posting is rejected
    And nothing is recorded
    And the rejection names the missing dimension

  @REQ-LED-001
  Scenario: A COGS posting missing the cost type is rejected
    Given a COGS posting to a dimensioned account
    And the posting carries the product line "Crew"
    And the posting carries no cost type
    When the posting is submitted to the ledger
    Then the posting is rejected
    And nothing is recorded

  @REQ-LED-001
  Scenario: Rejection is refusal, not substitution
    Given a revenue posting carrying no product line
    When the posting is submitted to the ledger
    Then the posting is rejected
    And no placeholder or default dimension value is written in its place

  @REQ-LED-001
  Scenario Outline: Unabsorbed labour is the one posting exempt from the cost-type rule
    ADR-0019: guaranteed-but-unworked hours are a real cost attributable to no job, so
    COGS-Unabsorbed Labour is undimensioned BY DESIGN. If the rule above had no exemption, the
    unabsorbed posting could not be written at all — and the pressure would be to invent a
    dimension value for it, which is the failure this scenario exists to forbid.

    Given a COGS posting to <account>
    When the posting is submitted to the ledger with no cost type
    Then the posting is <outcome>

    Examples:
      | account                 | outcome  |
      | COGS-Labour Absorbed    | rejected |
      | COGS-Unabsorbed Labour  | recorded |
