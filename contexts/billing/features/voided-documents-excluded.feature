Feature: Voided source documents are excluded from default aggregates

  Verified 2026-08-08: 41 of 999 invoices are void, carrying 477 line items worth $69,769.66, and
  nothing filters them by default. They contaminated the untracked-revenue measurement on the day
  it was taken — which is the point. An exclusion that must be remembered will be forgotten, so
  the default must be exclusion and inclusion must be the thing you type.

  @REQ-BIL-001
  Scenario: A revenue aggregate excludes voided invoices by default
    Given 999 invoices exist
    And 41 of them are void
    When total revenue is aggregated with no filter specified
    Then the 41 void invoices are excluded
    And their 477 line items contribute nothing to the total

  @REQ-BIL-001
  Scenario: Including voided documents requires an explicit opt-in
    Given voided invoices exist
    When an aggregate is requested with an explicit include-voided opt-in
    Then the voided invoices are included
    And the result is labelled as including voided documents

  @REQ-BIL-001
  Scenario: The default cannot be changed by configuration
    Given a caller that specifies no void filter
    When the aggregate runs
    Then voided documents are excluded
    And no setting, environment or role can make inclusion the default

  @REQ-BIL-001
  Scenario: Voiding a document already inside a closed period does not restate the period
    ADR-0017 makes a closed period's Parquet artifact immutable and hashed. A void arriving after
    close must therefore appear as a reversing entry in an open period, not as a silent change to
    a sealed one.

    Given an invoice posted inside a period that is now closed
    When the invoice is voided
    Then the closed period's artifact is unchanged
    And its hash still matches the close record
    And the reversal is posted with an accounting date in an open period

  @REQ-BIL-001
  Scenario: A voided document is still addressable
    The no-hard-deletes fence means void is a state, not a removal. An aggregate that excludes it
    must not be confused with a query that cannot find it.

    Given a voided invoice
    When it is fetched by its identifier
    Then it is returned
    And it is marked void
