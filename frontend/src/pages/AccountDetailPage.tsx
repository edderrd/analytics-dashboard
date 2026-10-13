import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { api } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MetricCardSkeleton,
  OverallComparison,
} from '@/components/OverallComparison';
import { LocationComparisonTable } from '@/components/LocationComparisonTable';
import { ErrorState, LoadingState } from '@/components/states';

/** Account dashboard: the Monday-morning answer plus the per-location view
 *  (AC-5.2, AC-5.3). */
export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);

  const comparison = useAsync(
    useCallback((signal) => api.getComparison(accountId, signal), [accountId]),
    [accountId],
  );
  const locations = useAsync(
    useCallback((signal) => api.getLocationComparisons(accountId, signal), [accountId]),
    [accountId],
  );

  if (!Number.isInteger(accountId)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <ErrorState message="That account link is not valid." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-4">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            All accounts
          </Link>
        </Button>

        {comparison.kind === 'success' ? (
          <header className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {comparison.data.accountName}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span>{comparison.data.periods.timezone}</span>
              <Badge variant="secondary">
                {comparison.data.locations.length}{' '}
                {comparison.data.locations.length === 1 ? 'location' : 'locations'}
              </Badge>
            </p>
          </header>
        ) : (
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
          </header>
        )}
      </div>

      {comparison.kind === 'loading' ? (
        <section aria-label="Loading comparison" className="space-y-4">
          <LoadingState label="Loading the latest complete week…" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <MetricCardSkeleton key={index} />
            ))}
          </div>
        </section>
      ) : null}

      {comparison.kind === 'error' ? (
        <ErrorState message={comparison.message} onRetry={comparison.reload} />
      ) : null}

      {comparison.kind === 'success' ? (
        <OverallComparison comparison={comparison.data} />
      ) : null}

      {comparison.kind === 'success' && comparison.data.locations.length > 1 ? (
        locations.kind === 'loading' ? (
          <LoadingState label="Loading per-location comparison…" />
        ) : locations.kind === 'error' ? (
          <ErrorState message={locations.message} onRetry={locations.reload} />
        ) : (
          <LocationComparisonTable data={locations.data} />
        )
      ) : null}
    </main>
  );
}