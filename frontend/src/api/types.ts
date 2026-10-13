/**
 * Types mirroring the backend response DTOs
 * (`backend/src/modules/comparisons/dto/comparison.dto.ts`).
 *
 * Kept as a hand-written mirror rather than a generated/shared package: the
 * surface is small and stable, and sharing would couple the two builds. Any
 * backend change here is a contract change and must update this file too.
 */

export type ComparisonStatus =
  | 'above'
  | 'typical'
  | 'below'
  | 'insufficient_history';

export type ComparisonReason =
  | 'within_normal_band'
  | 'outside_normal_band'
  | 'zero_baseline_no_activity'
  | 'zero_baseline_new_activity'
  | 'not_enough_history'
  | 'not_enough_observations';

export interface EventTypeComparison {
  eventType: string;
  recentCount: number;
  baselineMean: number | null;
  changePct: number | null;
  status: ComparisonStatus;
  reason: ComparisonReason;
  baselineNonZeroWeeks: number;
  availableBaselineWeeks: number;
}

export interface PeriodContext {
  asOf: string;
  timezone: string;
  reportingWeekStartLocal: string;
  reportingWeekEndLocal: string;
  reportingWeekStartUtc: string;
  reportingWeekEndExclusiveUtc: string;
  baselineWindowStartLocal: string;
  baselineWindowEndLocal: string;
  baselineWeeks: number;
}

export interface AccountComparison {
  accountId: number;
  accountName: string;
  periods: PeriodContext;
  hasActivity: boolean;
  locations: string[];
  /** Locations the returned totals are scoped to; null = whole account. */
  filteredLocations: string[] | null;
  totals: EventTypeComparison[];
}

export interface LocationComparison {
  location: string;
  totals: EventTypeComparison[];
}

export interface LocationComparisonResponse {
  accountId: number;
  periods: PeriodContext;
  locations: LocationComparison[];
}

export interface AccountSummary {
  id: number;
  name: string;
  industry: string;
  timezone: string;
  locationCount: number;
}

export interface AccountDetail extends AccountSummary {
  createdAt: string;
  locations: string[];
}

/** A request that failed in a way worth showing the user. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}