#!/usr/bin/env node
/**
 * Integrity check for the generated seed module.
 *
 * Re-parses `seed.sql` with a deliberately different strategy (quote-scanner
 * rather than the single-regex parse used by the generator) and compares every
 * field of every row against `src/database/seed/seed-data.ts`. A bug in either
 * parser shows up as a mismatch instead of passing silently.
 *
 * Exits non-zero on any mismatch. This is the check that caught a
 * column-misalignment bug in the generator's regex (PLAN.md R6).
 *
 * Usage:
 *   npm run seed:verify --workspace backend
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const seedSqlPath = join(repoRoot, 'seed.sql');
const modulePath = join(here, '..', 'src', 'database', 'seed', 'seed-data.ts');

/** Scans one INSERT ... VALUES (...) tuple into raw (still quoted) fields. */
function splitTuple(rest) {
  const fields = [];
  let i = 0;
  if (rest[i] === '(') i += 1;
  while (i < rest.length) {
    while (rest[i] === ' ' || rest[i] === ',') i += 1;
    if (rest[i] === "'") {
      let value = '';
      i += 1;
      while (i < rest.length) {
        if (rest[i] === "'" && rest[i + 1] === "'") {
          value += "''";
          i += 2;
          continue;
        }
        if (rest[i] === "'") break;
        value += rest[i];
        i += 1;
      }
      fields.push(value);
      i += 1;
    } else {
      let value = '';
      while (i < rest.length && rest[i] !== ',' && rest[i] !== ')') {
        value += rest[i];
        i += 1;
      }
      fields.push(value.trim());
      if (rest[i] === ')') break;
    }
  }
  return fields;
}

// The scanner above already strips the surrounding quotes, so values are used
// as-is (only doubled quotes need collapsing).
const unescapeSql = (v) => v.replace(/''/g, "'");

const expectedAccounts = [];
const expectedEvents = [];

for (const line of readFileSync(seedSqlPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('INSERT INTO accounts ')) {
    const fields = splitTuple(trimmed.slice(trimmed.indexOf('VALUES ') + 7));
    expectedAccounts.push({
      id: Number(fields[0]),
      name: unescapeSql(fields[1]),
      industry: unescapeSql(fields[2]),
      timezone: unescapeSql(fields[3]),
      createdAt: fields[4],
    });
  } else if (trimmed.startsWith('INSERT INTO activity_events ')) {
    const fields = splitTuple(trimmed.slice(trimmed.indexOf('VALUES ') + 7));
    expectedEvents.push({
      id: Number(fields[0]),
      accountId: Number(fields[1]),
      location: unescapeSql(fields[2]),
      eventType: unescapeSql(fields[3]),
      occurredAt: fields[4],
      durationSeconds: fields[5] === 'NULL' ? null : Number(fields[5]),
      outcome: fields[6] === 'NULL' ? null : unescapeSql(fields[6]),
    });
  }
}

/** Reads the generated module by evaluating it as plain data. */
const moduleSource = readFileSync(modulePath, 'utf8');
const accountsLiteral = /export const SEED_ACCOUNTS: readonly SeedAccount\[\] = \[([\s\S]*?)\n\];/.exec(
  moduleSource,
);
const eventsLiteral = /export const SEED_ACTIVITY_EVENTS: readonly SeedActivityEvent\[\] = \[([\s\S]*?)\n\];/.exec(
  moduleSource,
);

if (!accountsLiteral || !eventsLiteral) {
  console.error('Could not locate seed arrays in the generated module.');
  process.exit(1);
}

const actualAccounts = eval(`[${accountsLiteral[1]}]`);
const actualEvents = eval(`[${eventsLiteral[1]}]`);

const failures = [];

if (actualAccounts.length !== expectedAccounts.length) {
  failures.push(
    `accounts: module has ${actualAccounts.length}, seed.sql has ${expectedAccounts.length}`,
  );
}
if (actualEvents.length !== expectedEvents.length) {
  failures.push(
    `activity_events: module has ${actualEvents.length}, seed.sql has ${expectedEvents.length}`,
  );
}

const ACCOUNT_KEYS = ['id', 'name', 'industry', 'timezone', 'createdAt'];
const EVENT_KEYS = [
  'id',
  'accountId',
  'location',
  'eventType',
  'occurredAt',
  'durationSeconds',
  'outcome',
];

function compare(label, actual, expected, keys) {
  const limit = Math.min(actual.length, expected.length);
  let shown = 0;
  for (let i = 0; i < limit; i += 1) {
    for (const key of keys) {
      if (actual[i][key] !== expected[i][key]) {
        failures.push(
          `${label}[${i}].${key}: module=${JSON.stringify(actual[i][key])} seed=${JSON.stringify(
            expected[i][key],
          )}`,
        );
        shown += 1;
        if (shown >= 10) return;
      }
    }
  }
}

compare('accounts', actualAccounts, expectedAccounts, ACCOUNT_KEYS);
compare('activity_events', actualEvents, expectedEvents, EVENT_KEYS);

const expectedCounts = {
  accounts: expectedAccounts.length,
  activity_events: expectedEvents.length,
};
const declaredAccounts = Number(
  /EXPECTED_ACCOUNT_COUNT = (\d+)/.exec(moduleSource)?.[1],
);
const declaredEvents = Number(
  /EXPECTED_ACTIVITY_EVENT_COUNT = (\d+)/.exec(moduleSource)?.[1],
);
if (declaredAccounts !== expectedCounts.accounts) {
  failures.push(
    `EXPECTED_ACCOUNT_COUNT is ${declaredAccounts}, seed.sql has ${expectedCounts.accounts}`,
  );
}
if (declaredEvents !== expectedCounts.activity_events) {
  failures.push(
    `EXPECTED_ACTIVITY_EVENT_COUNT is ${declaredEvents}, seed.sql has ${expectedCounts.activity_events}`,
  );
}

if (failures.length > 0) {
  console.error('Seed module verification FAILED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Seed module matches seed.sql exactly: ${expectedCounts.accounts} accounts, ${expectedCounts.activity_events} activity events.`,
);