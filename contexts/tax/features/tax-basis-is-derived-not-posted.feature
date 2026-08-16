Feature: The tax basis is derived at report time and never posts to the ledger

  ADR-0026: the ledger holds one book and it is GAAP. The tax basis is produced by the read side
  from one source — the fixed-asset register's per-asset tax schedule — and depreciation is the only
  legitimate difference between the two.

  Measured against CFS's real 2025 statements: the two bases differ in exactly two accounts, 7000
  Depreciation Expense and 5000 COGS Retail Inventory, summing to the net-income difference with
  zero residual and 52 of 60 P&L lines byte-identical. One of those two accounts turned out to be a
  defect nobody had noticed in three years, which is the argument for deriving rather than
  maintaining two sets by hand.

  @REQ-TAX-001
  Scenario: A tax-only depreciation election posts nothing to the ledger
    Given an asset with a Section 179 election in its tax schedule
    When the election is recorded
    Then the fixed-asset register carries the tax basis for that asset
    And no ledger transfer is created
    And the GAAP depreciation schedule for the asset is unchanged

  @REQ-TAX-001
  Scenario: A tax-basis-only account never carries a transfer
    Given the chart of accounts contains 7001 Section 179 Depreciation Expense
    When every ledger transfer is examined
    Then none of them names 7001 on either side
    And 7001 still appears on a tax-basis statement

  @REQ-TAX-001
  Scenario: A disposal posts the GAAP result only
    Given an asset whose GAAP and tax carrying amounts differ
    When the asset is disposed
    Then the ledger records the GAAP cost relief and the GAAP gain or loss
    And the register carries the tax carrying amount and the tax gain
    And no tax gain reaches the ledger

  @REQ-TAX-002
  Scenario: A tax-basis statement is the GAAP statement with the fixed-asset entries swapped
    Given a period with GAAP postings and a register tax schedule
    When a tax-basis profit and loss is produced
    Then it reads the GAAP postings
    And it excludes the GAAP fixed-asset entries
    And it includes the register's tax-basis entries in their place

  @REQ-TAX-002
  Scenario: A difference outside depreciation is reported as a defect
    This is the property the 2025 diff would have caught three years earlier. Retail inventory
    drifted 0.6% across three years and nothing flagged it, because two hand-maintained sets of
    statements can differ anywhere without either looking wrong.

    Given a period whose two bases differ in an account other than depreciation
    When the bases are compared
    Then the differing account is reported
    And it is reported as an unauthored difference rather than as a difference in basis
    And the comparison states the residual after the named differences are removed

  @REQ-TAX-002
  Scenario: The named differences leave no residual
    Given a period's GAAP and tax-basis profit and loss
    When the depreciation difference is subtracted from the net-income difference
    Then the residual is zero

  @REQ-TAX-003
  Scenario: The derivation is deterministic
    Given a period whose underlying postings and schedules are unchanged
    When the tax basis is derived twice
    Then both derivations produce identical entries
    And identical statement totals

  @REQ-TAX-003
  Scenario: The derivation is exercised by vectors including rejections
    The tax basis has no double-entry enforcement of its own — this is the only thing standing in
    for it.

    Given the tax-basis derivation
    When its vectors are run
    Then each vector states its input and its expected entries
    And at least one vector asserts an input the derivation must refuse
    And a derivation that accepts a refused input fails the run

  @REQ-TAX-004
  Scenario: Closing a period seals both bases together
    Given a period ready to close
    When the period is closed
    Then the sealed artifact carries the GAAP postings and the tax-basis entries
    And a single hash covers both
    And the close record stores that hash

  @REQ-TAX-004
  Scenario: A closed period's tax figure cannot be regenerated into a different value
    Given a closed period and a subsequently changed derivation
    When a tax-basis statement for that period is requested
    Then it is served from the sealed artifact
    And it does not change
    And its hash still matches the close record

  @REQ-TAX-005
  Scenario: A nondeductible expense is identical on both bases
    Given a period containing meals, political expenditures and vehicle tickets
    When both bases are produced
    Then each of those accounts carries the same amount on both
    And no deductibility adjustment has been applied to either

  @REQ-TAX-005
  Scenario: No return-reconciliation adjustment is derivable from the ledger
    Given a request for a permanent-difference adjustment
    When the derivation is asked to produce one
    Then it produces none
    And the reconciliation is stated to belong to the return, downstream of both bases
