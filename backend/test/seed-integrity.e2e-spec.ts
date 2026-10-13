import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { dataSourceOptions } from '../src/database/data-source';
import { registerUtcTimestampParser } from '../src/database/pg-timestamp';

/**
 * Rule group: the supplied dataset is preserved exactly (AC-2.3, AC-2.4).
 *
 * Runs the same verifiers used in Phase 1 as executable tests, so a drift
 * between `seed.sql` and the checked-in module (or the database) fails the
 * suite rather than being discovered by hand.
 */
const backendRoot = join(__dirname, '..');

function runScript(script: string, extraEnv: Record<string, string> = {}) {
  return spawnSync('node', [script], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

describe('Seed integrity (AC-2.3, AC-2.4)', () => {
  describe('Given the checked-in seed module and the raw seed.sql', () => {
    it('When they are compared field by field, Then every row matches (AC-2.3)', () => {
      const result = runScript('scripts/verify-seed-data.mjs');
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/matches seed\.sql exactly/i);
    });
  });

  describe('Given a migrated and seeded test database', () => {
    let dataSource: DataSource;

    beforeAll(async () => {
      registerUtcTimestampParser();
      dataSource = new DataSource(dataSourceOptions);
      await dataSource.initialize();
    });

    afterAll(async () => {
      await dataSource.destroy();
    });

    it('Then it holds exactly the seeded accounts and events (AC-2.3)', async () => {
      const [{ accounts }] = await dataSource.query(
        `SELECT COUNT(*)::int AS accounts FROM accounts`,
      );
      const [{ events }] = await dataSource.query(
        `SELECT COUNT(*)::int AS events FROM activity_events`,
      );

      expect(accounts).toBe(20);
      expect(events).toBe(12626);
    });

    it('Then no event points at a missing account (AC-2.4)', async () => {
      const [{ orphans }] = await dataSource.query(
        `SELECT COUNT(*)::int AS orphans
           FROM activity_events e
           LEFT JOIN accounts a ON a.id = e.account_id
          WHERE a.id IS NULL`,
      );
      expect(orphans).toBe(0);
    });

    it('Then timestamps are stored as the UTC wall clock from the source (AC-2.4)', async () => {
      const [row] = await dataSource.query(
        `SELECT to_char(MIN(occurred_at), 'YYYY-MM-DD HH24:MI:SS') AS earliest,
                to_char(MAX(occurred_at), 'YYYY-MM-DD HH24:MI:SS') AS latest
           FROM activity_events`,
      );

      // The exact bounds recorded from seed.sql during the Phase 0 inspection.
      expect(row.earliest).toBe('2026-02-01 10:57:44');
      expect(row.latest).toBe('2026-07-27 22:20:34');
    });

    it('Then the database matches seed.sql as raw text, immune to the host time zone (AC-2.4)', () => {
      const result = runScript('scripts/verify-seeded-db.mjs');
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/matches seed\.sql exactly/i);
    });
  });

  describe('Given the supplied schema', () => {
    it('Then the migration produced the same columns, types and keys (AC-2.1)', async () => {
      const dataSource = new DataSource(dataSourceOptions);
      registerUtcTimestampParser();
      await dataSource.initialize();
      try {
        const rows = await dataSource.query(
          `SELECT table_name, column_name, data_type, is_nullable
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('accounts', 'activity_events')
            ORDER BY table_name, ordinal_position`,
        );

        const column = (table: string, name: string) =>
          rows.find((r) => r.table_name === table && r.column_name === name);

        expect(column('accounts', 'created_at')).toMatchObject({
          data_type: 'timestamp without time zone',
          is_nullable: 'NO',
        });
        expect(column('accounts', 'name')).toMatchObject({
          data_type: 'character varying',
          is_nullable: 'NO',
        });
        expect(column('activity_events', 'duration_seconds')).toMatchObject({
          data_type: 'integer',
          is_nullable: 'YES',
        });
        expect(column('activity_events', 'outcome')).toMatchObject({
          data_type: 'character varying',
          is_nullable: 'YES',
        });

        const [constraints] = await dataSource.query(
          `SELECT COUNT(*)::int AS count
             FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY'
              AND table_name = 'activity_events'`,
        );
        expect(constraints.count).toBe(1);
      } finally {
        await dataSource.destroy();
      }
    });
  });
});