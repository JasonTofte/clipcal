'use client';

import { useLeaveByNotifications } from '@/hooks/use-leave-by-notifications';
import type { Event } from '@/lib/schema';

type Props = {
  events: Event[];
};

export function LeaveByNotifyChip({ events }: Props) {
  const { permission, optedIn, requestOptIn, optOut } =
    useLeaveByNotifications(events);

  if (permission === 'unsupported') return null;
  if (permission === 'denied') return null;

  const on = permission === 'granted' && optedIn;

  return (
    <button
      type="button"
      onClick={on ? optOut : requestOptIn}
      aria-pressed={on}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-xs font-semibold"
      style={
        on
          ? {
              background: 'var(--goldy-gold-400)',
              color: 'var(--goldy-maroon-700)',
              borderColor: 'var(--goldy-gold-400)',
            }
          : {
              background: 'var(--surface-paper)',
              color: 'var(--foreground)',
              borderColor: 'var(--border)',
            }
      }
    >
      <span aria-hidden>🔔</span>
      {on ? 'Leave-by alerts on' : 'Notify me when to leave'}
    </button>
  );
}
