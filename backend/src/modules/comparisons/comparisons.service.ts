import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  daysBetween,
  parseLocalDate,
  startOfWeek,
  type LocalDate,
} from '../../common/dates/local-date';
import { utcToLocalDate, weekBoundsUtc } from '../../common/dates/account-time';
import { ActivityEvent } from '../../database/entities/activity-event.entity';
import { Account } from '../../database/entities/account.entity';
import {
  BASELINE_WEEKS,
  COMPARABLE_EVENT_TYPES,
  type ComparableEventType,
} from './comparison.constants';
import {
  resolveComparisonPeriods,
  type ComparisonPeriods,
} from './domain/comparison-periods';
import { compareToBaseline } from './domain/compare-to-baseline';
import type {
  AccountComparisonDto,
  AccountDetailDto,
  AccountSummaryDto,
  EventTypeComparisonDto,
  LocationComparisonDto,
  LocationComparisonResponseDto,
  PeriodContextDto,
} from './dto/comparison.dto';

/** One aggregated row straight from the database. */
interface DailyCountRow {
  location: string;
  event_type: string;
  local_date: LocalDate;
  n: number;
}

/** Reporting counts and per-week baseline counts for one scope. */
interface ScopedTotals {
  recentByType: Map<string, number>;
  baselineWeeksByType: Map<string, number[]>;
}

@Injectable()
export class ComparisonsService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(ActivityEvent)
    private readonly events: Repository<ActivityEvent>,
  ) {}

  async listAccounts(): Promise<AccountSummaryDto[]> {
    const rows = await this.accounts.query<
      {
        id: number;
        name: string;
        industry: string;
        timezone: string;
        location_count: number;
      }[]
    >(
      `SELECT a.id,
              a.name,
              a.industry,
              a.timezone,
              COUNT(DISTINCT e.location)::int AS location_count
         FROM accounts a
         LEFT JOIN activity_events e ON e.account_id = a.id
        GROUP BY a.id, a.name, a.industry, a.timezone, a.created_at
        ORDER BY a.name ASC`,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      industry: row.industry,
      timezone: row.timezone,
      locationCount: Number(row.location_count),
    }));
  }

  async getAccount(id: number): Promise<AccountDetailDto> {
    const account = await this.requireAccount(id);
    const locations = await this.locationsFor(id);
    return {
      id: account.id,
      name: account.name,
      industry: account.industry,
      timezone: account.timezone,
      createdAt: account.createdAt.toISOString(),
      locationCount: locations.length,
      locations,
    };
  }

  async listLocations(id: number): Promise<string[]> {
    await this.requireAccount(id);
    return this.locationsFor(id);
  }

  /**
   * Latest activity anywhere in the dataset, used as the default `asOf`.
   * Reading the data (rather than `new Date()`) keeps results reproducible.
   */
  async defaultAsOf(): Promise<Date> {
    const rows = await this.events.query<{ latest: Date | null }[]>(
      `SELECT MAX(occurred_at) AS latest FROM activity_events`,
    );
    return rows[0]?.latest ?? new Date(0);
  }

  async compareAccount(
    id: number,
    asOf?: string,
    eventTypes: ComparableEventType[] = [...COMPARABLE_EVENT_TYPES],
  ): Promise<AccountComparisonDto> {
    const { account, locations } = await this.requireAccountWithLocations(id);
    const periods = await this.resolvePeriods(account, asOf);
    const rows = await this.dailyCounts(account, periods);
    const totals = this.collapse(rows, periods, undefined);
    const availableBaselineWeeks = await this.availableBaselineWeeks(account, periods);

    return {
      accountId: account.id,
      accountName: account.name,
      periods: this.periodContext(periods, account.timezone),
      hasActivity: rows.length > 0,
      locations,
      totals: eventTypes.map((eventType) =>
        this.toEventTypeComparison(eventType, totals, periods, availableBaselineWeeks),
      ),
    };
  }

  async compareLocations(
    id: number,
    asOf?: string,
    eventTypes: ComparableEventType[] = [...COMPARABLE_EVENT_TYPES],
    locationFilter?: string[],
  ): Promise<LocationComparisonResponseDto> {
    const { account, locations } = await this.requireAccountWithLocations(id);
    const periods = await this.resolvePeriods(account, asOf);
    const requested = this.validateLocationFilter(locationFilter, locations);

    const rows = await this.dailyCounts(account, periods);
    const availableBaselineWeeks = await this.availableBaselineWeeks(account, periods);

    const selected = requested ? locations.filter((l) => requested.includes(l)) : locations;

    return {
      accountId: account.id,
      periods: this.periodContext(periods, account.timezone),
      locations: selected.map((location): LocationComparisonDto => {
        const totals = this.collapse(rows, periods, location);
        return {
          location,
          totals: eventTypes.map((eventType) =>
            this.toEventTypeComparison(eventType, totals, periods, availableBaselineWeeks),
          ),
        };
      }),
    };
  }

  // ---------------------------------------------------------------- internals

  private async requireAccount(id: number): Promise<Account> {
    const account = await this.accounts.findOneBy({ id });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  private async requireAccountWithLocations(
    id: number,
  ): Promise<{ account: Account; locations: string[] }> {
    const account = await this.requireAccount(id);
    return { account, locations: await this.locationsFor(id) };
  }

  private async locationsFor(accountId: number): Promise<string[]> {
    const rows = await this.events.query<{ location: string }[]>(
      `SELECT DISTINCT location
         FROM activity_events
        WHERE account_id = $1
        ORDER BY location ASC`,
      [accountId],
    );
    return rows.map((row) => row.location);
  }

  /** Unknown locations are rejected rather than silently ignored (AC-4.5). */
  private validateLocationFilter(
    filter: string[] | undefined,
    known: string[],
  ): string[] | undefined {
    if (!filter?.length) return undefined;
    const unknown = filter.filter((location) => !known.includes(location));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown location(s) for this account: ${unknown.join(', ')}`,
      );
    }
    return filter;
  }

  private async resolvePeriods(
    account: Account,
    asOf?: string,
  ): Promise<ComparisonPeriods> {
    if (asOf) {
      parseLocalDate(asOf);
      return resolveComparisonPeriods(asOf);
    }
    return resolveComparisonPeriods(
      utcToLocalDate(await this.defaultAsOf(), account.timezone),
    );
  }

  /**
   * One aggregation query covering the whole baseline + reporting window.
   *
   * Day bucketing happens in Postgres because which calendar day an event
   * belongs to depends on the account's zone;
   * `(occurred_at AT TIME ZONE $tz)::date` resolves that without shipping every
   * row to the application. Only the resulting daily buckets are mapped to
   * weeks in memory (PLAN.md AC-3.1).
   */
  private async dailyCounts(
    account: Account,
    periods: ComparisonPeriods,
  ): Promise<DailyCountRow[]> {
    const reporting = weekBoundsUtc(periods.reportingStartLocal, account.timezone);
    const baseline = weekBoundsUtc(periods.baselineStartLocal, account.timezone);

    return this.events.query<DailyCountRow[]>(
      `SELECT location,
              event_type,
              to_char((occurred_at AT TIME ZONE $2)::date, 'YYYY-MM-DD') AS local_date,
              COUNT(*)::int AS n
         FROM activity_events
        WHERE account_id = $1
          AND occurred_at >= $3
          AND occurred_at <  $4
        GROUP BY location, event_type, (occurred_at AT TIME ZONE $2)::date
        ORDER BY location, event_type, local_date`,
      [account.id, account.timezone, baseline.startUtc, reporting.endExclusiveUtc],
    );
  }

  /**
   * Turns daily buckets into reporting counts and per-week baseline counts,
   * optionally restricted to a single location.
   */
  private collapse(
    rows: DailyCountRow[],
    periods: ComparisonPeriods,
    location?: string,
  ): ScopedTotals {
    const recentByType = new Map<string, number>();
    const baselineWeeksByType = new Map<string, number[]>();
    for (const eventType of COMPARABLE_EVENT_TYPES) {
      recentByType.set(eventType, 0);
      baselineWeeksByType.set(eventType, new Array(BASELINE_WEEKS).fill(0));
    }

    const weekIndexByStart = new Map<LocalDate, number>();
    periods.baselineWeekStartsLocal.forEach((start, index) => weekIndexByStart.set(start, index));

    // Bucket each day by the Monday of its own week; looking the day up
    // directly would only match days that happen to be Mondays.
    const baselineWeekIndexOf = (date: LocalDate): number | undefined => {
      const weekStart = startOfWeek(date);
      return weekIndexByStart.get(weekStart);
    };

    for (const row of rows) {
      if (location !== undefined && row.location !== location) continue;
      if (!recentByType.has(row.event_type)) continue;
      const type = row.event_type;

      if (row.local_date >= periods.reportingStartLocal && row.local_date <= periods.reportingEndLocal) {
        recentByType.set(type, (recentByType.get(type) ?? 0) + Number(row.n));
        continue;
      }

      const index = baselineWeekIndexOf(row.local_date);
      // Undefined means the day belongs to the current, incomplete week, which
      // is excluded by design (AC-3.2).
      if (index === undefined) continue;
      baselineWeeksByType.get(type)![index] += Number(row.n);
    }

    return { recentByType, baselineWeeksByType };
  }

  /**
   * Complete baseline weeks the account actually has history for.
   *
   * Measured from the account's **earliest activity overall**, not from the
   * queried window (which starts at the baseline and would always yield zero).
   * This is what makes an `asOf` far enough in the past legitimately report
   * insufficient history (PLAN.md R3).
   */
  private async availableBaselineWeeks(
    account: Account,
    periods: ComparisonPeriods,
  ): Promise<number> {
    const rows = await this.events.query<{ first: Date | null }[]>(
      `SELECT MIN(occurred_at) AS first
         FROM activity_events
        WHERE account_id = $1`,
      [account.id],
    );
    const first = rows[0]?.first;
    if (!first) return 0;

    const firstLocal = utcToLocalDate(first, account.timezone);
    const spanned = daysBetween(firstLocal, periods.baselineStartLocal);
    if (spanned <= 0) return 0;
    return Math.min(BASELINE_WEEKS, Math.floor(spanned / 7));
  }

  private toEventTypeComparison(
    eventType: ComparableEventType,
    totals: ScopedTotals,
    periods: ComparisonPeriods,
    availableBaselineWeeks: number,
  ): EventTypeComparisonDto {
    const outcome = compareToBaseline({
      reportingCount: totals.recentByType.get(eventType) ?? 0,
      baselineWeekCounts: totals.baselineWeeksByType.get(eventType) ?? [],
      availableBaselineWeeks,
    });

    return {
      eventType,
      recentCount: totals.recentByType.get(eventType) ?? 0,
      baselineMean: outcome.baselineMean,
      changePct: outcome.changePct,
      status: outcome.status,
      reason: outcome.reason,
      baselineNonZeroWeeks: outcome.baselineNonZeroWeeks,
      availableBaselineWeeks: outcome.availableBaselineWeeks,
    };
  }

  private periodContext(periods: ComparisonPeriods, timeZone: string): PeriodContextDto {
    const reporting = weekBoundsUtc(periods.reportingStartLocal, timeZone);
    const baseline = weekBoundsUtc(periods.baselineStartLocal, timeZone);
    return {
      asOf: periods.asOfLocal,
      timezone: timeZone,
      reportingWeekStartLocal: periods.reportingStartLocal,
      reportingWeekEndLocal: periods.reportingEndLocal,
      reportingWeekStartUtc: reporting.startUtc.toISOString(),
      reportingWeekEndExclusiveUtc: reporting.endExclusiveUtc.toISOString(),
      baselineWindowStartLocal: periods.baselineStartLocal,
      baselineWindowEndLocal: periods.baselineEndLocal,
      baselineWeeks: BASELINE_WEEKS,
    };
  }
}