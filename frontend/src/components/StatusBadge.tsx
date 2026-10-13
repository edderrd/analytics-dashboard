import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ComparisonReason, ComparisonStatus } from '@/api/types';

/**
 * Status presentation. Colour is deliberately restrained: "above" is not
 * automatically good news for an inbound-activity business, so the palette
 * distinguishes *movement* rather than judging it (AC-5.2).
 */
const STATUS_STYLES: Record<
  ComparisonStatus,
  { label: string; icon: typeof Minus; className: string }
> = {
  above: {
    label: 'Above normal',
    icon: ArrowUpRight,
    className:
      'border-transparent bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-100',
  },
  below: {
    label: 'Below normal',
    icon: ArrowDownRight,
    className:
      'border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100',
  },
  typical: {
    label: 'Typical',
    icon: Minus,
    className:
      'border-transparent bg-slate-200 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100',
  },
  insufficient_history: {
    label: 'Not enough history',
    icon: HelpCircle,
    className:
      'border-transparent bg-muted text-muted-foreground hover:bg-muted dark:bg-muted',
  },
};

const REASON_EXPLANATIONS: Record<ComparisonReason, string> = {
  within_normal_band: 'Within 30% of this account’s usual week.',
  outside_normal_band: 'More than 30% away from this account’s usual week.',
  zero_baseline_no_activity: 'No activity in either the reporting week or the baseline.',
  zero_baseline_new_activity: 'Activity where this account normally has none.',
  not_enough_history:
    'This account does not have enough weeks of history before the reporting week to compare against.',
  not_enough_observations:
    'Too few baseline weeks contained activity to compare reliably.',
};

export function StatusBadge({
  status,
  reason,
}: {
  status: ComparisonStatus;
  reason: ComparisonReason;
}) {
  const { label, icon: Icon, className } = STATUS_STYLES[status];
  return (
    <Badge className={className}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <span className="sr-only">. {REASON_EXPLANATIONS[reason]}</span>
    </Badge>
  );
}

export function explainReason(reason: ComparisonReason): string {
  return REASON_EXPLANATIONS[reason];
}

/** Sorts the locations a customer should look at first (AC-5.3). */
const STATUS_RANK: Record<ComparisonStatus, number> = {
  above: 0,
  below: 1,
  typical: 2,
  insufficient_history: 3,
};

export function rankStatus(status: ComparisonStatus): number {
  return STATUS_RANK[status];
}