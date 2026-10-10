Feature: The running system is checked against its formal specs, and every check can fail

  ADR-0054 verifies v2 in five layers with each formal spec an oracle written independently of the
  code. These scenarios cover layers 2 to 5, which belong to the running system; layer 1, `quint
  test`, runs in this repository under `deno task formal`. A check that cannot fail proves nothing,
  so each one is shown failing as well as passing.

  @REQ-OPS-007
  Scenario: A committed event the spec cannot explain is a failure
    Given a recorded run of committed events
    When an event matches no transition of the spec
    Then trace validation fails
    And an alert is raised
    And the event is not skipped as unmodelled

  @REQ-OPS-007
  Scenario: A wrongful refusal is caught from the request-handling record
    Given a request the spec says must be accepted
    When the system refused it
    Then the event store holds nothing for it
    And validation of the verification records reports the refusal as a failure

  @REQ-OPS-008
  Scenario: A rolled-back write produces no verification record
    Given a write that fails and rolls back
    When its transaction ends
    Then no verification record exists for it

  @REQ-OPS-008
  Scenario: A missing verification record is visible as a gap
    Given verification records for one entity with sequence numbers 1, 2 and 4
    When the records are validated
    Then the missing record 3 is reported

  @REQ-OPS-008
  Scenario: A verification record carries no personal data
    Given a verification record for a change to a customer's document
    Then it carries the entity, its sequence number and its version
    And it carries no name, address, email or other personal data

  @REQ-OPS-009
  Scenario: A model-based check whose broken companion passes is itself broken
    Given a model-based check and its deliberately broken companion
    When both are run against the system
    Then the check passes
    And the companion fails
    And if the companion passes the check is reported as broken, not the system as correct

  @REQ-OPS-009
  Scenario: A spec action the generator never fired is reported
    Given a model-based run of generated action sequences
    When one spec action was never exercised
    Then the run reports that action with a count of zero

  @REQ-OPS-010
  Scenario: A failing property test can be replayed from its seed
    Given a property test that fails on a generated input
    When it is re-run with the seed it reported
    Then it fails on the same input

  @REQ-OPS-011
  Scenario: A permitted divergence does not page
    Given an invoice that differs from its order for a reason in the permitted set
    When the live invariant check runs
    Then no alert is raised

  @REQ-OPS-011
  Scenario: Negative availability is a signal, not a violation
    Given a product with more units booked than held for a window
    When the live invariant check runs
    Then the shortage is reported as a shortage
    And it is not raised as a broken invariant

  @REQ-OPS-011
  Scenario: An unexplained divergence does page
    Given an invoice that differs from its order for no reason in the permitted set
    When the live invariant check runs
    Then an alert is raised
