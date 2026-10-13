import {
  addDays,
  dayOfWeek,
  daysBetween,
  isValidLocalDate,
  parseLocalDate,
  startOfWeek,
} from './local-date';

/**
 * AC-3.1 — reporting-period boundaries are computed on account-local calendar
 * dates, and weeks start on Monday.
 */
describe('local calendar rules (AC-3.1)', () => {
  describe('Given a valid ISO date', () => {
    it('When parsing it, Then it yields the expected parts', () => {
      // Given
      const value = '2026-07-27';
      // When
      const parts = parseLocalDate(value);
      // Then
      expect(parts).toEqual({ year: 2026, month: 7, day: 27 });
    });

    it('When validating it, Then a well-formed date is accepted', () => {
      expect(isValidLocalDate('2026-02-01')).toBe(true);
      expect(isValidLocalDate('2026-13-01')).toBe(false);
      expect(isValidLocalDate('2026-02-30')).toBe(false);
      expect(isValidLocalDate('27-07-2026')).toBe(false);
    });
  });

  describe('Given the seeded dataset end date', () => {
    it('When locating the weekday, Then 2026-07-27 is a Monday', () => {
      expect(dayOfWeek('2026-07-27')).toBe(0);
    });

    it('When finding the start of the week, Then Monday is returned unchanged', () => {
      expect(startOfWeek('2026-07-27')).toBe('2026-07-27');
    });

    it('When the date is mid-week, Then the preceding Monday is returned', () => {
      expect(startOfWeek('2026-07-26')).toBe('2026-07-20');
      expect(startOfWeek('2026-07-22')).toBe('2026-07-20');
    });

    it('When the date is a Sunday, Then the week still starts on Monday', () => {
      // Sunday is the last day of the week, not the first.
      expect(dayOfWeek('2026-07-26')).toBe(6);
      expect(startOfWeek('2026-07-26')).toBe('2026-07-20');
    });
  });

  describe('When crossing a month or year boundary', () => {
    it('Then days are added on the calendar, not by fixed millisecond offsets', () => {
      expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
      expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
      expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
      expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('Then day differences are counted inclusively of neither endpoint', () => {
      expect(daysBetween('2026-07-20', '2026-07-27')).toBe(7);
      expect(daysBetween('2026-07-20', '2026-07-20')).toBe(0);
      expect(daysBetween('2026-07-27', '2026-07-20')).toBe(-7);
    });
  });
});