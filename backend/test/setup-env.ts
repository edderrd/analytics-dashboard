/**
 * Jest setup for integration tests (Phase 4).
 *
 * Runs before the test modules are loaded, which matters: the TypeORM options
 * are read from the environment at import time, so the database name has to be
 * set before `data-source.ts` is evaluated.
 *
 * Two deliberate choices for determinism and safety (AC-6.5):
 * - `DATABASE_NAME` points at `relay_test`, provisioned by
 *   `npm run test:e2e:setup`. Tests never touch the database seeded from
 *   `seed.sql`, which is immutable reference data.
 * - `TZ=UTC` pins the process time zone. Given R6 — where the host time zone
 *   silently shifted every timestamp — pinning it removes a whole class of
 *   environment-dependent failures.
 */
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? 'relay_test';
process.env.TZ = 'UTC';