'use client';

import { useEffect, useMemo, useState } from 'react';
import { GoldyAvatar } from '@/components/goldy-avatar';
import {
  computeDayOfState,
  parseNowOverride,
  type DayOfState,
} from '@/lib/day-of-reminder';
import { formatEventWhen } from '@/lib/format';
import type { Event } from '@/lib/schema';

type Props = {
  events: Event[];
};

// Tick the clock every 30s. Feed re-renders light — this is cheap and
// means the countdown stays fresh without needing a 1s timer.
const TICK_MS = 30_000;

export function GoldyDayOfBanner({ events }: Props) {
  const [tick, setTick] = useState(0);
  const nowOverride = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseNowOverride(window.location.search);
  }, []);

  useEffect(() => {
    // If we're using a frozen override for a demo, don't repaint on tick.
    if (nowOverride) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [nowOverride]);

  const state = useMemo(() => {
    const now = nowOverride ?? new Date();
    return computeDayOfState(events, now);
    // `tick` is intentionally included so the memo recomputes each interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, nowOverride, tick]);

  if (!state) return null;

  return <BannerView state={state} />;
}

function BannerView({ state }: { state: DayOfState }) {
  const { phase, event, leaveBy, minutesToLeaveBy, minutesToStart } = state;
  const isUrgent = phase === 'urgent' || phase === 'leaving-now';

  const bg = isUrgent
    ? 'linear-gradient(135deg, var(--goldy-maroon-600), var(--goldy-maroon-700))'
    : 'linear-gradient(135deg, var(--goldy-gold-400), var(--goldy-gold-200))';
  const fg = isUrgent ? 'white' : 'var(--goldy-maroon-700)';
  const mutedFg = isUrgent
    ? 'rgba(255,255,255,0.8)'
    : 'var(--goldy-maroon-500)';

  const headline = buildHeadline(state);
  const subline = buildSubline(state);
  const countdown = buildCountdown(state);

  return (
    <section
      role="status"
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-label={`Day-of reminder: ${headline}`}
      className="mb-4 overflow-hidden rounded-2xl shadow-lg"
      style={{ background: bg }}
    >
      <div className="flex items-stretch gap-3 p-3 sm:p-4">
        <div className="flex shrink-0 items-start pt-0.5">
          <GoldyAvatar size={48} decorative />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: mutedFg }}
          >
            <span>{isUrgent ? "⚡ It's time" : '🕒 Coming up'}</span>
            <span aria-hidden>·</span>
            <span>{countdown}</span>
          </div>
          <div
            className="mt-0.5 text-base font-bold leading-tight"
            style={{ color: fg }}
          >
            {headline}
          </div>
          <div
            className="mt-0.5 text-xs leading-snug"
            style={{ color: mutedFg }}
          >
            {subline}
          </div>

          {leaveBy && (
            <div
              className="mt-2 flex items-center justify-between rounded-xl px-3 py-2"
              style={{
                background: isUrgent
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(90,0,19,0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">🚶</span>
                <div className="leading-tight">
                  <div
                    className="text-[9px] font-medium uppercase tracking-wider"
                    style={{ color: mutedFg }}
                  >
                    leave by
                  </div>
                  <div
                    className="text-lg font-bold tracking-tight"
                    style={{ color: fg }}
                  >
                    {leaveBy.displayText}
                  </div>
                </div>
              </div>
              <div
                className="text-right text-[11px]"
                style={{ color: mutedFg }}
              >
                <div>{leaveBy.walkMinutes}-min walk</div>
                {event.location && (
                  <div className="truncate max-w-[12ch] sm:max-w-[20ch]">
                    {event.location.split(',')[0]}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug hint, only visible when minutesToStart is absurd — helps
          presenters confirm `?now=…` is in effect. */}
      {minutesToStart > 0 && minutesToStart < 1 && (
        <div
          className="px-4 pb-2 text-[10px]"
          style={{ color: mutedFg }}
        >
          starting any second now
        </div>
      )}
    </section>
  );
}

function buildHeadline(state: DayOfState): string {
  const { event, phase } = state;
  if (phase === 'leaving-now') return `Time to move — ${event.title}`;
  if (phase === 'urgent') return event.title;
  return event.title;
}

function buildSubline(state: DayOfState): string {
  const { event, phase, minutesToStart } = state;
  const when = formatEventWhen(event.start);
  const loc = event.location ? ` · ${event.location}` : '';
  if (phase === 'urgent') {
    return `Starts in ${minutesToStart} min${loc ? ` · ${event.location}` : ''}`;
  }
  if (phase === 'leaving-now') {
    return `Doors at ${formatTimeOnly(new Date(event.start))}${loc}`;
  }
  return `${when}${loc}`;
}

function buildCountdown(state: DayOfState): string {
  const { phase, minutesToLeaveBy, minutesToStart } = state;
  if (phase === 'leaving-now') return `starts in ${minutesToStart} min`;
  if (phase === 'urgent') return `leave in ${minutesToLeaveBy} min`;
  // heads-up
  const hours = Math.floor(minutesToStart / 60);
  const mins = minutesToStart % 60;
  if (hours === 0) return `in ${mins} min`;
  if (mins === 0) return `in ${hours} hr`;
  return `in ${hours}h ${mins}m`;
}

function formatTimeOnly(d: Date): string {
  const h24 = d.getHours();
  const m = d.getMinutes();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const p = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${p}`;
}
