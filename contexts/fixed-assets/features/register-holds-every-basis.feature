Feature: The register carries every basis, runs as a batch, and can answer for a closed period

  ADR-0007 brings the asset register in-house with a GAAP and a tax basis per asset, because leaving
  it in a hosted tool means depreciation arrives as a journal to be re-keyed — the pattern the
  rebuild exists to eliminate.

  ⚠️ SPIKE-005 IS OPEN, and nothing below asserts a depreciation amount. Conventions, class lives,
  §179 and bonus effects, partial disposals and prospective revisions are all the spike's, and
  `depreciation_run` stays a blocked posting rule until it closes. These scenarios exercise what the
  register HOLDS, what a run PRODUCES, and what stays REPRODUCIBLE.

  @REQ-FA-001
  Scenario: An asset with a basis in only one book is refused
    Given an asset with a GAAP basis and no tax basis
    When it is recorded in the register
    Then the record is refused
    And the refusal names the missing book

  @REQ-FA-001
  Scenario: A missing basis is never read as zero
    An asset fully expensed under Section 179 legitimately has a tax carrying amount of zero. An
    asset whose tax basis nobody entered also reads as zero. One of those is a filing position.

    Given an asset whose tax basis was never entered
    When the tax carrying amount is requested
    Then the request does not return zero
    And it reports the basis as absent

  @REQ-FA-001
  Scenario: An asset expensed to zero on one book still carries the other
    Given an asset fully expensed in year one on the tax basis
    When the asset is read
    Then its tax carrying amount is zero
    And its GAAP carrying amount is unchanged by that election
    And both are present

  @REQ-FA-002
  Scenario: Acquisition and in-service dates are retained separately
    Given an asset acquired in March and placed in service in September
    When the asset is read
    Then both dates are present
    And they are not equal
    And neither has been derived from the other

  @REQ-FA-003
  Scenario: A run posts once and remains decomposable per asset
    Given a register containing several hundred assets
    When a depreciation run is performed for a period
    Then the run posts as one batch
    And every asset in the run has its own recorded amount
    And each recorded amount names the asset and the book it belongs to

  @REQ-FA-003
  Scenario: The batch total equals the sum of its parts
    This is the independent property — it compares two recorded numbers and consults nothing that
    computed either.

    Given a completed depreciation run
    When the posted batch total is compared with the sum of the per-asset amounts
    Then the two are equal

  @REQ-FA-003
  Scenario: A run that cannot record a per-asset trail does not post
    Given a depreciation run that fails partway through recording per-asset amounts
    When the run completes
    Then no batch total has been posted
    And the period is unchanged

  @REQ-FA-004
  Scenario: The register answers for a period that has already closed
    Given a period that was closed three years ago
    When that period's depreciation schedule is requested
    Then the register reproduces the schedule it held then
    And the reproduction is not recomputed from today's asset attributes

  @REQ-FA-004
  Scenario: A prospective revision does not restate a filed period
    Given an asset whose remaining useful life is revised
    When schedules are requested for a period filed before the revision
    Then those schedules are unchanged
    And schedules for later periods reflect the revision

  @REQ-FA-005
  Scenario: A disposal records a result on every book
    Given an asset with a tax carrying amount of zero and a GAAP carrying amount of four hundred
    When it is disposed for five hundred
    Then the tax result is a gain of five hundred
    And the GAAP result is a gain of one hundred
    And neither has been derived from the other

  @REQ-FA-005
  Scenario: Only the GAAP result reaches the ledger
    Given a disposal recorded on both bases
    When the ledger is examined
    Then it carries the GAAP cost relief and the GAAP gain
    And it carries no tax-basis value
    And the tax result is available from the register
