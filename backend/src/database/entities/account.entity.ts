import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';

import { ActivityEvent } from './activity-event.entity';

/**
 * Mirrors the `accounts` table in `schema.sql` exactly.
 *
 * All timestamps are stored in UTC; `timezone` holds the account's IANA zone
 * (e.g. 'America/Chicago') and is used to interpret activity in account-local
 * terms. See PLAN.md section 3.
 */
@Entity({ name: 'accounts' })
export class Account {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  industry: string;

  /** IANA timezone identifier, e.g. 'America/Chicago' or 'UTC'. */
  @Column({ type: 'varchar', length: 60 })
  timezone: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => ActivityEvent, (event) => event.account)
  events: ActivityEvent[];
}