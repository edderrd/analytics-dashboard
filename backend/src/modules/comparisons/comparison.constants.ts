/**
 * Tunable comparison rules (PLAN.md "Definitions and constants").
 *
 * These encode product judgement, not facts derivable from the data, and are
 * surfaced as named constants so the rule is explicit at every call site.
 */
export const BASELINE_WEEKS = 8;

/** Below this many complete weeks of history, no comparison is attempted. */
export const MIN_BASELINE_WEEKS = 4;

/** Minimum non-zero baseline weeks before a baseline mean is trusted. */
export const MIN_BASELINE_OBS = 3;

/** +/- percentage around the baseline mean that still counts as "typical". */
export const NORMAL_BAND_PCT = 30;

/** Event types the dashboard reports on, in display order. */
export const COMPARABLE_EVENT_TYPES = [
  'call_received',
  'lead_created',
  'appointment_set',
] as const;

export type ComparableEventType = (typeof COMPARABLE_EVENT_TYPES)[number];