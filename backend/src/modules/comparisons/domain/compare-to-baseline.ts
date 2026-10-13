import {
  MIN_BASELINE_OBS,
  MIN_BASELINE_WEEKS,
  NORMAL_BAND_PCT,
} from '../comparison.constants';

export type ComparisonStatus =
  | 'above'
  | 'typical'
  | 'below'
  | 'insufficient_history';

/** Why a comparison could not be made, when it could not. */
export type InsufficientReason = 'not_enough_history' | 'not_enough_observations';

export type ComparisonReason =
  | 'within_normal_band'
  | 'outside_normal_band'
  | 'zero_baseline_no_activity'
  | 'zero_baseline_new_activity'
  | InsufficientReason;

export interface Classification {
  status: ComparisonStatus;
  /** Signed change vs baseline, e.g. -18.5. `null` when undefined. */
  changePct: number | null;
  reason: ComparisonReason;
}

export interface ComparisonOutcome extends Classification {
  /** Mean events per baseline week. `null` when no comparison was possible. */
  baselineMean: number | null;
  /** Baseline weeks that contained at least one event. */
  baselineNonZeroWeeks: number;
  /** Complete baseline weeks covered by the account's history. */
  availableBaselineWeeks: number;
}

export interface ComparisonInput {
  /** Events in the reporting week. */
  reportingCount: number;
  /** Event count per baseline week, oldest first. Zeros are meaningful. */
  baselineWeekCounts: number[];
  /** Complete baseline weeks the account actually has history for. */
  availableBaselineWeeks: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Banding rule (AC-3.4): within +/-NORMAL_BAND_PCT of the baseline mean is
 * "typical"; outside it is "above" or "below".
 *
 * A zero baseline has no meaningful percentage, so no percentage is reported —
 * never NaN or Infinity (AC-3.6).
 */
export function classifyAgainstBaseline(
  reportingCount: number,
  baselineMean: number,
): Classification {
  if (baselineMean === 0) {
    return reportingCount === 0
      ? { status: 'typical', changePct: null, reason: 'zero_baseline_no_activity' }
      : { status: 'above', changePct: null, reason: 'zero_baseline_new_activity' };
  }

  const changePct = round1(((reportingCount - baselineMean) / baselineMean) * 100);

  if (Math.abs(changePct) <= NORMAL_BAND_PCT) {
    return { status: 'typical', changePct, reason: 'within_normal_band' };
  }
  return {
    status: changePct > 0 ? 'above' : 'below',
    changePct,
    reason: 'outside_normal_band',
  };
}

/**
 * Answers "is this week normal for us?" for one event type and one scope
 * (account, or account + location).
 *
 * The baseline mean is taken across **all** baseline weeks, including weeks
 * with no events: a quiet week is part of what normal looks like for this
 * account, and excluding zeros would bias the baseline upwards (PLAN.md R10).
 *
 * Note on the zero-baseline branch: with that definition an exactly-zero mean
 * implies every baseline week was empty, which `MIN_BASELINE_OBS` already
 * rejects — so the branch is defensive rather than routinely reachable. It is
 * therefore covered directly by unit tests of `classifyAgainstBaseline`.
 */
export function compareToBaseline(input: ComparisonInput): ComparisonOutcome {
  const { reportingCount, baselineWeekCounts, availableBaselineWeeks } = input;

  const baselineNonZeroWeeks = baselineWeekCounts.filter((count) => count > 0).length;
  const insufficient = (reason: InsufficientReason): ComparisonOutcome => ({
    status: 'insufficient_history',
    changePct: null,
    baselineMean: null,
    baselineNonZeroWeeks,
    availableBaselineWeeks,
    reason,
  });

  if (availableBaselineWeeks < MIN_BASELINE_WEEKS) {
    return insufficient('not_enough_history');
  }
  if (baselineNonZeroWeeks < MIN_BASELINE_OBS) {
    return insufficient('not_enough_observations');
  }

  const total = baselineWeekCounts.reduce((sum, count) => sum + count, 0);
  const baselineMean = round1(total / baselineWeekCounts.length);

  return {
    ...classifyAgainstBaseline(reportingCount, baselineMean),
    baselineMean,
    baselineNonZeroWeeks,
    availableBaselineWeeks,
  };
}