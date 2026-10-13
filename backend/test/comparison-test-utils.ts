import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * Shared setup for Supertest integration specs.
 *
 * These run against the compose `db` service, seeded by `npm run migrate &&
 * npm run seed`, and always pass an explicit `asOf` so results do not depend on
 * the current date (AC-6.5).
 */
export const ASOF = '2026-07-27';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

export function http(app: INestApplication) {
  return supertest(app.getHttpServer());
}

/** The three account shapes the dashboard has to handle (PLAN.md R2). */
export const ACCOUNTS = {
  /** Metro Collision Centers — 15 locations. */
  multiLocation: 6,
  /** Lakeside Physio — single location. */
  singleSite: 8,
  /** Quiet Harbor Spa — no activity at all. */
  zeroActivity: 20,
} as const;