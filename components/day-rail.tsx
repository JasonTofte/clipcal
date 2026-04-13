'use client';

import { useMemo } from 'react';
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
  railHeight?: number; // px
  onSelectEvent?: (event: Event) => void;
  onBack?: () => void;
};

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
  rangeStartHour = 8,
  rangeEndHour = 22,
  railHeight = 520,
  onSelectEvent,
  onBack,
}: Props) {
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

    for (const ev of events) {
      const s = new Date(ev.start);
      if (Number.isNaN(s.getTime())) continue;
      if (s < dayStart || s >= dayEnd) continue;
      if (s < rangeStart) earlierCount += 1;
      else if (s >= rangeEnd) laterCount += 1;
      else {
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

    return { inDay, busyInDay, earlierCount, laterCount };
  }, [events, busySlots, dayStart, dayEnd, rangeStart, rangeEnd]);

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
        <div className="mb-2 rounded-lg border border-dashed px-3 py-2 text-[12px]"
             style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          Earlier today: {layout.earlierCount} event{layout.earlierCount === 1 ? '' : 's'} before {formatHour(rangeStartHour)}
        </div>
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
          const heightPct =
            ((b.end.getTime() - b.start.getTime()) / MS_PER_MIN / totalMinutes) *
            100;
          return (
            <div
              key={`busy-${i}`}
              role="listitem"
              className="absolute left-0 right-0 rounded-lg px-2 py-1 text-[11px]"
              style={{
                top: `${topPct}%`,
                height: `${Math.max(3, heightPct)}%`,
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
          const heightPct = Math.max(minPct, computedPct);
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
        <div className="mt-2 rounded-lg border border-dashed px-3 py-2 text-[12px]"
             style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
          After {formatHour(rangeEndHour)}: {layout.laterCount} event{layout.laterCount === 1 ? '' : 's'}
        </div>
      )}
    </section>
  );
}
