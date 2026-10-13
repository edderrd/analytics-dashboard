import { AlertCircle, Inbox, Loader2, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Loading placeholder used while a request is in flight (AC-5.4). */
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-dashed p-8 text-muted-foreground"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Error state with a retry affordance (AC-5.4, AC-5.5). */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const offline = message.toLowerCase().includes('could not reach');
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <Card role="alert" className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Icon className="size-4" aria-hidden="true" />
          {offline ? 'Cannot reach the analytics API' : 'Something went wrong'}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry ? (
        <CardContent>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

/** Empty state: the request succeeded but there is nothing to show (AC-5.4). */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}