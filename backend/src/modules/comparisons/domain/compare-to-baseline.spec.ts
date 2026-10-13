import {
  classifyAgainstBaseline,
  compareToBaseline,
} from './compare-to-baseline';
import {
  MIN_BASELINE_OBS,
  MIN_BASELINE_WEEKS,
  NORMAL_BAND_PCT,
} from '../comparison.constants';

/**
 * AC-3.4 / AC-3.5 / AC-3.6 — the "is this normal for us?" rule, its
 * insufficient-history behaviour and its zero-baseline behaviour.
 */
describe('compareToBaseline (AC-3.4, AC-3.5, AC-3.6)', () => {
  const FULL_HISTORY = 8;
  const steady = [100, 100, 100, 100, 100, 100, 100, 100]; // mean 100

  describe('Given a healthy baseline and a week inside the band', () => {
    it('When the reporting week matches the baseline exactly, Then it is typical', () => {
      const outcome = compareToBaseline({
        reportingCount: 100,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('typical');
      expect(outcome.changePct).toBe(0);
      expect(outcome.reason).toBe('within_normal_band');
    });

    it('When the reporting week is exactly 30% below, Then it is still typical', () => {
      const outcome = compareToBaseline({
        reportingCount: 70,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('typical');
      expect(outcome.changePct).toBe(-30);
    });

    it('When the reporting week is exactly 30% above, Then it is still typical', () => {
      const outcome = compareToBaseline({
        reportingCount: 130,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('typical');
    });
  });

  describe('Given a healthy baseline and a week outside the band', () => {
    it('When the reporting week is 51% below, Then it is below', () => {
      const outcome = compareToBaseline({
        reportingCount: 49,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('below');
      expect(outcome.reason).toBe('outside_normal_band');
    });

    it('When the reporting week is 40% above, Then it is above', () => {
      const outcome = compareToBaseline({
        reportingCount: 140,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('above');
    });

    it('When the reporting week has no activity, Then it is below by 100%', () => {
      const outcome = compareToBaseline({
        reportingCount: 0,
        baselineWeekCounts: steady,
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('below');
      expect(outcome.changePct).toBe(-100);
    });
  });

  describe('Given too little history (AC-3.5)', () => {
    it('When fewer than four baseline weeks of history exist, Then no comparison is made', () => {
      const outcome = compareToBaseline({
        reportingCount: 10,
        baselineWeekCounts: steady,
        availableBaselineWeeks: MIN_BASELINE_WEEKS - 1,
      });
      expect(outcome.status).toBe('insufficient_history');
      expect(outcome.reason).toBe('not_enough_history');
      expect(outcome.baselineMean).toBeNull();
      expect(outcome.changePct).toBeNull();
    });

    it('When an account has no history at all, Then no comparison is made', () => {
      const outcome = compareToBaseline({
        reportingCount: 0,
        baselineWeekCounts: [0, 0, 0, 0, 0, 0, 0, 0],
        availableBaselineWeeks: 0,
      });
      expect(outcome.status).toBe('insufficient_history');
      expect(outcome.reason).toBe('not_enough_history');
    });

    it('When too few baseline weeks contain activity, Then no comparison is made', () => {
      const outcome = compareToBaseline({
        reportingCount: 50,
        baselineWeekCounts: [50, 0, 50, 0, 0, 0, 0, 0],
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).toBe('insufficient_history');
      expect(outcome.reason).toBe('not_enough_observations');
      expect(outcome.baselineNonZeroWeeks).toBe(2);
    });

    it('When exactly the minimum number of active weeks exist, Then a comparison is made', () => {
      const outcome = compareToBaseline({
        reportingCount: 50,
        baselineWeekCounts: [50, 50, 50, 0, 0, 0, 0, 0],
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.status).not.toBe('insufficient_history');
      expect(outcome.baselineNonZeroWeeks).toBe(MIN_BASELINE_OBS);
    });
  });

  describe('Given a sparse but trusted baseline', () => {
    it('When the mean is below one, Then a percentage is still reported and is finite', () => {
      // Three active weeks is the minimum that passes MIN_BASELINE_OBS, so the
      // mean here is small but the comparison is still meaningful.
      const outcome = compareToBaseline({
        reportingCount: 0,
        baselineWeekCounts: [1, 0, 0, 1, 0, 0, 1, 0],
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.baselineMean).toBe(0.4);
      expect(outcome.changePct).toBe(-100);
      expect(Number.isFinite(outcome.changePct)).toBe(true);
      expect(outcome.status).toBe('below');
    });
  });

  describe('Given a baseline that mixes quiet and busy weeks', () => {
    it('When averaging, Then weeks with no activity are included in the mean', () => {
      // Documented interpretation (PLAN.md R10): a quiet week is part of what
      // normal looks like, so zeros are not excluded from the mean.
      const outcome = compareToBaseline({
        reportingCount: 70,
        baselineWeekCounts: [100, 100, 100, 100, 0, 0, 0, 0],
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.baselineMean).toBe(50);
      expect(outcome.status).toBe('above');
    });
  });

  describe('Given fractional baselines', () => {
    it('When the mean is not a whole number, Then it is rounded to one decimal', () => {
      const outcome = compareToBaseline({
        reportingCount: 10,
        baselineWeekCounts: [8, 9, 10, 11, 10, 9, 11, 8],
        availableBaselineWeeks: FULL_HISTORY,
      });
      expect(outcome.baselineMean).toBe(9.5);
    });
  });

  describe('Given the configured band', () => {
    it('Then it is 30% either side of the baseline mean', () => {
      expect(NORMAL_BAND_PCT).toBe(30);
    });
  });
});

/**
 * AC-3.6 — zero-baseline handling.
 *
 * Through `compareToBaseline` an exactly-zero mean is unreachable, because
 * MIN_BASELINE_OBS already rejects a baseline with no active weeks. The rule is
 * therefore verified directly against the banding function it lives in.
 */
describe('classifyAgainstBaseline with a zero baseline (AC-3.6)', () => {
  it('Given a zero baseline and no activity, Then it is typical with no percentage', () => {
    const result = classifyAgainstBaseline(0, 0);
    expect(result.status).toBe('typical');
    expect(result.changePct).toBeNull();
    expect(result.reason).toBe('zero_baseline_no_activity');
  });

  it('Given a zero baseline and new activity, Then it is above with no percentage', () => {
    const result = classifyAgainstBaseline(3, 0);
    expect(result.status).toBe('above');
    expect(result.changePct).toBeNull();
    expect(result.reason).toBe('zero_baseline_new_activity');
  });

  it('Then no result is ever NaN or Infinity', () => {
    for (const reportingCount of [0, 1, 5, 100]) {
      for (const baselineMean of [0, 0.5, 1, 7, 100]) {
        const { changePct } = classifyAgainstBaseline(reportingCount, baselineMean);
        if (changePct !== null) {
          expect(Number.isFinite(changePct)).toBe(true);
        }
      }
    }
  });
});