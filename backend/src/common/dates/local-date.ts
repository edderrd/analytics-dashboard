/**
 * Calendar helpers for account-local time.
 *
 * All dates in this module are plain calendar dates (`YYYY-MM-DD`) handled
 * without a time zone, because that is what "the week in the customer's own
 * calendar" means. Conversion between a local wall clock and a UTC instant is
 * the only place a time zone matters, and lives in `account-time.ts`.
 *
 * Week convention (PLAN.md R1): weeks start on **Monday**.
 */

/** A calendar date with no time or zone attached. */
export type LocalDate = string;

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidLocalDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  // Round-trip through Date.UTC to reject impossible days such as 2026-02-30,
  // which would otherwise be normalised silently to a different date.
  const normalized = new Date(Date.UTC(year, month - 1, day));
  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() + 1 === month &&
    normalized.getUTCDate() === day
  );
}

export function parseLocalDate(value: string): LocalDateParts {
  const match = ISO_DATE_RE.exec(value);
  if (!match) throw new Error(`Invalid local date: "${value}" (expected YYYY-MM-DD)`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function toLocalDate(parts: LocalDateParts): LocalDate {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * Calendar arithmetic via UTC internally. Safe because these values are
 * zone-less calendar dates: adding 1 day must not depend on any DST rule.
 */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toLocalDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0
    ? 6
    : new Date(Date.UTC(year, month - 1, day)).getUTCDay() - 1;
}

/** The Monday starting the week that contains `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -dayOfWeek(date));
}