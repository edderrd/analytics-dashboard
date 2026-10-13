# Implements: backend/test/seed-integrity.e2e-spec.ts, backend/scripts/verify-seed-data.mjs, backend/scripts/verify-seeded-db.mjs, backend/src/database/seed/seed-runner.ts

Feature: Seeded data integrity
  As an engineer working on the dashboard
  I need the supplied dataset to be preserved exactly
  So that comparisons stay trustworthy

  Scenario: The database holds exactly the seeded accounts and events
    Given the raw seed.sql with 20 accounts and 12626 events
    When the seed process runs
    Then the database contains those same rows with the same values

  Scenario: The module and the database are compared against the seed as raw text
    Given the generated TypeScript seed module
    When it is compared against seed.sql by a second parser
    Then every field of every row matches
    And deliberately corrupting any field is detected

  Scenario: Timestamps are stored as the UTC wall clock from the source
    Given the host process running in a time zone behind UTC
    When the seed is loaded
    Then occurred_at holds the same wall clock values as the source
    And the earliest and latest events are checked explicitly

  Scenario: The migration produced the same columns, types and keys
    Given the raw schema.sql
    When the migration is applied
    Then the column types, nullability and keys match the source

  @AC-2.3 @AC-2.4
  Scenario: A partially seeded database is never silently repaired by the runner
    Given a database holding only part of the dataset
    When the seed process runs
    Then it fails loudly rather than deleting or rewriting reference data