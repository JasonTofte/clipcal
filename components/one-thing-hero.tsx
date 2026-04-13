'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  computeDayOfState,
  findNextUpcomingEvent,
  parseNowOverride,
  type DayOfPhase,
} from '@/lib/day-of-reminder';
import { computeLeaveBy, type LeaveByInfo } from '@/lib/leave-by';
import { formatEventWhen } from '@/lib/format';
import type { GoldyContext } from '@/lib/goldy-commentary';
import { pickGoldyLine } from '@/lib/goldy-commentary';
import type { Event } from '@/lib/schema';
import type { CampusFeedResponse } from '@/app/api/campus-feed/route';

// Hero takes a payload in two modes:
//  • when an event lives in the ranked feed, caller passes that payload
//    so the hero stays in lockstep with the ctx/line already computed.
//  • when no ranked match, hero falls back to findNextUpcomingEvent +
//    local ctx generation (so the hero still shows on pages where the
//    ranked list is gated by filters).
type RankedPayload = {
  event: Event;
  ctx: GoldyContext;
  line: string;
};

type Props = {
  events: Event[];
  ranked?: RankedPayload[];
  onAddToCalendar?: (event: Event) => void;
  onSnooze?: (event: Event, minutes: number) => void;
  onHide?: (event: Event) => void;
};

const TICK_MS = 30_000;

export function OneThingHero({
  events,
  ranked,
  onAddToCalendar,
  onSnooze,
  onHide,
}: Props) {
  const [tick, setTick] = useState(0);
  // Live-fallback: when the user has uploaded nothing AND nothing in
  // the local events list is upcoming, fetch one event from the campus
  // feed so the hero still has something authentic to surface.
  const [liveFallback, setLiveFallback] = useState<Event | null>(null);
  const nowOverride = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseNowOverride(window.location.search);
  }, []);

  useEffect(() => {
    if (nowOverride) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [nowOverride]);

  // Trigger the live fetch only when local data is exhausted. Avoids a
  // wasteful network call for the common case of users with uploads.
  useEffect(() => {
    const now = nowOverride ?? new Date();
    const haveLocal =
      (ranked && ranked.length > 0) ||
      findNextUpcomingEvent(events, now) !== null;
    if (haveLocal) {
      if (liveFallback) setLiveFallback(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/campus-feed');
        if (!res.ok) return;
        const json = (await res.json()) as CampusFeedResponse;
        const earliest = json.events
          .filter((e) => new Date(e.date_iso).getTime() > now.getTime())
          .sort((a, b) => a.date_iso.localeCompare(b.date_iso))[0];
        if (!earliest || cancelled) return;
        setLiveFallback({
          title: earliest.title,
          start: earliest.date_iso,
          end: null,
          location: earliest.location ?? null,
          description: earliest.group_title ?? null,
          category: 'other',
          hasFreeFood: false,
          timezone: 'America/Chicago',
          confidence: 'high',
        });
      } catch {
        // Network error — leave fallback null; hero stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ranked, nowOverride, tick]);

  const payload = useMemo(() => {
    const now = nowOverride ?? new Date();
    // Prefer the top-ranked item if the caller passed ranked results.
    if (ranked && ranked.length > 0) {
      const top = ranked[0];
      const leaveBy = computeLeaveBy(top.event);
      const phase = computeDayOfState([top.event], now)?.phase ?? 'heads-up';
      const start = new Date(top.event.start).getTime();
      const minutesToStart = Math.max(0, Math.round((start - now.getTime()) / 60000));
      return {
        event: top.event,
        ctx: top.ctx,
        line: top.line,
        leaveBy,
        phase,
        minutesToStart,
        isLiveFallback: false,
      };
    }
    // Fallback 1: next upcoming local event (within the day-of window).
    const next = findNextUpcomingEvent(events, now);
    if (next) {
      const leaveBy = computeLeaveBy(next);
      const phase = computeDayOfState([next], now)?.phase ?? 'heads-up';
      const minutesToStart = Math.max(
        0,
        Math.round((new Date(next.start).getTime() - now.getTime()) / 60000),
      );
      const ctx: GoldyContext = { bucket: 'default', slots: {} };
      return {
        event: next,
        ctx,
        line: pickGoldyLine(next, ctx),
        leaveBy,
        phase,
        minutesToStart,
        isLiveFallback: false,
      };
    }
    // Fallback 2: next live UMN campus event. May lack time-of-day, in
    // which case computeLeaveBy returns null and we render a no-leave-by
    // panel.
    if (liveFallback) {
      const leaveBy = computeLeaveBy(liveFallback);
      const minutesToStart = Math.max(
        0,
        Math.round((new Date(liveFallback.start).getTime() - now.getTime()) / 60000),
      );
      const ctx: GoldyContext = { bucket: 'default', slots: {} };
      return {
        event: liveFallback,
        ctx,
        line: pickGoldyLine(liveFallback, ctx),
        leaveBy,
        phase: 'heads-up' as DayOfPhase,
        minutesToStart,
        isLiveFallback: true,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, ranked, liveFallback, nowOverride, tick]);

  if (!payload) return null;

  const { event, line, leaveBy, phase, minutesToStart, isLiveFallback } = payload;
  const isUrgent = phase === 'urgent' || phase === 'leaving-now';

  return (
    <section
      role="region"
      aria-labelledby="next-up-title"
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className="relative mb-5 rounded-3xl border p-5"
      style={{
        background: 'var(--surface-paper)',
        borderColor: 'var(--border)',
        boxShadow:
          '0 1px 2px rgba(26,18,16,0.04), 0 10px 30px -12px rgba(122,0,25,0.12)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--goldy-maroon-600)' }}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--goldy-maroon-500)' }}
        />
        {isUrgent
          ? "it's time"
          : isLiveFallback
            ? 'happening on campus'
            : 'next up'}
      </div>

      <h2
        id="next-up-title"
        className="mt-2 text-[22px] font-bold leading-tight"
        style={{ color: 'var(--foreground)' }}
      >
        {event.title}
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {formatEventWhen(event.start)}
        {event.location ? ` · ${event.location}` : ''}
      </p>

      {leaveBy ? (
        <LeaveByPanel leaveBy={leaveBy} phase={phase} minutesToStart={minutesToStart} />
      ) : (
        <NoLocationPanel minutesToStart={minutesToStart} />
      )}

      <p
        className="mt-4 text-[15px] leading-relaxed"
        style={{ color: 'var(--foreground)' }}
      >
        <span
          className="mr-1 inline-block rounded-md px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider"
          style={{ background: 'var(--goldy-maroon-500)', color: 'white' }}
        >
          goldy
        </span>
        {line}
      </p>

      <div className="mt-5 space-y-2">
        {onAddToCalendar && (
          <button
            type="button"
            onClick={() => onAddToCalendar(event)}
            className="press w-full rounded-2xl py-3.5 text-base font-bold"
            style={{
              background: 'var(--goldy-maroon-500)',
              color: 'white',
              minHeight: 48,
            }}
          >
            Add to calendar
          </button>
        )}
        <div className="flex gap-2">
          {onSnooze && (
            <button
              type="button"
              onClick={() => onSnooze(event, 5)}
              className="press flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
              style={{
                background: 'var(--surface-paper)',
                color: 'var(--muted-foreground)',
                borderColor: 'var(--border)',
                minHeight: 44,
              }}
            >
              Snooze 5 min
            </button>
          )}
          {onHide && (
            <button
              type="button"
              onClick={() => onHide(event)}
              className="press flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
              style={{
                background: 'var(--surface-paper)',
                color: 'var(--muted-foreground)',
                borderColor: 'var(--border)',
                minHeight: 44,
              }}
            >
              Not for me
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function LeaveByPanel({
  leaveBy,
  phase,
  minutesToStart,
}: {
  leaveBy: LeaveByInfo;
  phase: DayOfPhase;
  minutesToStart: number;
}) {
  const isUrgent = phase === 'urgent' || phase === 'leaving-now';
  return (
    <div
      className="mt-4 flex items-end justify-between gap-4 rounded-2xl border p-4"
      style={{
        background: 'var(--goldy-maroon-50)',
        borderColor: 'var(--goldy-maroon-100)',
      }}
    >
      <div>
        <div
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          leave by
        </div>
        <div
          className="mt-1 text-5xl font-bold leading-none tracking-tight"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          {leaveBy.displayText}
        </div>
        <div className="mt-1 text-sm" style={{ color: 'var(--goldy-maroon-700)' }}>
          {isUrgent ? 'now-ish' : `in ${minutesToStart} min`}
        </div>
      </div>
      <div className="text-right text-xs" style={{ color: 'var(--goldy-maroon-700)' }}>
        <div className="font-semibold">{leaveBy.walkMinutes}-min walk</div>
      </div>
    </div>
  );
}

function NoLocationPanel({ minutesToStart }: { minutesToStart: number }) {
  return (
    <div
      className="mt-4 rounded-2xl border p-4 text-sm"
      style={{
        background: 'var(--goldy-maroon-50)',
        borderColor: 'var(--goldy-maroon-100)',
        color: 'var(--goldy-maroon-700)',
      }}
    >
      No location on this one — I can&rsquo;t do leave-by math. Starts in{' '}
      <strong>{minutesToStart} min</strong>.
    </div>
  );
}
