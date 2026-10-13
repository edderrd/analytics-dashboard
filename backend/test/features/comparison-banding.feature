# Implements: backend/src/modules/comparisons/domain/compare-to-baseline.spec.ts, backend/test/edge-cases.e2e-spec.ts

Feature: Deciding whether a week was normal
  As a customer looking at my dashboard on a Monday morning
  I need each metric labelled typical, above or below
  So that I know whether to act

  Scenario: A week within thirty percent of the usual week is typical
    Given an account whose usual week is 100 calls
    When the reporting week has 70 calls
    Then the status is typical because it is exactly at the band edge

  Scenario: A week more than thirty percent below is below normal
    Given an account whose usual week is 100 calls
    When the reporting week has 49 calls
    Then the status is below
    And the change is reported as -51 percent

  Scenario: A week more than thirty percent above is above normal
    Given an account whose usual week is 100 calls
    When the reporting week has 140 calls
    Then the status is above

  Scenario: A week with no activity at all is below rather than unknown
    Given an account whose usual week is 100 calls
    When the reporting week has no calls at all
    Then the status is below at minus one hundred percent

  Scenario: Quiet weeks are part of what normal looks like
    Given a baseline of four busy weeks and four silent weeks
    When the usual week is calculated
    Then the silent weeks are included in the mean

  Scenario: Too few active baseline weeks means no comparison
    Given a baseline with only two weeks containing activity
    When the comparison is requested
    Then the status is insufficient history
    And the reason names the missing observations

  Scenario: Exactly the minimum number of active weeks is enough
    Given a baseline with exactly three weeks containing activity
    When the comparison is requested
    Then a comparison is produced rather than a refusal

  Scenario: A zero baseline never produces a percentage
    Given a baseline mean of zero
    When new activity appears
    Then the activity is reported as above with no percentage
    And no NaN or Infinity is ever emitted

  @AC-3.4 @AC-3.6
  Scenario: A metric with no baseline activity reports the count with no percentage
    Given a metric with no activity in any baseline week
    When the reporting week shows a new event
    Then the count is still reported
    And no percentage is fabricated
    And the state explains that there was no baseline to compare against