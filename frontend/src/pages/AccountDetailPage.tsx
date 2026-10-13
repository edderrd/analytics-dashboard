import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { ALL_LOCATIONS, LocationFilter } from '@/components/LocationFilter';
import { ErrorState, LoadingState } from '@/components/states';

/**
 * Account dashboard: the Monday-morning answer plus the per-location view,
 * optionally narrowed to a single site (AC-5.2, AC-5.3, AC-5.8).
 *
 * The selected location lives in the `?location=` query parameter, so a
 * filtered view can be shared or bookmarked and the browser back button works.
 */
export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  // Remembered so the picker stays mounted while a filtered request is in
  // flight: reading the options from the pending response made it unmount and
  // remount on every filter change, flashing away and losing focus.
  const [knownLocations, setKnownLocations] = useState<string[]>([]);
  const selectedLocation = searchParams.get('location') ?? ALL_LOCATIONS;
  const locationFilter = selectedLocation ? [selectedLocation] : undefined;

  const comparison = useAsync(
    useCallback(
      (signal) => api.getComparison(accountId, { locations: locationFilter }, signal),
      [accountId, selectedLocation],
    ),
    [accountId, selectedLocation],
  );
  const locations = useAsync(
    useCallback(
      (signal) => api.getLocationComparisons(accountId, { locations: locationFilter }, signal),
      [accountId, selectedLocation],
    ),
    [accountId, selectedLocation],
  );

  useEffect(() => {
    if (comparison.kind === 'success' && comparison.data.locations.length > 0) {
      setKnownLocations(comparison.data.locations);
    }
  }, [comparison]);

  const onLocationChange = useCallback(
    (location: string) => {
      const next = new URLSearchParams(searchParams);
      if (location === ALL_LOCATIONS) next.delete('location');
      else next.set('location', location);
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  if (!Number.isInteger(accountId)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <ErrorState message="That account link is not valid." />
      </main>
    );
  }

  const allLocations =
    comparison.kind === 'success' ? comparison.data.locations : knownLocations;
  const showFilter = allLocations.length > 1;

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

      {showFilter ? (
        <div className="max-w-xs">
          <LocationFilter
            locations={allLocations}
            value={selectedLocation}
            onChange={onLocationChange}
            disabled={comparison.kind === 'loading'}
          />
        </div>
      ) : null}

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
          <LocationComparisonTable
            data={locations.data}
            scopeLabel={selectedLocation || undefined}
            onSelectLocation={onLocationChange}
          />
        )
      ) : null}
    </main>
  );
}