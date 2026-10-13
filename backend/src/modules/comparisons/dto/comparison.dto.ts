export type ComparisonStatusDto =
  | 'above'
  | 'typical'
  | 'below'
  | 'insufficient_history';

/** Comparison of one event type over one scope (account, or account+location). */
export class EventTypeComparisonDto {
  eventType: string;
  /** Events in the reporting week. */
  recentCount: number;
  /** Mean events per baseline week; null when no comparison was possible. */
  baselineMean: number | null;
  /** Signed percentage change vs baseline; null for a zero baseline. */
  changePct: number | null;
  status: ComparisonStatusDto;
  /** Machine-readable reason behind the status. */
  reason: string;
  /** Baseline weeks containing at least one event. */
  baselineNonZeroWeeks: number;
  /** Complete baseline weeks covered by the account's history. */
  availableBaselineWeeks: number;
}

export class PeriodContextDto {
  /** Local date the periods were derived from. */
  asOf: string;
  /** The account's IANA time zone. */
  timezone: string;
  /** Reporting week start, account-local (Monday). */
  reportingWeekStartLocal: string;
  /** Reporting week end, account-local (Sunday). */
  reportingWeekEndLocal: string;
  /** Reporting week start as a UTC instant. */
  reportingWeekStartUtc: string;
  /** Reporting week end (exclusive) as a UTC instant. */
  reportingWeekEndExclusiveUtc: string;
  /** Baseline window start, account-local. */
  baselineWindowStartLocal: string;
  /** Baseline window end, account-local. */
  baselineWindowEndLocal: string;
  /** Number of baseline weeks. */
  baselineWeeks: number;
}

export class AccountComparisonDto {
  accountId: number;
  accountName: string;
  periods: PeriodContextDto;
  /** False when the account has no activity at all. */
  hasActivity: boolean;
  /** Every location known for this account, so a client can populate a picker. */
  locations: string[];
  /**
   * Locations the returned `totals` are scoped to, or `null` when the response
   * covers the whole account.
   */
  filteredLocations: string[] | null;
  totals: EventTypeComparisonDto[];
}

export class LocationComparisonDto {
  location: string;
  totals: EventTypeComparisonDto[];
}

export class LocationComparisonResponseDto {
  accountId: number;
  periods: PeriodContextDto;
  locations: LocationComparisonDto[];
}

export class AccountSummaryDto {
  id: number;
  name: string;
  industry: string;
  /** IANA time zone, e.g. 'America/Chicago'. */
  timezone: string;
  /** Distinct locations with recorded activity. */
  locationCount: number;
}

export class AccountDetailDto extends AccountSummaryDto {
  /** Creation timestamp (UTC). */
  createdAt: string;
  locations: string[];
}

export class LocationsDto {
  accountId: number;
  locations: string[];
}