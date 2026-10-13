/**
 * Jest setup for integration tests (Phase 4).
 *
 * Runs before the test modules are loaded, which matters: the TypeORM options
 * are read from the environment at import time, so the database name has to be
 * set before `data-source.ts` is evaluated.
 *
 * Three deliberate choices for determinism and safety (AC-6.5):
 * - `DATABASE_NAME` points at the test database, provisioned by
 *   `npm run test:e2e:setup`. Tests never touch the database seeded from
 *   `seed.sql`, which is immutable reference data.
 * - `TZ=UTC` pins the process time zone. Given R6 and R19 — where the host time
 *   zone silently shifted timestamps and query windows — pinning it removes a
 *   whole class of environment-dependent failures.
 * - `backend/.env` is honoured if present, so a developer can point the tests
 *   at a differently named test database without editing code.
 */
import { readEnv } from '../src/config/env';

// readEnv() also loads backend/.env when it exists, so this honours a local
// override without letting it mask variables already set by the environment.
const env = readEnv({});

process.env.DATABASE_NAME = env.TEST_DATABASE_NAME;
process.env.TZ = 'UTC';