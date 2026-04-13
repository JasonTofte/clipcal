import type { ConflictResult } from '@/lib/conflict';
import { cn } from '@/lib/utils';

export interface ConflictBadgeProps {
  conflict: ConflictResult;
  className?: string;
}

export function ConflictBadge({ conflict, className }: ConflictBadgeProps) {
  if (conflict.status === 'free') {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400',
          className,
        )}
      >
        <span aria-hidden>✓</span>
        <span>you&rsquo;re free</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-400',
        className,
      )}
    >
      <span aria-hidden>⚠</span>
      <span>
        overlaps <span className="font-semibold">{conflict.conflictTitle}</span>
      </span>
    </div>
  );
}
