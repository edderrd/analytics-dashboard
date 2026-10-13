import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { createTestApp, http } from './comparison-test-utils';
import { dataSourceOptions } from '../src/database/data-source';
import { registerUtcTimestampParser } from '../src/database/pg-timestamp';

/**
 * Rule group: edge cases the seeded dataset cannot reach on its own (AC-3.5,
 * AC-3.6, AC-3.7, AC-3.1).
 *
 * The supplied data has ~25 weeks of history for every account with activity,
 * so `MIN_BASELINE_WEEKS` and a zero baseline are unreachable through the
 * fixtures (PLAN.md R3, R11). These scenarios build the exact situations the
 * rules exist for, in the isolated `relay_test` database — never in the
 * reference database seeded from `seed.sql` (AC-2.3).
 *
 * All synthetic rows use ids far outside the seeded range and are deleted in
 * `afterAll`.
 */

/** Reporting week used throughout: asOf 2026-07-27 -> 2026-07-20..2026-07-26. */
const ASOF = '2026-07-27';

/** Synthetic account ids, chosen well clear of the seeded 1..20. */
const SYNTHETIC_ACCOUNTS = {
  /** Baseline is all zeros (activity only in the reporting week). */
  zeroBaseline: 9001,
  /** Only two complete weeks of history -> below MIN_BASELINE_WEEKS. */
  tooLittleHistory: 9002,
  /** History long enough, but only two active baseline weeks. */
  tooFewObservations: 9003,
  /** Exactly MIN_BASELINE_OBS active weeks -> a comparison is allowed. */
  exactlyMinimumObservations: 9004,
  /** A non-call event with a NULL duration_seconds and NULL outcome. */
  nulls: 9005,
  /** America/Chicago, to check DST-aware boundaries through the API. */
  chicago: 9006,
};

let app: INestApplication;
let dataSource: DataSource;

/**
 * Timestamps are written as UTC wall-clock literals, never as JS `Date`s.
 * node-postgres formats a `Date` using the process time zone, which is exactly
 * the bug recorded in PLAN.md R6.
 */

/** Inserts one event; `occurredAt` is a UTC wall clock. */
async function insertEvent(
  id: number,
  accountId: number,
  occurredAt: string,
  overrides: Partial<{
    location: string;
    eventType: string;
    durationSeconds: number | null;
    outcome: string | null;
  }> = {},
) {
  await dataSource.query(
    `INSERT INTO activity_events
       (id, account_id, location, event_type, occurred_at, duration_seconds, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      accountId,
      overrides.location ?? 'Site A',
      overrides.eventType ?? 'call_received',
      occurredAt,
      overrides.durationSeconds === undefined ? 60 : overrides.durationSeconds,
      overrides.outcome === undefined ? 'connected' : overrides.outcome,
    ],
  );
}

async function insertAccount(id: number, name: string, timezone: string) {
  await dataSource.query(
    `INSERT INTO accounts (id, name, industry, timezone, created_at)
     VALUES ($1, $2, 'Test', $3, $4)`,
    [id, name, timezone, '2026-01-01 00:00:00'],
  );
}

/** Event ids used by the synthetic fixtures, kept disjoint per account. */
let nextEventId = 500_000;

/**
 * Dates well before the baseline window. `availableBaselineWeeks` is measured
 * from the account's earliest activity, so an account needs history *behind*
 * the window to be comparable at all — events here contribute depth only.
 */
const DEEP_HISTORY_DATES = ['2026-03-02', '2026-03-16', '2026-04-06', '2026-04-20'];

/** The eight complete baseline weeks before the reporting week. */
const BASELINE_WEEK_STARTS = [
  '2026-07-13',
  '2026-07-06',
  '2026-06-29',
  '2026-06-22',
  '2026-06-15',
  '2026-06-08',
  '2026-06-01',
  '2026-05-25',
];

async function seedSyntheticFixtures() {
  const {
    zeroBaseline,
    tooLittleHistory,
    tooFewObservations,
    exactlyMinimumObservations,
    nulls,
    chicago,
  } = SYNTHETIC_ACCOUNTS;

  await insertAccount(zeroBaseline, 'Synthetic Zero Baseline', 'UTC');
  await insertAccount(tooLittleHistory, 'Synthetic Too Little History', 'UTC');
  await insertAccount(tooFewObservations, 'Synthetic Too Few Observations', 'UTC');
  await insertAccount(exactlyMinimumObservations, 'Synthetic Exactly Minimum', 'UTC');
  await insertAccount(nulls, 'Synthetic Nulls', 'UTC');
  await insertAccount(chicago, 'Synthetic Chicago DST', 'America/Chicago');

  // Deep history so every account except the deliberately-shallow one has the
  // full four weeks of history MIN_BASELINE_WEEKS requires.
  for (const accountId of [zeroBaseline, tooFewObservations, exactlyMinimumObservations, nulls, chicago]) {
    for (const date of DEEP_HISTORY_DATES) {
      await insertEvent(nextEventId++, accountId, `${date} 12:00:00`);
    }
  }

  // Zero baseline for leads: the account has a full call history (so it is
  // comparable at all) but no lead activity until the reporting week.
  for (const weekStart of BASELINE_WEEK_STARTS) {
    await insertEvent(nextEventId++, zeroBaseline, `${weekStart} 12:00:00`);
    await insertEvent(nextEventId++, zeroBaseline, `${weekStart} 13:00:00`);
  }
  await insertEvent(nextEventId++, zeroBaseline, '2026-07-21 12:00:00', {
    eventType: 'lead_created',
  });

  // Only two complete weeks of history, all inside the reporting period.
  await insertEvent(nextEventId++, tooLittleHistory, '2026-07-21 12:00:00');
  await insertEvent(nextEventId++, tooLittleHistory, '2026-07-22 12:00:00');

  // History reaches back far enough, but only two baseline weeks carry calls.
  for (const weekStart of BASELINE_WEEK_STARTS) {
    await insertEvent(nextEventId++, tooFewObservations, `${weekStart} 12:00:00`, {
      eventType: 'appointment_set',
    });
  }
  await insertEvent(nextEventId++, tooFewObservations, '2026-07-14 12:00:00');
  await insertEvent(nextEventId++, tooFewObservations, '2026-07-07 12:00:00');
  await insertEvent(nextEventId++, tooFewObservations, '2026-07-22 12:00:00');

  // Exactly MIN_BASELINE_OBS active baseline weeks: 07-13, 07-06, 06-29.
  await insertEvent(nextEventId++, exactlyMinimumObservations, '2026-07-14 12:00:00');
  await insertEvent(nextEventId++, exactlyMinimumObservations, '2026-07-07 12:00:00');
  await insertEvent(nextEventId++, exactlyMinimumObservations, '2026-06-30 12:00:00');
  // The remaining weeks keep the account's history deep enough to compare.
  for (const weekStart of ['2026-06-22', '2026-06-15', '2026-06-08', '2026-06-01', '2026-05-25']) {
    await insertEvent(nextEventId++, exactlyMinimumObservations, `${weekStart} 12:00:00`, {
      eventType: 'appointment_set',
    });
  }
  // Reporting week deliberately different, so the status is unambiguous.
  await insertEvent(nextEventId++, exactlyMinimumObservations, '2026-07-21 12:00:00');

  // A non-call event with NULL duration_seconds and NULL outcome.
  await insertEvent(nextEventId++, nulls, '2026-07-21 09:00:00', {
    eventType: 'lead_created',
    durationSeconds: null,
    outcome: null,
  });
  // ... alongside enough history to be comparable.
  for (const day of ['2026-07-14', '2026-07-07', '2026-06-30']) {
    await insertEvent(nextEventId++, nulls, `${day} 09:00:00`, {
      eventType: 'lead_created',
      durationSeconds: null,
      outcome: null,
    });
  }

  // Chicago: one event at 00:30 local on the Monday boundary of the reporting
  // week, and one at 23:30 local on the Sunday, to prove local-week edges.
  await insertEvent(nextEventId++, chicago, '2026-07-20 05:30:00'); // 00:30 CDT Mon
  await insertEvent(nextEventId++, chicago, '2026-07-27 04:30:00'); // 23:30 CDT Sun
}

async function removeSyntheticFixtures() {
  const ids = Object.values(SYNTHETIC_ACCOUNTS);
  await dataSource.query(`DELETE FROM activity_events WHERE account_id = ANY($1::int[])`, [
    ids,
  ]);
  await dataSource.query(`DELETE FROM accounts WHERE id = ANY($1::int[])`, [ids]);
}

describe('Edge cases unreachable in the seeded dataset', () => {
  beforeAll(async () => {
    registerUtcTimestampParser();
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
    await seedSyntheticFixtures();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await removeSyntheticFixtures();
    await dataSource.destroy();
  });

  /**
   * AC-3.6 through the API.
   *
   * Note what the rule actually does end to end: an event type with no
   * baseline activity has zero non-zero baseline weeks, so `MIN_BASELINE_OBS`
   * rejects it *before* the zero-baseline branch is reached (PLAN.md R11). The
   * API therefore reports a structured "insufficient history" state rather than
   * the `above / zero_baseline_new_activity` status. What matters for the
   * customer — and what is asserted here — is that nothing is fabricated: no
   * percentage, no NaN, and a clear reason.
   *
   * The zero-mean branch itself is covered directly in
   * `compare-to-baseline.spec.ts` via `classifyAgainstBaseline`.
   */
  describe('Given an event type with no baseline activity at all (AC-3.6)', () => {
    it('Then the count is still reported, with no fabricated percentage', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.zeroBaseline}/comparison?asOf=${ASOF}`)
        .expect(200);

      const leads = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'lead_created',
      );

      // One lead this week, against a baseline that has never seen one.
      expect(leads.recentCount).toBe(1);
      expect(leads.baselineNonZeroWeeks).toBe(0);
      expect(leads.changePct).toBeNull();
      expect(leads.baselineMean).toBeNull();
      expect(leads.status).toBe('insufficient_history');
      expect(leads.reason).toBe('not_enough_observations');
    });

    it('Then no comparison value is ever NaN or Infinity', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.zeroBaseline}/comparison?asOf=${ASOF}`)
        .expect(200);

      for (const total of response.body.totals) {
        for (const value of [total.baselineMean, total.changePct]) {
          if (value !== null) expect(Number.isFinite(value)).toBe(true);
        }
      }
    });

    it('Then a comparable event type on the same account is unaffected', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.zeroBaseline}/comparison?asOf=${ASOF}`)
        .expect(200);

      const calls = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'call_received',
      );

      expect(calls.status).not.toBe('insufficient_history');
      expect(calls.baselineMean).toBeGreaterThan(0);
      expect(Number.isFinite(calls.changePct)).toBe(true);
    });
  });

  describe('Given an account with fewer than four complete baseline weeks (AC-3.5)', () => {
    it('Then the comparison reports insufficient history rather than guessing', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.tooLittleHistory}/comparison?asOf=${ASOF}`)
        .expect(200);

      for (const total of response.body.totals) {
        expect(total.status).toBe('insufficient_history');
        expect(total.reason).toBe('not_enough_history');
        expect(total.baselineMean).toBeNull();
        expect(total.changePct).toBeNull();
      }
    });
  });

  describe('Given an account with fewer than three active baseline weeks (AC-3.5)', () => {
    it('Then the comparison reports insufficient observations', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.tooFewObservations}/comparison?asOf=${ASOF}`)
        .expect(200);

      const calls = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'call_received',
      );

      expect(calls.baselineNonZeroWeeks).toBe(2);
      expect(calls.status).toBe('insufficient_history');
      expect(calls.reason).toBe('not_enough_observations');
    });
  });

  describe('Given an account with exactly three active baseline weeks (AC-3.5)', () => {
    it('Then a comparison is produced, because the minimum is met exactly', async () => {
      const response = await http(app)
        .get(
          `/accounts/${SYNTHETIC_ACCOUNTS.exactlyMinimumObservations}/comparison?asOf=${ASOF}`,
        )
        .expect(200);

      const calls = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'call_received',
      );

      expect(calls.baselineNonZeroWeeks).toBe(3);
      expect(calls.status).not.toBe('insufficient_history');
      // One call in each active week -> the reporting week matches the baseline.
      expect(calls.baselineMean).toBe(0.4);
      expect(calls.status).toBe('above');
    });
  });

  describe('Given events with NULL duration_seconds and NULL outcome (AC-3.7)', () => {
    it('Then they are still counted, because comparison counts events', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.nulls}/comparison?asOf=${ASOF}`)
        .expect(200);

      const leads = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'lead_created',
      );

      expect(leads.recentCount).toBe(1);
      expect(leads.status).not.toBe('insufficient_history');
    });
  });

  describe('Given an account in a zone with daylight saving (AC-3.1)', () => {
    it('Then the reporting week resolves to account-local Monday boundaries', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.chicago}/comparison?asOf=${ASOF}`)
        .expect(200);

      const periods = response.body.periods;
      expect(periods.timezone).toBe('America/Chicago');
      expect(periods.reportingWeekStartLocal).toBe('2026-07-20');
      expect(periods.reportingWeekEndLocal).toBe('2026-07-26');

      // CDT is UTC-5 in July, so local Monday 00:00 is 05:00 UTC.
      expect(periods.reportingWeekStartUtc).toBe('2026-07-20T05:00:00.000Z');
      expect(periods.reportingWeekEndExclusiveUtc).toBe('2026-07-27T05:00:00.000Z');
    });

    it('Then events just inside both local edges fall in the reporting week', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.chicago}/comparison?asOf=${ASOF}`)
        .expect(200);

      const calls = response.body.totals.find(
        (t: { eventType: string }) => t.eventType === 'call_received',
      );

      // 00:30 Monday local and 23:30 Sunday local are both in the week; a
      // UTC-based boundary would have excluded or misplaced the first one.
      expect(calls.recentCount).toBe(2);
    });

    it('Then the baseline window is also resolved in account-local time', async () => {
      const response = await http(app)
        .get(`/accounts/${SYNTHETIC_ACCOUNTS.chicago}/comparison?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.periods.baselineWindowStartLocal).toBe('2026-05-25');
      expect(response.body.periods.baselineWindowEndLocal).toBe('2026-07-19');
    });
  });
});