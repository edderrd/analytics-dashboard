#!/usr/bin/env node
/**
 * Independent verification that the database contents match `seed.sql`.
 *
 * Why this exists: verifying the seed only through the application process can
 * hide timestamp drift, because node-postgres converts `timestamp without time
 * zone` to and from JS `Date` using the *process* time zone. A host outside UTC
 * therefore writes and reads a symmetrically shifted value and the round-trip
 * looks correct. This script queries Postgres and compares the **raw text**
 * Postgres holds against the raw text in `seed.sql`, so any drift is visible
 * regardless of where it runs.
 *
 * Exits non-zero on mismatch.
 *
 * Usage:
 *   DATABASE_URL=postgres://relay:relay@localhost:5432/relay \
 *     npm run seed:verify-db --workspace backend
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const seedSqlPath = join(here, '..', '..', 'seed.sql');

const ACCOUNT_RE =
  /^INSERT INTO accounts \(id, name, industry, timezone, created_at\) VALUES \((\d+), '([^']*)', '([^']*)', '([^']*)', '([^']*)'\);$/;
const EVENT_RE =
  /^INSERT INTO activity_events \(id, account_id, location, event_type, occurred_at, duration_seconds, outcome\) VALUES \((\d+), (\d+), '([^']*)', '([^']*)', '([^']*)', (NULL|\d+), (NULL|'([^']*)')\);$/;

const expectedAccounts = [];
const expectedEvents = [];

for (const line of readFileSync(seedSqlPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  let match = ACCOUNT_RE.exec(trimmed);
  if (match) {
    expectedAccounts.push({
      id: Number(match[1]),
      name: match[2],
      industry: match[3],
      timezone: match[4],
      created_at: match[5],
    });
    continue;
  }
  match = EVENT_RE.exec(trimmed);
  if (match) {
    expectedEvents.push({
      id: Number(match[1]),
      account_id: Number(match[2]),
      location: match[3],
      event_type: match[4],
      occurred_at: match[5],
      duration_seconds: match[6] === 'NULL' ? null : Number(match[6]),
      outcome: match[7] === 'NULL' ? null : match[8],
    });
  }
}

/** Postgres renders `timestamp` as 'YYYY-MM-DD HH:MM:SS[.ffffff]'; normalise. */
const normalizeTimestamp = (value) => String(value).replace(/\.\d+$/, '');

const connectionString =
  process.env.DATABASE_URL ??
  `postgres://${process.env.DATABASE_USER ?? 'relay'}:${process.env.DATABASE_PASSWORD ?? 'relay'}@${
    process.env.DATABASE_HOST ?? 'localhost'
  }:${process.env.DATABASE_PORT ?? 5432}/${process.env.DATABASE_NAME ?? 'relay'}`;

const client = new pg.Client({ connectionString, options: '-c timezone=UTC' });
const failures = [];

try {
  await client.connect();

  // Text protocol: no JS Date conversion anywhere in this comparison.
  const { rows: accountRows } = await client.query(
    `SELECT id::text, name, industry, timezone,
            to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
       FROM accounts ORDER BY id::int`,
  );
  const { rows: eventRows } = await client.query(
    `SELECT id::text, account_id::text, location, event_type,
            to_char(occurred_at, 'YYYY-MM-DD HH24:MI:SS') AS occurred_at,
            duration_seconds::text, outcome
       FROM activity_events ORDER BY id::int`,
  );

  if (accountRows.length !== expectedAccounts.length) {
    failures.push(
      `accounts: db has ${accountRows.length}, seed.sql has ${expectedAccounts.length}`,
    );
  }
  if (eventRows.length !== expectedEvents.length) {
    failures.push(
      `activity_events: db has ${eventRows.length}, seed.sql has ${expectedEvents.length}`,
    );
  }

  const accountLimit = Math.min(accountRows.length, expectedAccounts.length);
  for (let i = 0; i < accountLimit; i += 1) {
    const actual = accountRows[i];
    const expected = expectedAccounts[i];
    for (const key of ['id', 'name', 'industry', 'timezone', 'created_at']) {
      if (String(actual[key]) !== String(expected[key])) {
        failures.push(
          `accounts[${i}].${key}: db=${JSON.stringify(actual[key])} seed=${JSON.stringify(
            expected[key],
          )}`,
        );
      }
    }
  }

  const eventLimit = Math.min(eventRows.length, expectedEvents.length);
  for (let i = 0; i < eventLimit; i += 1) {
    const actual = eventRows[i];
    const expected = expectedEvents[i];
    for (const key of [
      'id',
      'account_id',
      'location',
      'event_type',
      'duration_seconds',
      'outcome',
    ]) {
      const a = actual[key] === null ? null : String(actual[key]);
      const e = expected[key] === null ? null : String(expected[key]);
      if (a !== e) {
        failures.push(
          `activity_events[${i}].${key}: db=${JSON.stringify(a)} seed=${JSON.stringify(e)}`,
        );
      }
    }
    const actualTs = normalizeTimestamp(actual.occurred_at);
    if (actualTs !== expected.occurred_at) {
      failures.push(
        `activity_events[${i}].occurred_at: db=${JSON.stringify(actualTs)} seed=${JSON.stringify(
          expected.occurred_at,
        )}`,
      );
    }
    if (failures.length > 25) {
      failures.push('... further differences suppressed');
      break;
    }
  }
} finally {
  await client.end();
}

if (failures.length > 0) {
  console.error('Database contents do NOT match seed.sql:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Database matches seed.sql exactly: ${expectedAccounts.length} accounts, ${expectedEvents.length} activity events (raw text comparison).`,
);