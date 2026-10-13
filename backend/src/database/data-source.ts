import { DataSource, type LogLevel } from 'typeorm';
// Not re-exported from the package root in TypeORM 0.3.x.
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import { registerUtcTimestampParser } from './pg-timestamp';
import { env } from '../config';

import { ActivityEvent } from './entities/activity-event.entity';
import { Account } from './entities/account.entity';
import { InitialSchema1710000000000 } from './migrations/1710000000000-InitialSchema';

const isProductionLike = env.NODE_ENV === 'production';

const logging: LogLevel[] = isProductionLike
  ? ['error']
  : ['error', 'warn'];

/**
 * Single TypeORM DataSource used by both the Nest app and the CLI
 * (migrations, seed runner).
 *
 * `occurred_at` / `created_at` are stored without a time zone, matching
 * schema.sql. The session time zone is pinned to UTC so the driver never
 * applies a server-local offset when reading or writing those columns
 * (PLAN.md section 3, AC-3.1).
 */
export const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  // Postgres has no `timezone` DataSource option in TypeORM 0.3.x; the session
  // time zone is pinned through libpq options instead.
  extra: {
    options: '-c timezone=UTC',
  },
  entities: [Account, ActivityEvent],
  migrations: [InitialSchema1710000000000],
  migrationsTableName: 'relay_migrations',
  synchronize: false,
  logging,
};

registerUtcTimestampParser();

export const AppDataSource = new DataSource(dataSourceOptions);