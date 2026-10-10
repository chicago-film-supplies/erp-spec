Feature: A failure is announced by something other than the thing that failed

  The failures worth alerting on here are the quiet ones: a renderer that returns a placeholder,
  a collector that drops telemetry, a worker that stopped, a consumer that stopped confirming, a
  monitoring host that went down with everything else. Each is invisible from the inside, so every
  signal below comes from outside the thing it watches.

  @REQ-OPS-001
  Scenario: A renderer returning a placeholder is caught by an outside check
    Given the document renderer is misconfigured and returns a placeholder instead of an error
    When the renderer reports itself healthy
    Then a liveness check that does not rely on the renderer's own report fails
    And an alert is raised

  @REQ-OPS-001
  Scenario: A missing telemetry collector is caught by something other than telemetry
    Given the telemetry collector has stopped
    When no telemetry arrives
    Then the absence itself is detected by a check outside the telemetry path
    And an alert is raised

  @REQ-OPS-002
  Scenario: A scheduled job that misses its run raises an alert
    Given a scheduled job expected to run every night
    And the worker that runs it has died
    When the expected run time passes with no run recorded
    Then an alert is raised for the missed run
    And it is raised without anyone first noticing the job's missing output

  @REQ-OPS-002
  Scenario: A worker that is not running raises an alert even with nothing queued
    Given a background worker has stopped
    And its queue is empty
    When the worker's liveness signal is absent
    Then an alert is raised

  @REQ-OPS-003
  Scenario: A stopped change-feed consumer alerts before the disk fills
    Given a change-feed consumer has stopped confirming what it has read
    And the database is retaining storage on its behalf
    When retained storage grows past the alert threshold
    Then an alert is raised while there is still room to act
    And no committed change has been lost

  @REQ-OPS-004
  Scenario: A dead live-update channel is detected on the server
    Given clients are subscribed to live updates
    When the channel carrying updates to them stops delivering
    Then the server side detects the loss
    And an alert is raised even though no client reported an error

  @REQ-OPS-005
  Scenario: A shallow queue with an old job is still an alert
    Given a work queue holds a single unclaimed job
    And the queue states its tolerance for job age
    When the job's age passes that tolerance
    Then an alert is raised although the queue's depth is one

  @REQ-OPS-006
  Scenario: Losing the monitoring host still produces an alert
    Given the monitoring system runs on the host it monitors
    When that host becomes unreachable
    Then an alert is raised through a path that depends on neither the monitoring system nor the host
