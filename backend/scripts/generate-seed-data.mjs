#!/usr/bin/env node
/**
 * Translates the raw `seed.sql` dataset into the checked-in TypeScript seed
 * data module (`backend/src/database/seed/seed-data.ts`).
 *
 * This script exists for provenance only: the generated module is the artifact
 * that ships, and the values are copied verbatim from `seed.sql`. Nothing is
 * regenerated, reordered, normalised or invented — the row order in the source
 * file is preserved.
 *
 * Usage (from repo root):
 *   npm run seed:generate --workspace backend
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const seedSqlPath = join(repoRoot, 'seed.sql');
const outputPath = join(here, '..', 'src', 'database', 'seed', 'seed-data.ts');

// Strict patterns: `[^']*` (not `[^']|''`) — a doubled-quote alternative
// permits zero-width matches and lets the regex backtrack into the wrong
// columns, silently corrupting values.
const ACCOUNT_RE =
  /^INSERT INTO accounts \(id, name, industry, timezone, created_at\) VALUES \((\d+), '([^']*)', '([^']*)', '([^']*)', '([^']*)'\);$/;

const EVENT_RE =
  /^INSERT INTO activity_events \(id, account_id, location, event_type, occurred_at, duration_seconds, outcome\) VALUES \((\d+), (\d+), '([^']*)', '([^']*)', '([^']*)', (NULL|\d+), (NULL|'([^']*)')\);$/;

// The capture groups exclude the surrounding quotes, so values must NOT be
// unquoted again (doing so silently truncated the first and last character of
// every string — see PLAN.md R6).
const unescapeSql = (value) => value.replace(/''/g, "'");
const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const accounts = [];
const events = [];

for (const line of readFileSync(seedSqlPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  const accountMatch = ACCOUNT_RE.exec(trimmed);
  if (accountMatch) {
    accounts.push({
      id: Number(accountMatch[1]),
      name: unescapeSql(accountMatch[2]),
      industry: unescapeSql(accountMatch[3]),
      timezone: unescapeSql(accountMatch[4]),
      createdAt: accountMatch[5],
    });
    continue;
  }

  const eventMatch = EVENT_RE.exec(trimmed);
  if (eventMatch) {
    events.push({
      id: Number(eventMatch[1]),
      accountId: Number(eventMatch[2]),
      location: unescapeSql(eventMatch[3]),
      eventType: unescapeSql(eventMatch[4]),
      occurredAt: eventMatch[5],
      durationSeconds: eventMatch[6] === 'NULL' ? null : Number(eventMatch[6]),
      // Group 7 is the whole `NULL|'...'` alternative; group 8 is the bare value.
      outcome: eventMatch[8] === undefined ? null : unescapeSql(eventMatch[8]),
    });
  }
}

if (accounts.length === 0 || events.length === 0) {
  throw new Error(
    `Parsed no rows from ${seedSqlPath} (accounts=${accounts.length}, events=${events.length}). Refusing to write an empty module.`,
  );
}

const accountRows = accounts
  .map(
    (a) =>
      `  { id: ${a.id}, name: ${quote(a.name)}, industry: ${quote(a.industry)}, timezone: ${quote(
        a.timezone,
      )}, createdAt: ${quote(a.createdAt)} },`,
  )
  .join('\n');

const eventRows = events
  .map(
    (e) =>
      `  { id: ${e.id}, accountId: ${e.accountId}, location: ${quote(e.location)}, eventType: ${quote(
        e.eventType,
      )}, occurredAt: ${quote(e.occurredAt)}, durationSeconds: ${
        e.durationSeconds === null ? 'null' : e.durationSeconds
      }, outcome: ${e.outcome === null ? 'null' : quote(e.outcome)} },`,
  )
  .join('\n');

const module = `/**
 * Seed data translated from \`seed.sql\` (source of truth, untouched).
 *
 * GENERATED FILE — do not hand-edit.
 * Regenerate with: npm run seed:generate --workspace backend
 *
 * Values are copied verbatim from \`seed.sql\`, in source order:
 *   accounts        ${accounts.length}
 *   activity_events ${events.length}
 *
 * Timestamps are kept as \`YYYY-MM-DD HH:MM:SS\` strings exactly as stored in
 * the source (all UTC) and are converted to UTC \`Date\` values by the seed
 * runner. See PLAN.md sections 2 and 3.
 */

export interface SeedAccount {
  readonly id: number;
  readonly name: string;
  readonly industry: string;
  readonly timezone: string;
  /** UTC, 'YYYY-MM-DD HH:MM:SS'. */
  readonly createdAt: string;
}

export interface SeedActivityEvent {
  readonly id: number;
  readonly accountId: number;
  readonly location: string;
  readonly eventType: string;
  /** UTC, 'YYYY-MM-DD HH:MM:SS'. */
  readonly occurredAt: string;
  readonly durationSeconds: number | null;
  readonly outcome: string | null;
}

export const EXPECTED_ACCOUNT_COUNT = ${accounts.length};

export const EXPECTED_ACTIVITY_EVENT_COUNT = ${events.length};

export const SEED_ACCOUNTS: readonly SeedAccount[] = [
${accountRows}
];

export const SEED_ACTIVITY_EVENTS: readonly SeedActivityEvent[] = [
${eventRows}
];
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, module, 'utf8');

console.log(
  `Wrote ${outputPath}\n  accounts: ${accounts.length}\n  activity_events: ${events.length}`,
);