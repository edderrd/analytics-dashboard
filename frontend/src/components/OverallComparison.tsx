import { CalendarDays, Globe } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, explainReason } from './StatusBadge';
import { EmptyState } from './states';
import type {
  AccountComparison,
  EventTypeComparison,
  PeriodContext,
} from '@/api/types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  call_received: 'Calls received',
  lead_created: 'Leads created',
  appointment_set: 'Appointments set',
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}

/** "Week of 20 Jul – 26 Jul 2026 (account local time)". */
export function PeriodCaption({ periods }: { periods: PeriodContext }) {
  const start = new Date(`${periods.reportingWeekStartLocal}T00:00:00Z`);
  const end = new Date(`${periods.reportingWeekEndLocal}T00:00:00Z`);
  const format = (date: Date, withYear: boolean) =>
    date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-4" aria-hidden="true" />
        Week of {format(start, false)} – {format(end, true)} (complete week)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Globe className="size-4" aria-hidden="true" />
        {periods.timezone}
      </span>
      <span>
        Compared with the {periods.baselineWeeks} weeks before it (
        {format(new Date(`${periods.baselineWindowStartLocal}T00:00:00Z`), false)} –{' '}
        {format(new Date(`${periods.baselineWindowEndLocal}T00:00:00Z`), false)})
      </span>
    </div>
  );
}

function MetricCard({ comparison }: { comparison: EventTypeComparison }) {
  const { recentCount, baselineMean, changePct, status, reason } = comparison;

  return (
    <Card>
      <CardHeader>
        <CardDescription className="text-sm font-medium text-foreground">
          {eventTypeLabel(comparison.eventType)}
        </CardDescription>
        <CardTitle className="text-4xl tabular-nums">{recentCount}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusBadge status={status} reason={reason} />

        {baselineMean === null ? (
          <p className="text-sm text-muted-foreground">
            Usual week: not enough history to calculate.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Usual week: <span className="tabular-nums">{baselineMean}</span> events
            {changePct === null ? (
              <span> · no percentage available for a zero baseline</span>
            ) : (
              <span>
                {' '}
                ·{' '}
                <span className="tabular-nums font-medium text-foreground">
                  {changePct > 0 ? '+' : ''}
                  {changePct}%
                </span>{' '}
                vs usual
              </span>
            )}
          </p>
        )}

        <p className="text-xs text-muted-foreground">{explainReason(reason)}</p>
      </CardContent>
    </Card>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-20" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

/**
 * The headline answer for an account: one card per event type, each stating
 * whether the reporting week was typical, above or below (AC-5.2).
 */
export function OverallComparison({
  comparison,
}: {
  comparison: AccountComparison;
}) {
  if (!comparison.hasActivity) {
    return (
      <EmptyState
        title="No activity recorded"
        description="This account has no inbound events in the dataset, so there is nothing to compare. Once calls, leads or appointments arrive, a comparison against this account's own history will appear here."
      />
    );
  }

  const allInsufficient = comparison.totals.every(
    (total) => total.status === 'insufficient_history',
  );

  return (
    <section aria-labelledby="overall-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="overall-heading" className="text-lg font-semibold">
          Is this week normal for you?
        </h2>
        <PeriodCaption periods={comparison.periods} />
      </div>

      {allInsufficient ? (
        <EmptyState
          title="Not enough history yet"
          description="There is not enough activity history before this week to say whether it is normal. The comparison will appear once there are at least 4 complete weeks of history and 3 weeks with activity."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comparison.totals.map((total) => (
          <MetricCard key={total.eventType} comparison={total} />
        ))}
      </div>
    </section>
  );
}