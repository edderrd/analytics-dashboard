import { INestApplication } from '@nestjs/common';
import { ACCOUNTS, ASOF, createTestApp, http } from './comparison-test-utils';

/**
 * Rule group: "is this week normal for us?" — the account-level comparison
 * (AC-3.2, AC-3.3, AC-4.4).
 */
describe('GET /accounts/:id/comparison', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Given a multi-location account and asOf on the last seeded Monday', () => {
    it('When requesting the comparison, Then the fixture reporting week is used (AC-3.2)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.periods).toMatchObject({
        asOf: ASOF,
        timezone: 'America/New_York',
        reportingWeekStartLocal: '2026-07-20',
        reportingWeekEndLocal: '2026-07-26',
        baselineWindowStartLocal: '2026-05-25',
        baselineWindowEndLocal: '2026-07-19',
        baselineWeeks: 8,
      });
      expect(response.body.periods.reportingWeekStartUtc).toBe('2026-07-20T04:00:00.000Z');
      expect(response.body.hasActivity).toBe(true);
    });

    it('Then one comparison is returned per event type (AC-3.3)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.totals.map((t: { eventType: string }) => t.eventType)).toEqual([
        'call_received',
        'lead_created',
        'appointment_set',
      ]);
    });

    it('Then totals match an independent count of the seeded data (AC-3.3)', async () => {
      // Verified against the dataset: account 6 has 51 calls, 17 leads and 19
      // appointments in 2026-07-20..2026-07-26 (local), and a baseline of
      // 818 / 344 / 207 events across the eight baseline weeks.
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      const byType = Object.fromEntries(
        response.body.totals.map((t: { eventType: string }) => [t.eventType, t]),
      );

      expect(byType.call_received.recentCount).toBe(51);
      expect(byType.lead_created.recentCount).toBe(17);
      expect(byType.appointment_set.recentCount).toBe(19);

      expect(byType.call_received.baselineMean).toBe(102.3);
      expect(byType.lead_created.baselineMean).toBe(43);
      expect(byType.appointment_set.baselineMean).toBe(25.9);
    });

    it('Then the status follows the +/-30% band (AC-3.4)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      const byType = Object.fromEntries(
        response.body.totals.map((t: { eventType: string }) => [t.eventType, t]),
      );

      // -50.1% and -60.5% are outside the band; -26.6% is inside it.
      expect(byType.call_received).toMatchObject({ status: 'below', changePct: -50.1 });
      expect(byType.lead_created).toMatchObject({ status: 'below' });
      expect(byType.appointment_set).toMatchObject({
        status: 'typical',
        reason: 'within_normal_band',
      });
    });

    it('Then an account with enough history is never reported as insufficient (AC-3.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      for (const total of response.body.totals) {
        expect(total.status).not.toBe('insufficient_history');
        expect(total.availableBaselineWeeks).toBe(8);
      }
    });
  });

  describe('Given a Pacific time zone account', () => {
    it('When requesting the comparison, Then week boundaries are account-local (AC-3.1)', async () => {
      // Redline Tire & Service, America/Los_Angeles.
      const response = await http(app).get('/accounts/12/comparison?asOf=2026-07-27').expect(200);

      // PDT = UTC-7, so local Monday 00:00 is 07:00 UTC.
      expect(response.body.periods.reportingWeekStartUtc).toBe('2026-07-20T07:00:00.000Z');
      expect(response.body.periods.reportingWeekEndExclusiveUtc).toBe(
        '2026-07-27T07:00:00.000Z',
      );
      expect(response.body.totals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ eventType: 'call_received', recentCount: 30 }),
        ]),
      );
    });
  });

  describe('Given the zero-activity account', () => {
    it('When requesting the comparison, Then an explicit empty state is returned, not an error (AC-3.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.zeroActivity}/comparison?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.hasActivity).toBe(false);
      expect(response.body.locations).toEqual([]);
      for (const total of response.body.totals) {
        expect(total).toMatchObject({
          recentCount: 0,
          baselineMean: null,
          changePct: null,
          status: 'insufficient_history',
          reason: 'not_enough_history',
        });
      }
    });
  });

  describe('Given asOf before the account has history', () => {
    it('When requesting the comparison, Then insufficient history is reported (AC-3.5, R3)', async () => {
      // The dataset starts 2026-02-01; this reporting week precedes it.
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=2026-02-23`)
        .expect(200);

      expect(response.body.periods.reportingWeekStartLocal).toBe('2026-02-16');
      for (const total of response.body.totals) {
        expect(total.status).toBe('insufficient_history');
        expect(total.baselineMean).toBeNull();
        expect(total.changePct).toBeNull();
      }
    });
  });

  describe('Given a request with filters or bad parameters', () => {
    it('When eventTypes is supplied, Then only those types are returned (AC-4.4)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&eventTypes=call_received`)
        .expect(200);

      expect(response.body.totals).toHaveLength(1);
      expect(response.body.totals[0].eventType).toBe('call_received');
    });

    it('When several event types are supplied, Then all of them are returned (AC-4.4)', async () => {
      const response = await http(app)
        .get(
          `/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&eventTypes=call_received,lead_created`,
        )
        .expect(200);

      expect(response.body.totals.map((t: { eventType: string }) => t.eventType)).toEqual([
        'call_received',
        'lead_created',
      ]);
    });

    it('When asOf is malformed, Then 400 is returned (AC-4.6)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=27-07-2026`)
        .expect(400);
    });

    it('When asOf is not a real date, Then 400 is returned (AC-4.6)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=2026-02-30`)
        .expect(400);
    });

    it('When eventTypes is unknown, Then 400 is returned (AC-4.6)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?eventTypes=teleportation`)
        .expect(400);
    });

    it('When an unknown query parameter is supplied, Then 400 is returned (AC-4.6)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?colour=blue`)
        .expect(400);
    });

    it('When the account does not exist, Then 404 is returned (AC-4.6)', async () => {
      await http(app).get('/accounts/9999/comparison').expect(404);
    });

    it('When asOf is omitted, Then the dataset end date drives the periods (AC-4.4)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison`)
        .expect(200);

      // The latest event in the dataset is 2026-07-27.
      expect(response.body.periods.reportingWeekStartLocal).toBe('2026-07-20');
    });
  });
});