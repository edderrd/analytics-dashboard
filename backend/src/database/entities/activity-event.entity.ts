import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Account } from './account.entity';

/**
 * Mirrors the `activity_events` table in `schema.sql` exactly.
 *
 * Notes from inspecting the seeded dataset (PLAN.md 1a / R4, R5):
 * - `occurred_at` is UTC. No time zone is stored on the column.
 * - `duration_seconds` is NULL for every non-call event, not only "meaningful
 *   for calls" — it stays a nullable integer and is not aggregated across
 *   event types.
 * - `outcome` values observed in the seed (connected, missed, voicemail,
 *   converted, no_show, open, completed) exceed the examples listed in the
 *   schema comment, so it remains an unconstrained varchar.
 */
export const EVENT_TYPES = [
  'call_received',
  'lead_created',
  'appointment_set',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

@Entity({ name: 'activity_events' })
@Index('idx_activity_events_account_occurred_at', ['accountId', 'occurredAt'])
@Index('idx_activity_events_account_location_occurred_at', [
  'accountId',
  'location',
  'occurredAt',
])
export class ActivityEvent {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  /** The account's site/branch where the activity occurred. */
  @Column({ type: 'varchar', length: 80 })
  location: string;

  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType: EventType;

  /** UTC instant. Never interpret in server-local time. */
  @Column({ name: 'occurred_at', type: 'timestamp' })
  occurredAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  outcome: string | null;

  @ManyToOne(() => Account, (account) => account.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account: Account;
}