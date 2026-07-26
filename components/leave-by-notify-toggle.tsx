'use client';

import { useLeaveByNotifications } from '@/hooks/use-leave-by-notifications';
import type { Event } from '@/lib/schema';

type Props = {
  events: Event[];
};

export function LeaveByNotifyToggle({ events }: Props) {
  const { permission, optedIn, requestOptIn, optOut } = useLeaveByNotifications(events);

  if (permission === 'unsupported') return null;

  if (permission === 'denied') {
    return (
      <div
        className="mb-4 rounded-2xl border px-3 py-2 text-[11px]"
        style={{
          background: 'var(--goldy-gold-50)',
          borderColor: 'var(--goldy-gold-200)',
          color: 'var(--goldy-maroon-700)',
        }}
      >
        Browser notifications are blocked. The big countdown on this page still works when the tab is open.
      </div>
    );
  }

  if (permission === 'granted' && optedIn) {
    return (
      <div
        className="mb-4 flex items-center justify-between rounded-2xl border px-3 py-2 text-[11px]"
        style={{
          background: 'var(--goldy-gold-50)',
          borderColor: 'var(--goldy-gold-200)',
          color: 'var(--goldy-maroon-700)',
        }}
      >
        <span>
          <strong>🔔 Leave-by pings on.</strong> You&rsquo;ll get a notification 10 min
          before you need to head out. (Tab must stay open.)
        </span>
        <button
          type="button"
          onClick={optOut}
          className="ml-3 shrink-0 rounded-full border px-2.5 py-1 font-semibold"
          style={{
            borderColor: 'var(--goldy-maroon-500)',
            color: 'var(--goldy-maroon-600)',
            background: 'white',
          }}
        >
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div
      className="mb-4 flex items-center justify-between rounded-2xl border px-3 py-2 text-[11px]"
      style={{
        background: 'var(--goldy-gold-50)',
        borderColor: 'var(--goldy-gold-200)',
        color: 'var(--goldy-maroon-700)',
      }}
    >
      <span>
        <strong>Want a nudge before you leave?</strong> I&rsquo;ll ping you 10 min before
        leave-by while this tab is open.
      </span>
      <button
        type="button"
        onClick={requestOptIn}
        className="ml-3 shrink-0 rounded-full px-3 py-1 font-semibold"
        style={{
          background: 'var(--goldy-maroon-500)',
          color: 'var(--goldy-gold-400)',
        }}
      >
        Turn on
      </button>
    </div>
  );
}
