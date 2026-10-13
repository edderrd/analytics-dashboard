import { Link } from 'react-router-dom';
import { Building2, MapPin } from 'lucide-react';

import { api } from '@/api/client';
import { useAsync } from '@/hooks/useAsync';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

function AccountRow({
  id,
  name,
  industry,
  timezone,
  locationCount,
}: {
  id: number;
  name: string;
  industry: string;
  timezone: string;
  locationCount: number;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-base">
          {/* The whole card is not a link, so the link text is the name. */}
          <Link
            to={`/accounts/${id}`}
            className="after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {name}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-4" aria-hidden="true" />
            {industry}
          </span>
          <span>{timezone}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary" className="gap-1.5">
          <MapPin className="size-3" aria-hidden="true" />
          {locationCount === 0
            ? 'No activity yet'
            : `${locationCount} ${locationCount === 1 ? 'location' : 'locations'}`}
        </Badge>
      </CardContent>
    </Card>
  );
}

/** Home view: every account with a link to its dashboard (AC-5.1). */
export function AccountsPage() {
  const state = useAsync((signal) => api.listAccounts(signal), []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Relay analytics</h1>
        <p className="text-muted-foreground">
          Pick a customer to see whether their latest complete week was typical for
          them.
        </p>
      </header>

      {state.kind === 'loading' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <ErrorState message={state.message} onRetry={state.reload} />
      ) : null}

      {state.kind === 'success' && state.data.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Once accounts exist in the database they will be listed here."
        />
      ) : null}

      {state.kind === 'success' && state.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {state.data.map((account) => (
            <div key={account.id} className="relative">
              <AccountRow {...account} />
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}

export { LoadingState };