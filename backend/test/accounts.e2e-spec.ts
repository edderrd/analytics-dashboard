import { INestApplication } from '@nestjs/common';
import {
  ACCOUNTS,
  ASOF,
  createTestApp,
  http,
} from './comparison-test-utils';

/**
 * Rule group: account discovery (AC-4.1, AC-4.2, AC-4.3).
 */
describe('Account endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Given the seeded dataset', () => {
    it('When listing accounts, Then all twenty are returned sorted by name (AC-4.1)', async () => {
      const response = await http(app).get('/accounts').expect(200);

      expect(response.body).toHaveLength(20);
      const names: string[] = response.body.map((a: { name: string }) => a.name);
      expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);

      const summit = response.body.find((a: { id: number }) => a.id === ACCOUNTS.multiLocation);
      expect(summit).toMatchObject({
        id: ACCOUNTS.multiLocation,
        name: 'Metro Collision Centers',
        timezone: 'America/New_York',
        locationCount: 15,
      });
    });

    it('When listing a multi-location account, Then every location is returned sorted (AC-4.3)', async () => {
      const response = await http(app)
        .get(`/accounts/${ACCOUNTS.multiLocation}/locations`)
        .expect(200);

      expect(response.body.locations).toHaveLength(15);
      expect(response.body.locations[0]).toBe('Site A');
      expect([...response.body.locations].sort()).toEqual(response.body.locations);
    });

    it('When listing a single-site account, Then one location is returned (AC-4.3)', async () => {
      const response = await http(app).get(`/accounts/${ACCOUNTS.singleSite}/locations`).expect(200);
      expect(response.body.locations).toEqual(['Site A']);
    });

    it('When listing the zero-activity account, Then no locations are returned (AC-4.3)', async () => {
      const response = await http(app).get(`/accounts/${ACCOUNTS.zeroActivity}/locations`).expect(200);
      expect(response.body.locations).toEqual([]);
    });

    it('When fetching one account, Then its detail and creation time are returned (AC-4.2)', async () => {
      const response = await http(app).get(`/accounts/${ACCOUNTS.singleSite}`).expect(200);

      expect(response.body).toMatchObject({
        id: ACCOUNTS.singleSite,
        name: 'Lakeside Physio',
        industry: 'Healthcare',
        timezone: 'America/Chicago',
      });
      expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('When fetching an unknown account, Then 404 is returned (AC-4.6)', async () => {
      await http(app).get('/accounts/9999').expect(404);
    });

    it('When the id is not a number, Then 400 is returned (AC-4.6)', async () => {
      await http(app).get('/accounts/not-a-number').expect(400);
    });
  });
});