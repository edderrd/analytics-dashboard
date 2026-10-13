import { resolveComparisonPeriods } from './comparison-periods';
import {
  BASELINE_WEEKS,
  MIN_BASELINE_WEEKS,
  NORMAL_BAND_PCT,
} from '../comparison.constants';

/**
 * AC-3.2 — the reporting week is the complete week before `asOf`, and the
 * baseline is the eight complete weeks before that. Nothing here may depend on
 * the current clock.
 */
describe('comparison periods (AC-3.2)', () => {
  describe('Given asOf on the last seeded Monday', () => {
    const periods = resolveComparisonPeriods('2026-07-27');

    it('When resolving the reporting week, Then it matches the fixture', () => {
      expect(periods.reportingStartLocal).toBe('2026-07-20');
      expect(periods.reportingEndLocal).toBe('2026-07-26');
    });

    it('When resolving the baseline window, Then it matches the fixture', () => {
      expect(periods.baselineStartLocal).toBe('2026-05-25');
      expect(periods.baselineEndLocal).toBe('2026-07-19');
    });

    it('When counting baseline weeks, Then there are eight distinct Mondays', () => {
      expect(periods.baselineWeekStartsLocal).toHaveLength(BASELINE_WEEKS);
      expect(periods.baselineWeekStartsLocal[0]).toBe('2026-07-13');
      expect(periods.baselineWeekStartsLocal.at(-1)).toBe('2026-05-25');
      expect(new Set(periods.baselineWeekStartsLocal).size).toBe(BASELINE_WEEKS);
    });

    it('When checking the current week, Then it is the partial week that is excluded', () => {
      expect(periods.currentWeekStartLocal).toBe('2026-07-27');
    });
  });

  describe('Given asOf in the middle of a week', () => {
    it('When resolving periods, Then the same reporting week is produced', () => {
      // 2026-07-29 (Wednesday) sits in the same Monday-start week as
      // 2026-07-27, so both name the same reporting week.
      const wednesday = resolveComparisonPeriods('2026-07-29');
      const monday = resolveComparisonPeriods('2026-07-27');
      expect(wednesday.currentWeekStartLocal).toBe('2026-07-27');
      expect(wednesday.reportingStartLocal).toBe(monday.reportingStartLocal);
      expect(wednesday.reportingStartLocal).toBe('2026-07-20');
    });

    it('When asOf is the Sunday that ends the week, Then that week becomes the reporting week', () => {
      // The rule is "the complete week before the week containing asOf", so a
      // Sunday belongs to its own week rather than the next one.
      const sunday = resolveComparisonPeriods('2026-07-26');
      expect(sunday.currentWeekStartLocal).toBe('2026-07-20');
      expect(sunday.reportingStartLocal).toBe('2026-07-13');
    });
  });

  describe('Given the configuration constants', () => {
    it('Then they hold the values agreed in PLAN.md', () => {
      expect(BASELINE_WEEKS).toBe(8);
      expect(MIN_BASELINE_WEEKS).toBe(4);
      expect(NORMAL_BAND_PCT).toBe(30);
    });
  });
});