/**
 * Conversions between account-local wall clock and UTC instants.
 *
 * `occurred_at` is stored as a UTC wall clock with no zone (schema.sql), while
 * each account reports in its own IANA zone. Week boundaries therefore have to
 * be resolved *in the account's zone first* and only then converted to UTC for
 * querying — otherwise a Monday week in Los Angeles would be split down the
 * middle (PLAN.md AC-3.1).
 */

import { addDays, parseLocalDate, type LocalDate } from './local-date';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The wall-clock fields an account would see for a given UTC instant. */
export function utcToLocalFields(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Some ICU builds report midnight as 24; normalise to 00.
  const hour = read('hour') % 24;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

/** The calendar date (`YYYY-MM-DD`) an account sees for a UTC instant. */
export function utcToLocalDate(instant: Date, timeZone: string): LocalDate {
  const { year, month, day } = utcToLocalFields(instant, timeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Offset in ms to add to a UTC instant to obtain the local wall clock. */
function offsetMs(instant: Date, timeZone: string): number {
  const fields = utcToLocalFields(instant, timeZone);
  const asUtc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  );
  // Drop sub-second noise so the value is stable to millisecond precision.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which the given local wall clock occurs in `timeZone`.
 *
 * Resolved iteratively so DST transitions land on the correct side of the jump;
 * for a local time that does not exist (the skipped hour when clocks go
 * forward) the first valid instant after the gap is returned.
 */
export function localTimeToUtc(
  date: LocalDate,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const { year, month, day } = parseLocalDate(date);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);

  let guess = wallClock - offsetMs(new Date(wallClock), timeZone);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refined = wallClock - offsetMs(new Date(guess), timeZone);
    if (refined === guess) break;
    guess = refined;
  }
  return new Date(guess);
}

/**
 * Inclusive local start and exclusive local end of a week, expressed as the UTC
 * instants to filter `occurred_at` with.
 */
export function weekBoundsUtc(
  weekStartLocal: LocalDate,
  timeZone: string,
): { startUtc: Date; endExclusiveUtc: Date; startLocal: LocalDate; endLocal: LocalDate } {
  const startLocal = weekStartLocal;
  const endLocal = addDays(weekStartLocal, 6);
  return {
    startUtc: localTimeToUtc(startLocal, 0, 0, 0, timeZone),
    endExclusiveUtc: localTimeToUtc(addDays(weekStartLocal, 7), 0, 0, 0, timeZone),
    startLocal,
    endLocal,
  };
}

/** True when the zone identifier is one Postgres/ICU understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}