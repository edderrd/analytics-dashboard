# Implements: backend/src/common/dates/local-date.spec.ts, backend/src/common/dates/account-time.spec.ts, backend/src/modules/comparisons/domain/comparison-periods.spec.ts, backend/test/account-comparison.e2e-spec.ts, backend/test/edge-cases.e2e-spec.ts, backend/src/testing/spec-coherence.spec.ts

Feature: Comparison periods and account-local boundaries
  As a customer reading the dashboard
  I need the reporting week chosen in my own calendar
  So that a week boundary never surprises me

  Scenario: Reporting week is the complete week before the week containing asOf
    Given the dataset's latest event is 2026-07-27, a Monday
    When a customer asks for the comparison with asOf 2026-07-27
    Then the reporting week is 2026-07-20 to 2026-07-26
    And the partial week starting 2026-07-27 is excluded

  Scenario: Baseline is the eight complete weeks before the reporting week
    Given the reporting week is 2026-07-20 to 2026-07-26
    When the baseline window is computed
    Then it covers 2026-05-25 to 2026-07-19
    And it contains exactly eight weeks

  Scenario: Week boundaries are resolved in the account's own time zone
    Given an account in America/Los_Angeles
    When the reporting week is converted to UTC
    Then the week starts at 07:00Z because local Monday 00:00 is PDT
    And an account in America/New_York starts the same week at 04:00Z

  Scenario: Events just inside the local edges belong to the reporting week
    Given an account in America/Chicago
    When events occur at 00:30 local Monday and 23:30 local Sunday
    Then both fall inside the reporting week
    And the account's usual week is still its own history

  Scenario: An account with little history reports insufficient history
    Given an account with fewer than four complete baseline weeks
    When the comparison is requested
    Then the status is insufficient history
    And no baseline mean or percentage is invented

  @AC-3.1 @AC-3.2 @AC-3.5
  Scenario: No spec depends on the current date to choose its reporting week
    Given the same dataset and the same asOf
    When the comparison is requested twice
    Then both responses report identical periods
    And the default asOf comes from the data, not from "now"