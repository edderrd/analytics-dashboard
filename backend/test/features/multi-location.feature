# Implements: backend/test/location-comparison.e2e-spec.ts, backend/test/accounts.e2e-spec.ts, frontend/src/test/live-dashboard.spec.tsx

Feature: Multi-location comparison and account scoping
  As a support team member
  I need to see each location's own normal week
  So that I know which site needs attention

  Scenario: Every location gets its own comparison
    Given a customer with fifteen locations
    When the per-location comparison is requested
    Then all fifteen locations are returned
    And each one is compared against its own history

  Scenario: Locations sum to the account total
    Given a customer with several locations
    When the per-location and account comparisons are both requested
    Then the per-location counts add up to the account total

  Scenario: A single-location customer needs no location table
    Given a customer with exactly one location
    When their dashboard is opened
    Then no per-location table is shown

  Scenario: An account with no activity is an empty state, not an error
    Given a customer with no events at all
    When their dashboard is opened
    Then an explicit no-activity state is shown
    And no error is raised

  Scenario: One account can never see another's data
    Given a location that belongs to a different customer
    When it is requested for this customer
    Then the request is rejected
    And no data leaks across accounts

  @AC-3.3 @AC-3.8 @AC-3.9
  Scenario: Locations needing attention are surfaced first
    Given a customer whose sites moved by different amounts
    When the per-location table is rendered
    Then the sites furthest from their own usual are listed first