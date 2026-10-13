import { addDays, startOfWeek, type LocalDate } from '../../../common/dates/local-date';
import { BASELINE_WEEKS } from '../comparison.constants';

/**
 * Reporting and baseline periods, as account-local calendar dates.
 *
 * Rule (PLAN.md AC-3.2): `asOf` names a local date inside the *current,
 * possibly incomplete* week; the reporting week is the complete week
 * immediately before it, and the baseline is the `BASELINE_WEEKS` complete
 * weeks before that. Nothing here reads the wall clock, so results are
 * reproducible.
 */
export interface ComparisonPeriods {
  /** Local date the periods were derived from. */
  asOfLocal: LocalDate;
  /** Monday of the week containing `asOfLocal` (typically incomplete). */
  currentWeekStartLocal: LocalDate;
  /** First day (Monday) of the complete reporting week. */
  reportingStartLocal: LocalDate;
  /** Last day (Sunday) of the reporting week, inclusive. */
  reportingEndLocal: LocalDate;
  /** Monday of the earliest baseline week. */
  baselineStartLocal: LocalDate;
  /** Sunday of the most recent baseline week, inclusive. */
  baselineEndLocal: LocalDate;
  /** Baseline week starts, most recent first. */
  baselineWeekStartsLocal: LocalDate[];
}

export function resolveComparisonPeriods(asOfLocal: LocalDate): ComparisonPeriods {
  const currentWeekStartLocal = startOfWeek(asOfLocal);
  const reportingStartLocal = addDays(currentWeekStartLocal, -7);
  const baselineEndLocal = addDays(reportingStartLocal, -1);
  const baselineStartLocal = addDays(reportingStartLocal, -7 * BASELINE_WEEKS);

  const baselineWeekStartsLocal = Array.from({ length: BASELINE_WEEKS }, (_, index) =>
    addDays(reportingStartLocal, -7 * (index + 1)),
  );

  return {
    asOfLocal,
    currentWeekStartLocal,
    reportingStartLocal,
    reportingEndLocal: addDays(reportingStartLocal, 6),
    baselineStartLocal,
    baselineEndLocal,
    baselineWeekStartsLocal,
  };
}