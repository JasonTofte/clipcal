'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';

// Proportional time rail for a single day — renders each block with
// pixel height = (durationMinutes / totalMinutes) * railHeight. This
// externalizes time into the world (Risko & Gilbert 2016 cognitive
// offloading; Barkley "make the invisible visible" for ADHD). Events
// outside the displayed hour window collapse into summary rows at the
// top ("Earlier today") and bottom ("After 10 PM") with counts.

type Props = {
  dayIdx: number; // 0 = Monday
  weekStart: Date;
  events: Event[];
  busySlots: BusySlot[];
  now?: Date;
  rangeStartHour?: number;
  rangeEndHour?: number;
  // When omitted, the rail auto-sizes to 55% of the viewport height (clamped
  // 320–640). Motor-impaired users on small phones otherwise hit a double-
  // scroll trap inside a rail taller than the viewport.
  railHeight?: number;
  onSelectEvent?: (event: Event) => void;
  onBack?: () => void;
};

function useAutoRailHeight(explicit: number | undefined): number {
  const [height, setHeight] = useState<number>(explicit ?? 520);
  useEffect(() => {
    if (explicit !== undefined) return;
    if (typeof window === 'undefined') return;
    const compute = () =>
      setHeight(Math.max(320, Math.min(640, Math.round(window.innerHeight * 0.55))));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [explicit]);
  return height;
}

const MS_PER_MIN = 60 * 1000;

function dayBoundsFor(weekStart: Date, dayIdx: number): { start: Date; end: Date } {
  const start = new Date(weekStart);
  start.setDate(start.getDate() + dayIdx);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function hourFraction(d: Date, rangeStart: Date, totalMinutes: number): number {
  const minsFromStart = (d.getTime() - rangeStart.getTime()) / MS_PER_MIN;
  return Math.max(0, Math.min(1, minsFromStart / totalMinutes));
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTimeRange(start: Date, end: Date | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
  };
  const startStr = start.toLocaleTimeString('en-US', opts);
  if (!end) return startStr;
  return `${startStr} – ${end.toLocaleTimeString('en-US', opts)}`;
}

export function DayRail({
  dayIdx,
  weekStart,
  events,
  busySlots,
  now,
  rangeStartHour: rangeStartHourProp = 8,
  rangeEndHour: rangeEndHourProp = 22,
  railHeight: railHeightProp,
  onSelectEvent,
  onBack,
}: Props) {
  const railHeight = useAutoRailHeight(railHeightProp);
  const [rangeStartHour, setRangeStartHour] = useState(rangeStartHourProp);
  const [rangeEndHour, setRangeEndHour] = useState(rangeEndHourProp);
  const nowDate = now ?? new Date();
  const { start: dayStart, end: dayEnd } = dayBoundsFor(weekStart, dayIdx);

  const rangeStart = new Date(dayStart);
  rangeStart.setHours(rangeStartHour, 0, 0, 0);
  const rangeEnd = new Date(dayStart);
  rangeEnd.setHours(rangeEndHour, 0, 0, 0);
  const totalMinutes = (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_MIN;

  const layout = useMemo(() => {
    const inDay: { event: Event; start: Date; end: Date | null }[] = [];
    let earlierCount = 0;
    let laterCount = 0;
    let earliestHour: number | null = null;
    let latestHour: number | null = null;

    for (const ev of events) {
      const s = new Date(ev.start);
      if (Number.isNaN(s.getTime())) continue;
      if (s < dayStart || s >= dayEnd) continue;
      if (s < rangeStart) {
        earlierCount += 1;
        const h = s.getHours();
        if (earliestHour === null || h < earliestHour) earliestHour = h;
      } else if (s >= rangeEnd) {
        laterCount += 1;
        const endHr = ev.end ? new Date(ev.end).getHours() || 23 : s.getHours();
        if (latestHour === null || endHr > latestHour) latestHour = endHr;
      } else {
        const e = ev.end ? new Date(ev.end) : null;
        inDay.push({ event: ev, start: s, end: e });
      }
    }

    const busyInDay = busySlots.filter(
      (b) =>
        b.start < dayEnd &&
        b.end > dayStart &&
        b.start < rangeEnd &&
        b.end > rangeStart,
    );

    return { inDay, busyInDay, earlierCount, laterCount, earliestHour, latestHour };
  }, [events, busySlots, dayStart, dayEnd, rangeStart, rangeEnd]);

  const expandEarlier = () => {
    if (layout.earliestHour !== null) setRangeStartHour(layout.earliestHour);
  };
  const expandLater = () => {
    if (layout.latestHour !== null) setRangeEndHour(Math.min(23, layout.latestHour + 1));
  };

  const showNowLine = nowDate >= rangeStart && nowDate < rangeEnd;
  const nowTopPct = hourFraction(nowDate, rangeStart, totalMinutes) * 100;

  const hourMarks: number[] = [];
  for (let h = rangeStartHour; h <= rangeEndHour; h += 2) hourMarks.push(h);

  const dayLabel = dayStart.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <section
      aria-labelledby="day-rail-heading"
      className="rounded-2xl border p-4"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface-paper)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="day-rail-heading"
          className="text-[15px] font-bold"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          {dayLabel}
        </h2>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] font-semibold underline"
            style={{ color: 'var(--goldy-maroon-500)', minHeight: 44, paddingInline: 12 }}
          >
            Back to week
          </button>
        )}
      </div>

      {layout.earlierCount > 0 && (
        <button
          type="button"
          onClick={expandEarlier}
          aria-label={`Show ${layout.earlierCount} event${layout.earlierCount === 1 ? '' : 's'} earlier than ${formatHour(rangeStartHour)}`}
          className="mb-2 w-full rounded-lg border border-dashed px-3 py-2 text-left text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
            minHeight: 44,
          }}
        >
          ↑ Earlier today: {layout.earlierCount} event{layout.earlierCount === 1 ? '' : 's'} before {formatHour(rangeStartHour)}
          <span className="ml-2 font-semibold" style={{ color: 'var(--goldy-maroon-500)' }}>
            Show
          </span>
        </button>
      )}

      <div
        className="relative"
        style={{
          marginLeft: 40,
          borderLeft: '1px dashed var(--border)',
          paddingLeft: 10,
          height: railHeight,
        }}
        role="list"
        aria-label={`Schedule from ${formatHour(rangeStartHour)} to ${formatHour(rangeEndHour)}`}
      >
        {hourMarks.map((h) => {
          const topPct = ((h - rangeStartHour) / (rangeEndHour - rangeStartHour)) * 100;
          return (
            <span
              key={h}
              aria-hidden
              className="absolute font-mono text-[10px]"
              style={{
                left: -40,
                top: `${topPct}%`,
                width: 32,
                textAlign: 'right',
                color: 'var(--muted-foreground)',
              }}
            >
              {formatHour(h)}
            </span>
          );
        })}

        {layout.busyInDay.map((b, i) => {
          const topPct = hourFraction(b.start, rangeStart, totalMinutes) * 100;
          const rawHeightPct =
            ((b.end.getTime() - b.start.getTime()) / MS_PER_MIN / totalMinutes) *
            100;
          const maxHeightPct = Math.max(0, 100 - topPct);
          const heightPct = Math.min(Math.max(3, rawHeightPct), maxHeightPct);
          return (
            <div
              key={`busy-${i}`}
              role="listitem"
              className="absolute left-0 right-0 rounded-lg px-2 py-1 text-[11px]"
              style={{
                top: `${topPct}%`,
                height: `${heightPct}%`,
                background: 'var(--goldy-maroon-500)',
                color: '#FFF',
              }}
              aria-label={`Busy: ${b.title}, ${formatTimeRange(b.start, b.end)}`}
            >
              <strong>{b.title}</strong>
              <span className="ml-2 opacity-80">{formatTimeRange(b.start, b.end)}</span>
            </div>
          );
        })}

        {layout.inDay.map(({ event, start, end }, i) => {
          const topPct = hourFraction(start, rangeStart, totalMinutes) * 100;
          const computedPct = end
            ? ((end.getTime() - start.getTime()) / MS_PER_MIN / totalMinutes) * 100
            : 4;
          // WCAG 2.5.8 + Apple HIG: 44px minimum tap target. Short events
          // (e.g., a 15-min pop-up) get a visually taller block than strictly
          // proportional so motor-impaired users can hit them. The label
          // overflows via ellipsis when the duration is genuinely short.
          const MIN_TAP_PX = 44;
          const minPct = (MIN_TAP_PX / railHeight) * 100;
          // Clamp to rail bottom. All-day events (24h end) otherwise produce
          // heightPct > 100% against the 14h visible window and bleed over
          // sibling sections since the rail has no overflow: hidden.
          const maxHeightPct = Math.max(minPct, 100 - topPct);
          const heightPct = Math.min(Math.max(minPct, computedPct), maxHeightPct);
          return (
            <button
              key={`ev-${i}`}
              type="button"
              onClick={() => onSelectEvent?.(event)}
              className="absolute left-0 right-0 overflow-hidden text-left rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
              style={{
                top: `${topPct}%`,
                height: `${heightPct}%`,
                background: 'var(--goldy-gold-400)',
                color: 'var(--goldy-maroon-700)',
                border: '1px solid var(--goldy-gold-500)',
                padding: '6px 10px',
                fontSize: 12,
                lineHeight: 1.25,
              }}
              aria-label={`${event.title} at ${formatTimeRange(start, end)}`}
            >
              <strong className="block truncate">{event.title}</strong>
              <span className="block truncate opacity-80">
                {formatTimeRange(start, end)}
                {event.location ? ` · ${event.location}` : ''}
              </span>
            </button>
          );
        })}

        {showNowLine && (
          <div
            aria-hidden
            className="absolute left-[-6px] right-[-8px] rounded-sm"
            style={{
              top: `${nowTopPct}%`,
              height: 2,
              background: 'var(--goldy-maroon-500)',
            }}
          >
            <span
              className="absolute -left-1 -top-1 h-2 w-2 rounded-full"
              style={{
                background: 'var(--goldy-maroon-500)',
                boxShadow: '0 0 0 3px rgba(122,0,25,0.18)',
              }}
            />
          </div>
        )}
      </div>

      {layout.laterCount > 0 && (
        <button
          type="button"
          onClick={expandLater}
          aria-label={`Show ${layout.laterCount} event${layout.laterCount === 1 ? '' : 's'} later than ${formatHour(rangeEndHour)}`}
          className="mt-2 w-full rounded-lg border border-dashed px-3 py-2 text-left text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
            minHeight: 44,
          }}
        >
          ↓ After {formatHour(rangeEndHour)}: {layout.laterCount} event{layout.laterCount === 1 ? '' : 's'}
          <span className="ml-2 font-semibold" style={{ color: 'var(--goldy-maroon-500)' }}>
            Show
          </span>
        </button>
      )}
    </section>
  );
}
