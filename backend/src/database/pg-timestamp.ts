/**
 * pg type handling for `timestamp without time zone` columns.
 *
 * `occurred_at` / `created_at` are stored exactly as UTC wall-clock values
 * (schema.sql stores no zone). node-postgres, however, converts such values to
 * and from JS `Date` using the **process** time zone. On a developer machine
 * outside UTC that silently shifts every timestamp (observed: a 6-hour skew
 * when the host was America/Costa_Rica) while still round-tripping, which makes
 * the bug invisible to in-process assertions.
 *
 * Fix both directions:
 * - reads  (OID 1114): interpret the stored wall clock as UTC, so the resulting
 *   `Date` is the true instant regardless of where the code runs;
 * - writes: pass timestamp values as strings (see `toUtcTimestamp`), so the
 *   driver never re-formats a `Date` through the local zone.
 *
 * See PLAN.md section 3 and AC-3.1.
 */
import * as pg from 'pg';

const TIMESTAMP_OID = 1114; // timestamp without time zone

let registered = false;

export function registerUtcTimestampParser(): void {
  if (registered) return;
  pg.types.setTypeParser(TIMESTAMP_OID, (value: string) =>
    new Date(`${value.replace(' ', 'T')}Z`),
  );
  registered = true;
}

/** 'YYYY-MM-DD HH:MM:SS' (UTC) -> the literal Postgres should store. */
export function toUtcTimestamp(value: string): string {
  return value;
}

/**
 * A `Date` -> the UTC wall-clock literal `'YYYY-MM-DD HH:MM:SS'`.
 *
 * Used for **query parameters** as well as inserts. node-postgres serialises a
 * `Date` using the process time zone, so binding `2026-07-27T05:00:00Z` from a
 * host in UTC-6 reaches Postgres as `2026-07-26 23:00:00` and silently
 * narrows the window. That bug is recorded in PLAN.md R6 and R19.
 */
export function dateToUtcTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Cannot format an invalid Date: ${String(date)}`);
  }
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}