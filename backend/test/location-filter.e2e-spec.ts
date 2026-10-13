import { INestApplication } from '@nestjs/common';
import { ACCOUNTS, ASOF, createTestApp, http } from './comparison-test-utils';

/**
 * Rule group: filtering the comparison by location (AC-4.7, AC-3.9).
 *
 * A single location picker has to narrow both the per-location view and the
 * account-level totals, must never widen the account's own scope, and must
 * reject locations that do not belong to the account.
 */
describe('Location filtering', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Given a multi-location account with no filter', () => {
    it('When requesting the account comparison, Then the whole account is in scope (AC-4.7)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.filteredLocations).toBeNull();
      expect(response.body.locations).toHaveLength(15);
    });

    it('When requesting per-location comparisons, Then every location is returned (AC-4.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}`)
        .expect(200);

      expect(response.body.locations).toHaveLength(15);
    });
  });

  describe('Given a single location is selected', () => {
    it('When requesting the account comparison, Then totals match that location alone (AC-4.7)', async () => {
      const account = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&locations=Site A`)
        .expect(200);
      const perLocation = await http(app)
        .get(
          `/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}&locations=Site A`,
        )
        .expect(200);

      expect(account.body.filteredLocations).toEqual(['Site A']);
      // The account-level view filtered to one site must equal that site's row.
      expect(account.body.totals).toEqual(perLocation.body.locations[0].totals);
    });

    it('Then the full location list is still returned so a picker can be built (AC-4.7)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&locations=Site A`)
        .expect(200);

      expect(response.body.locations).toHaveLength(15);
    });

    it('When requesting per-location comparisons, Then only that location is returned (AC-4.5)', async () => {
      const response = await http(app)
        .get(
          `/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}&locations=Site A`,
        )
        .expect(200);

      expect(response.body.locations).toHaveLength(1);
      expect(response.body.locations[0].location).toBe('Site A');
    });

    it('Then filtering narrows the totals rather than leaving them unchanged (AC-3.9)', async () => {
      const all = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}`)
        .expect(200);
      const filtered = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&locations=Site A`)
        .expect(200);

      const sum = (body: { totals: { eventType: string; recentCount: number }[] }, type: string) =>
        body.totals.find((total) => total.eventType === type)?.recentCount ?? 0;

      // 51 calls across 15 sites cannot also equal one site's calls.
      expect(sum(filtered.body, 'call_received')).toBeLessThan(sum(all.body, 'call_received'));
    });
  });

  describe('Given several locations are selected', () => {
    it('Then the totals equal the sum of exactly those locations (AC-3.9)', async () => {
      const filtered = await http(app)
        .get(
          `/accounts/${ACCOUNTS.multiLocation}/comparison?asOf=${ASOF}&locations=Site A,Site B`,
        )
        .expect(200);

      expect(filtered.body.filteredLocations).toEqual(['Site A', 'Site B']);

      const perLocation = await http(app)
        .get(
          `/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}&locations=Site A,Site B`,
        )
        .expect(200);

      for (const accountTotal of filtered.body.totals) {
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

    it('Then the same set of locations is returned, in account order (AC-4.7)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/comparison/locations?asOf=${ASOF}&locations=Site C,Site A`)
        .expect(200);

      expect(response.body.locations.map((l: { location: string }) => l.location)).toEqual([
        'Site A',
        'Site C',
      ]);
    });
  });

  describe('Given a location that does not belong to the account', () => {
    it('When filtering the account comparison, Then 400 is returned (AC-4.7)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.singleSite}/comparison?locations=Site O`)
        .expect(400);
    });

    it('When filtering the per-location comparison, Then 400 is returned (AC-4.7)', async () => {
      await http(app)
        .get(`/accounts/${ACCOUNTS.singleSite}/comparison/locations?locations=Site O`)
        .expect(400);
    });

    it('When one valid and one unknown location are mixed, Then the whole request is rejected (AC-4.7)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.singleSite}/comparison?locations=Site A,Site ZZZ`)
        .expect(400);
      expect(response.body.message).toMatch(/Site ZZZ/);
    });
  });

  describe('Given a filter is applied to the zero-activity account', () => {
    it('Then the empty state is preserved rather than erroring (AC-3.5)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.zeroActivity}/comparison?locations=Site A`)
        .expect(400);

      // No locations exist for this account, so even "Site A" is unknown.
      expect(response.body.message).toMatch(/Site A/);
    });
  });

  describe('Given account scoping (AC-3.3)', () => {
    it('Then filtering one account cannot reach another account’s locations', async () => {
      // Account 12 has Site A–G; Site O belongs to account 6 only.
      const response = await http(app).get('/accounts/12/comparison?locations=Site A').expect(200);
      expect(response.body.filteredLocations).toEqual(['Site A']);

      await http(app).get('/accounts/12/comparison?locations=Site H').expect(400);
    });
  });
});