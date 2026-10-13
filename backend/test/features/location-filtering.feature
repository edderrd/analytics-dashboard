# Implements: backend/test/location-filter.e2e-spec.ts, frontend/src/test/location-filter.spec.tsx, frontend/src/test/live-dashboard.spec.tsx

Feature: Filtering the dashboard by location
  As an account manager
  I want to narrow the dashboard to a single site
  So that I can focus on the branch I care about

  Scenario: No filter means the whole account
    Given a customer with fifteen locations
    When the comparison is requested without a filter
    Then every location is in scope
    And the response states that nothing was filtered

  Scenario: Selecting one site narrows the whole response
    Given a customer with fifteen locations
    When the comparison is requested for one site
    Then the totals equal that site's own numbers
    And the response states which location is in scope

  Scenario: The full location list is always returned
    Given a comparison filtered to one site
    When the response is read
    Then every location is still listed so a picker can be built

  Scenario: Several sites can be selected together
    Given a customer with fifteen locations
    When two sites are selected
    Then the totals equal the sum of exactly those two sites

  Scenario: An unknown location is rejected
    Given a location belonging to another customer
    When it is used as a filter
    Then the request is rejected
    And a valid location mixed with an invalid one is still rejected

  @AC-4.7
  Scenario: Filtering narrows the totals rather than leaving them unchanged
    Given a site whose own usual week differs from the account average
    When the comparison is filtered to that site
    Then the baseline used is the site's own history
    And not a share of the account total