import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Direct translation of `schema.sql` into a TypeORM migration.
 *
 * schema.sql declares no indexes; the two composite indexes below are added
 * for the aggregation queries required by spec section 4 (they are additive
 * and do not change column definitions or semantics).
 */
export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" integer NOT NULL,
        "name" character varying(120) NOT NULL,
        "industry" character varying(60) NOT NULL,
        "timezone" character varying(60) NOT NULL,
        "created_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "activity_events" (
        "id" integer NOT NULL,
        "account_id" integer NOT NULL,
        "location" character varying(80) NOT NULL,
        "event_type" character varying(40) NOT NULL,
        "occurred_at" TIMESTAMP NOT NULL,
        "duration_seconds" integer,
        "outcome" character varying(40),
        CONSTRAINT "PK_activity_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_events_account_id" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_activity_events_account_occurred_at"
        ON "activity_events" ("account_id", "occurred_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_activity_events_account_location_occurred_at"
        ON "activity_events" ("account_id", "location", "occurred_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_activity_events_account_location_occurred_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_activity_events_account_occurred_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts"`);
  }
}