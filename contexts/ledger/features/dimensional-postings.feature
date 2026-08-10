Feature: Revenue and COGS postings carry both mandatory dimensions

  ADR-0018 took dimensions off account identity and put them on the posting, which makes this
  rule the ONLY thing enforcing dimensionality. Nothing structural catches a missing dimension
  any more — there is no account whose absence would fail the write.

  Measured on the current system 2026-08-10, joined to the product master: 15.00% of line revenue
  ($253,306.59 of $1,688,980.87) carries no product line, and all of it is custom lines with no
  product master or products nobody categorised. The dimension was optional, and that is the cause.

  This paragraph read "383 of 9,197 line items — 4.16% of lines but 28.74% of revenue" until
  2026-08-10. That counted the invoice-line denorm, which was null on 227 lines whose product WAS
  categorised (api-cloudrun#473, repaired). Of the untracked population only $688.00 — 0.041% of all
  line revenue — was ever an operator declining to classify.

  ⚠️ The scenario below uses the product line "Transport", which `ledger/dimensions.yaml` currently
  does NOT declare — it was dropped 2026-08-09 on a measurement that read the wrong field, and
  whether it is restored is OQ-034. Nothing in `deno task validate` checks a .feature file's
  dimension values against the declared set (erp-spec#16), which is why this contradiction was
  invisible.

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
    5801 Cost of Goods Sold: Wages (Unabsorbed) is undimensioned BY DESIGN. If the rule above had
    no exemption, the unabsorbed posting could not be written at all — and the pressure would be to
    invent a dimension value for it, which is the failure this scenario exists to forbid.
    ADR-0025 is what makes the exemption expressible rather than special-cased: the obligation is
    read off each account's own `dimensions` list in ledger/chart-of-accounts.yaml, and 5801's is
    empty. 5800 is the only account in the chart that names `cost_type` at all.

    Given a COGS posting to <account>
    When the posting is submitted to the ledger with no cost type
    Then the posting is <outcome>

    Examples:
      | account                                    | outcome  |
      | 5800 Cost of Goods Sold: Wages (Absorbed)   | rejected |
      | 5801 Cost of Goods Sold: Wages (Unabsorbed) | recorded |
