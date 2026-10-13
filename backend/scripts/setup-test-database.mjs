#!/usr/bin/env node
/**
 * Creates and provisions an isolated test database.
 *
 * Integration tests must never write to the database seeded from `seed.sql`:
 * that dataset is treated as immutable reference data (AC-2.3). This script
 * creates `relay_test`, applies the migrations and loads the same seed into it,
 * so tests get identical fixtures plus a safe place to insert synthetic rows.
 *
 * Usage:
 *   npm run test:e2e:setup --workspace backend
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, '..');

// Honour backend/.env when present so local overrides apply to the test
// database too, while anything already in the environment still wins.
dotenv.config({ path: join(backendRoot, '.env') });

const testDatabase = process.env.TEST_DATABASE_NAME ?? 'relay_test';

const connection = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER ?? 'relay',
  password: process.env.DATABASE_PASSWORD ?? 'relay',
};

/**
 * Recreates the test database from scratch on every run.
 *
 * It is disposable, and rebuilding it is what makes runs deterministic: a
 * previous run that failed part-way (leaving synthetic rows behind) cannot
 * influence the next one, and the seed's own count assertions stay meaningful.
 * The reference database seeded from `seed.sql` is never touched.
 */
async function recreateDatabase() {
  const client = new pg.Client({ ...connection, database: 'postgres' });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDatabase],
    );
    // Identifiers cannot be parameterised; this is a fixed local constant.
    await client.query(`DROP DATABASE IF EXISTS "${testDatabase}"`);
    await client.query(`CREATE DATABASE "${testDatabase}"`);
    console.log(`Recreated database ${testDatabase}`);
  } finally {
    await client.end();
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
  }
}

const env = { DATABASE_NAME: testDatabase, TZ: 'UTC' };

await recreateDatabase();
run('npm', ['run', 'migration:run'], env);
run('npm', ['run', 'seed'], env);

console.log(`Test database ${testDatabase} is ready (migrated and seeded).`);