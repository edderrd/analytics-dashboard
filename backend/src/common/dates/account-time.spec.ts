import {
  isValidTimeZone,
  localTimeToUtc,
  utcToLocalDate,
  weekBoundsUtc,
} from './account-time';

/**
 * AC-3.1 — account-local week boundaries must resolve to the correct UTC
 * instants, including across daylight-saving transitions.
 */
describe('account-local time conversion (AC-3.1)', () => {
  describe('Given an account in UTC', () => {
    const zone = 'UTC';

    it('When resolving local midnight, Then it is midnight UTC', () => {
      expect(localTimeToUtc('2026-07-20', 0, 0, 0, zone).toISOString()).toBe(
        '2026-07-20T00:00:00.000Z',
      );
    });

    it('When formatting a UTC instant, Then the date is unchanged', () => {
      expect(utcToLocalDate(new Date('2026-07-20T23:30:00Z'), zone)).toBe('2026-07-20');
    });
  });

  describe('Given an account in America/Chicago during standard time', () => {
    const zone = 'America/Chicago';

    it('When resolving local midnight, Then the UTC instant is offset by 6 hours', () => {
      // CST = UTC-6 in early March, before the DST switch on 2026-03-08.
      expect(localTimeToUtc('2026-03-02', 0, 0, 0, zone).toISOString()).toBe(
        '2026-03-02T06:00:00.000Z',
      );
    });
  });

  describe('Given an account in America/Chicago after the DST switch', () => {
    const zone = 'America/Chicago';

    it('When resolving local midnight, Then the offset is 5 hours', () => {
      // CDT = UTC-5 from 2026-03-08 onwards.
      expect(localTimeToUtc('2026-03-09', 0, 0, 0, zone).toISOString()).toBe(
        '2026-03-09T05:00:00.000Z',
      );
    });

    it('When a week spans the DST switch, Then its UTC length is 6d23h', () => {
      const week = weekBoundsUtc('2026-03-02', zone);
      const hours =
        (week.endExclusiveUtc.getTime() - week.startUtc.getTime()) / 3_600_000;
      expect(hours).toBe(167);
    });
  });

  describe('Given an account in America/Los_Angeles', () => {
    const zone = 'America/Los_Angeles';

    it('When resolving the reporting week start, Then it is 07:00 UTC', () => {
      expect(localTimeToUtc('2026-07-20', 0, 0, 0, zone).toISOString()).toBe(
        '2026-07-20T07:00:00.000Z',
      );
    });

    it('When an instant is just after local midnight, Then the local date is that day', () => {
      expect(utcToLocalDate(new Date('2026-07-20T07:30:00Z'), zone)).toBe('2026-07-20');
    });

    it('When an instant is just before local midnight, Then the local date is still that day', () => {
      // 06:59 UTC is 23:59 local on 2026-07-19 in Los Angeles.
      expect(utcToLocalDate(new Date('2026-07-20T06:59:00Z'), zone)).toBe('2026-07-19');
    });
  });

  describe('Given a week boundary request', () => {
    it('When resolving it, Then the end is exclusive and the next local Monday', () => {
      const week = weekBoundsUtc('2026-07-20', 'America/New_York');
      expect(week.startLocal).toBe('2026-07-20');
      expect(week.endLocal).toBe('2026-07-26');
      expect(week.startUtc.toISOString()).toBe('2026-07-20T04:00:00.000Z');
      expect(week.endExclusiveUtc.toISOString()).toBe('2026-07-27T04:00:00.000Z');
    });
  });

  describe('When checking zone identifiers', () => {
    it('Then known IANA zones are accepted and nonsense is rejected', () => {
      expect(isValidTimeZone('America/Chicago')).toBe(true);
      expect(isValidTimeZone('UTC')).toBe(true);
      expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    });
  });
});