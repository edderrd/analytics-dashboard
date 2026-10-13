import { AlertTriangle } from 'lucide-react';

import { StatusBadge, rankStatus } from './StatusBadge';
import { eventTypeLabel } from './OverallComparison';
import { EmptyState } from './states';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LocationComparisonResponse } from '@/api/types';

/**
 * Per-location comparison, sorted so the locations that moved most appear
 * first — the support team's "which location needs attention" question
 * (AC-5.3).
 */
export function LocationComparisonTable({
  data,
  scopeLabel,
  onSelectLocation,
}: {
  data: LocationComparisonResponse;
  /** Set when the view is filtered to a single site. */
  scopeLabel?: string;
  onSelectLocation?: (location: string) => void;
}) {
  if (data.locations.length === 0) {
    return (
      <EmptyState
        title="No locations yet"
        description="No activity has been recorded for any location on this account, so there is nothing to compare by site."
      />
    );
  }

  const sorted = [...data.locations].sort((a, b) => {
    const worst = (location: typeof a) =>
      Math.min(...location.totals.map((total) => rankStatus(total.status)));
    const bySeverity = worst(a) - worst(b);
    if (bySeverity !== 0) return bySeverity;
    return a.location.localeCompare(b.location);
  });

  return (
    <section aria-labelledby="locations-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="locations-heading" className="text-lg font-semibold">
          {scopeLabel ? `By location: ${scopeLabel}` : 'By location'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {scopeLabel
            ? 'Showing one site. Choose “All locations” to compare every site.'
            : 'Sites whose week was furthest from their own usual are listed first. Choose a site to narrow the whole page to it.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <caption className="sr-only">
            Per-location comparison of the reporting week against each site’s
            usual activity
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Location</TableHead>
              <TableHead scope="col">Metric</TableHead>
              <TableHead scope="col" className="text-right">
                This week
              </TableHead>
              <TableHead scope="col" className="text-right">
                Usual week
              </TableHead>
              <TableHead scope="col">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.flatMap((location) => {
              const needsAttention = location.totals.some(
                (entry) => entry.status === 'above' || entry.status === 'below',
              );

              return location.totals.map((total, index) => (
                <TableRow key={`${location.location}-${total.eventType}`}>
                  {index === 0 ? (
                    <TableCell
                      rowSpan={location.totals.length}
                      className="align-top font-medium"
                    >
                      <span className="flex flex-col items-start gap-1.5">
                        {onSelectLocation ? (
                          <button
                            type="button"
                            onClick={() => onSelectLocation(location.location)}
                            className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {location.location}
                          </button>
                        ) : (
                          <span>{location.location}</span>
                        )}
                        {needsAttention ? (
                          <Badge
                            variant="outline"
                            className="gap-1 text-amber-700 dark:text-amber-400"
                          >
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Needs a look
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell>{eventTypeLabel(total.eventType)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {total.recentCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {total.baselineMean ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={total.status} reason={total.reason} />
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>

      {onSelectLocation ? (
        <p className="text-xs text-muted-foreground">
          Select a site name to filter the whole page to it.
        </p>
      ) : null}
    </section>
  );
}