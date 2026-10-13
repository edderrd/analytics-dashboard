import { INestApplication } from '@nestjs/common';
import { ACCOUNTS, ASOF, createTestApp, http } from './comparison-test-utils';

/**
 * Rule group: multi-location comparison and account scoping (AC-3.8, AC-4.5).
 */
describe('GET /accounts/:id/comparison/locations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Given a 15-location account', () => {
    it('When requesting per-location comparisons, Then every location is present (AC-4.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.locations).toHaveLength(15);
      expect(response.body.locations[0].location).toBe('Site A');
      expect(response.body.locations[14].location).toBe('Site O');
    });

    it('Then each location reports all three event types (AC-3.3)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      for (const entry of response.body.locations) {
        expect(entry.totals.map((t: { eventType: string }) => t.eventType)).toEqual([
          'call_received',
          'lead_created',
          'appointment_set',
        ]);
      }
    });

    it('Then the per-location counts add up to the account total (AC-3.8)', async () => {
      const perLocation = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}`)
        .expect(200);
      const account = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      for (const accountTotal of account.body.totals) {
        const summed = perLocation.body.locations.reduce(
          (sum: number, entry: { totals: { eventType: string; recentCount: number }[] }) => {
            const match = entry.totals.find((t) => t.eventType === accountTotal.eventType);
            return sum + (match?.recentCount ?? 0);
          },
          0,
        );
        expect(summed).toBe(accountTotal.recentCount);
      }
    });

    it('Then locations needing attention are visible as above or below (AC-3.4)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      const statuses = new Set(
        response.body.locations.flatMap((entry: { totals: { status: string }[] }) =>
          entry.totals.map((t) => t.status),
        ),
      );
      expect(statuses.has('above') || statuses.has('below')).toBe(true);
      expect(statuses.has('typical') || statuses.has('insufficient_history')).toBe(true);
    });

    describe('When filtering to specific locations', () => {
      it('Then only those locations are returned (AC-4.5)', async () => {
        const response = await http(app)
          .get(
            `/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}&locations=Site A,Site C`,
          )
          .expect(200);

        expect(response.body.locations.map((l: { location: string }) => l.location)).toEqual([
          'Site A',
          'Site C',
        ]);
      });

      it('When a location belongs to another account, Then 400 is returned (AC-4.5)', async () => {
        // Account 8 is single-site ("Site A"); "Site O" belongs to account 6.
        await http(app)
          .get(`/accounts/${ACCOUNTS.singleSite}/comparison/locations?locations=Site O`)
          .expect(400);
      });
    });
  });

  describe('Given a single-location account', () => {
    it('When requesting per-location comparisons, Then one entry is returned (AC-4.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.singleSite}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.locations).toHaveLength(1);
      expect(response.body.locations[0].location).toBe('Site A');
      expect(response.body.locations[0].totals[0].recentCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Given the zero-activity account', () => {
    it('When requesting per-location comparisons, Then an empty list is returned (AC-4.6)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.zeroActivity}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.locations).toEqual([]);
    });
  });

  describe('Given account scoping (AC-3.3)', () => {
    it('When two accounts are compared, Then neither sees the other locations or totals', async () => {
      const first = await http(app).get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations`).expect(200);
      const second = await http(app).get(`/accounts/12/comparison/locations`).expect(200);

      expect(first.body.locations).toHaveLength(15);
      expect(second.body.locations).toHaveLength(7);
      expect(second.body.locations.every((l: { location: string }) => l.location <= 'Site G')).toBe(
        true,
      );
    });
  });
});