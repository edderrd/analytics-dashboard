/**
 * Seed runner: loads the checked-in dataset (`seed-data.ts`, translated
 * verbatim from `seed.sql`) and verifies it landed intact.
 *
 * Re-runnable: the compose backend command runs `migrate && seed` on every
 * start. If the database already holds exactly the expected rows the runner
 * exits successfully without re-inserting; if it holds anything else it fails
 * loudly rather than silently mutating reference data (AC-2.4).
 *
 * Run with: npm run seed --workspace backend
 */
import { AppDataSource } from '../data-source';
import {
  ActivityEvent,
  EVENT_TYPES,
  type EventType,
} from '../entities/activity-event.entity';
import { Account } from '../entities/account.entity';
import {
  EXPECTED_ACCOUNT_COUNT,
  EXPECTED_ACTIVITY_EVENT_COUNT,
  SEED_ACCOUNTS,
  SEED_ACTIVITY_EVENTS,
} from './seed-data';
import { toUtcTimestamp } from '../pg-timestamp';

const INSERT_CHUNK_SIZE = 1000;

const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set(EVENT_TYPES);

/** Guards against a silently mistyped row in the generated data module. */
function toEventType(value: string): EventType {
  if (!KNOWN_EVENT_TYPES.has(value)) {
    throw new Error(
      `Unknown event_type "${value}" in seed data (expected one of ${EVENT_TYPES.join(', ')})`,
    );
  }
  return value as EventType;
}

/**
 * 'YYYY-MM-DD HH:MM:SS' (UTC, as stored) -> Date.
 *
 * Only used for assertions; inserts pass the literal through so the driver
 * never reformats a Date through the host time zone (see pg-timestamp.ts).
 */
function toUtcDate(value: string): Date {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unparseable timestamp from seed data: "${value}"`);
  }
  return parsed;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size) as T[]);
  }
  return chunks;
}

async function insertAll() {
  const accounts = AppDataSource.getRepository(Account);
  const events = AppDataSource.getRepository(ActivityEvent);

  console.log(
    `Seeding ${SEED_ACCOUNTS.length} accounts then ${SEED_ACTIVITY_EVENTS.length} activity events...`,
  );

  // Accounts first: activity_events.account_id references accounts(id).
  await accounts.insert(
    SEED_ACCOUNTS.map((account) => ({
      id: account.id,
      name: account.name,
      industry: account.industry,
      timezone: account.timezone,
      createdAt: toUtcTimestamp(account.createdAt),
    })),
  );

  for (const batch of chunk(SEED_ACTIVITY_EVENTS, INSERT_CHUNK_SIZE)) {
    await events.insert(
      batch.map((event) => ({
        id: event.id,
        accountId: event.accountId,
        location: event.location,
        eventType: toEventType(event.eventType),
        occurredAt: toUtcTimestamp(event.occurredAt),
        durationSeconds: event.durationSeconds,
        outcome: event.outcome,
      })),
    );
  }
}

async function verify(): Promise<string[]> {
  const failures: string[] = [];
  const accountCount = await AppDataSource.getRepository(Account).count();
  const eventCount = await AppDataSource.getRepository(ActivityEvent).count();

  if (accountCount !== EXPECTED_ACCOUNT_COUNT) {
    failures.push(
      `accounts: expected ${EXPECTED_ACCOUNT_COUNT}, found ${accountCount}`,
    );
  }
  if (eventCount !== EXPECTED_ACTIVITY_EVENT_COUNT) {
    failures.push(
      `activity_events: expected ${EXPECTED_ACTIVITY_EVENT_COUNT}, found ${eventCount}`,
    );
  }

  // Referential integrity: every event must belong to a seeded account.
  const orphans = await AppDataSource.query(
    `SELECT COUNT(*)::int AS count
       FROM activity_events e
       LEFT JOIN accounts a ON a.id = e.account_id
      WHERE a.id IS NULL`,
  );
  if (orphans[0]?.count > 0) {
    failures.push(`found ${orphans[0].count} activity_events without a parent account`);
  }

  // Spot-check the earliest and latest rows so a silent timestamp shift
  // (e.g. a server-local offset) cannot pass unnoticed.
  const bounds = await AppDataSource.query(
    `SELECT MIN(occurred_at) AS earliest, MAX(occurred_at) AS latest FROM activity_events`,
  );
  const expectedEarliest = toUtcDate(
    SEED_ACTIVITY_EVENTS[0].occurredAt,
  ).toISOString();
  const expectedLatest = toUtcDate(
    SEED_ACTIVITY_EVENTS[SEED_ACTIVITY_EVENTS.length - 1].occurredAt,
  ).toISOString();
  const actualEarliest = new Date(bounds[0].earliest).toISOString();
  const actualLatest = new Date(bounds[0].latest).toISOString();

  if (actualEarliest !== expectedEarliest) {
    failures.push(
      `earliest occurred_at: expected ${expectedEarliest}, found ${actualEarliest}`,
    );
  }
  if (actualLatest !== expectedLatest) {
    failures.push(
      `latest occurred_at: expected ${expectedLatest}, found ${actualLatest}`,
    );
  }

  // Spot-check a specific known row verbatim (name, timezone, event fields).
  const account20 = await AppDataSource.getRepository(Account).findOneBy({
    id: 20,
  });
  if (
    !account20 ||
    account20.name !== 'Quiet Harbor Spa' ||
    account20.timezone !== 'America/Los_Angeles'
  ) {
    failures.push('account 20 spot-check failed (expected Quiet Harbor Spa / America/Los_Angeles)');
  }

  const firstEvent = await AppDataSource.getRepository(ActivityEvent).findOneBy({
    id: 1,
  });
  if (
    !firstEvent ||
    firstEvent.accountId !== 5 ||
    firstEvent.location !== 'Site B' ||
    firstEvent.eventType !== 'call_received' ||
    firstEvent.durationSeconds !== 621 ||
    firstEvent.outcome !== 'missed'
  ) {
    failures.push('activity_events id=1 spot-check failed');
  }

  return failures;
}

async function main() {
  await AppDataSource.initialize();

  try {
    const accounts = AppDataSource.getRepository(Account);
    const events = AppDataSource.getRepository(ActivityEvent);
    const existingAccounts = await accounts.count();
    const existingEvents = await events.count();

    const alreadySeeded =
      existingAccounts === EXPECTED_ACCOUNT_COUNT &&
      existingEvents === EXPECTED_ACTIVITY_EVENT_COUNT;

    if (alreadySeeded) {
      console.log(
        `Seed already present (${existingAccounts} accounts, ${existingEvents} activity events). Skipping insert.`,
      );
    } else if (existingAccounts === 0 && existingEvents === 0) {
      await insertAll();
    } else {
      throw new Error(
        `Database is in an unexpected state (accounts=${existingAccounts}, ` +
          `activity_events=${existingEvents}; expected 0/0 or ` +
          `${EXPECTED_ACCOUNT_COUNT}/${EXPECTED_ACTIVITY_EVENT_COUNT}). ` +
          'Refusing to modify seeded reference data.',
      );
    }

    const failures = await verify();
    if (failures.length > 0) {
      throw new Error(`Seed verification failed:\n  - ${failures.join('\n  - ')}`);
    }

    console.log(
      `Seed verified: ${EXPECTED_ACCOUNT_COUNT} accounts, ` +
        `${EXPECTED_ACTIVITY_EVENT_COUNT} activity events.`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});