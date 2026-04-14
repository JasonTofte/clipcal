'use client';

import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';
import { formatWeekRange } from '@/lib/format';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type WeekStripMode =
  | { source: 'events'; events: Event[] }
  | { source: 'busy'; busySlots: BusySlot[] };

type Props = {
  mode: WeekStripMode;
  weekStart?: Date;
  selectedDayIdx?: number | null;
  onSelectDay?: (idx: number | null) => void;
  now?: Date;
  caption?: string;
};

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function countEventsPerDay(events: Event[], start: Date): number[] {
  const counts = new Array(7).fill(0) as number[];
  for (const ev of events) {
    const d = new Date(ev.start);
    if (Number.isNaN(d.getTime())) continue;
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const daysFromStart = Math.round(
      (dayStart.getTime() - start.getTime()) / MS_PER_DAY,
    );
    if (daysFromStart >= 0 && daysFromStart < 7) counts[daysFromStart] += 1;
  }
  return counts;
}

function countBusyPerDay(busySlots: BusySlot[], start: Date): number[] {
  const counts = new Array(7).fill(0) as number[];
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    counts[i] = busySlots.filter(
      (slot) => slot.start < dayEnd && slot.end > dayStart,
    ).length;
  }
  return counts;
}

export function WeekStrip({
  mode,
  weekStart,
  selectedDayIdx = null,
  onSelectDay,
  now,
  caption,
}: Props) {
  const start = weekStart ?? startOfWeekMonday(now ?? new Date());
  const today = now ?? new Date();
  const interactive = !!onSelectDay;

  const counts =
    mode.source === 'events'
      ? countEventsPerDay(mode.events, start)
      : countBusyPerDay(mode.busySlots, start);

  const handleTap = (i: number) => {
    if (!onSelectDay) return;
    onSelectDay(selectedDayIdx === i ? null : i);
  };

  return (
    <section aria-labelledby="week-strip-heading" className="mb-5">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2
          id="week-strip-heading"
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          {caption ?? 'This week'}
        </h2>
        <span
          className="text-[10px]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {formatWeekRange(start)}
        </span>
      </div>

      <ul className="grid grid-cols-7 gap-1" role="list">
        {DAY_LABELS.map((label, i) => {
          const count = counts[i];
          const dayStart = new Date(start);
          dayStart.setDate(dayStart.getDate() + i);
          const isToday = isSameDay(dayStart, today);
          const isSelected = selectedDayIdx === i;
          const hasEvents = count > 0;
          const dayNum = dayStart.getDate();

          const bg = isSelected
            ? 'var(--goldy-maroon-500)'
            : isToday
              ? 'var(--goldy-gold-100)'
              : 'transparent';
          const fg = isSelected
            ? 'white'
            : isToday
              ? 'var(--goldy-maroon-700)'
              : 'var(--foreground)';
          const letterFg = isSelected
            ? 'rgba(255,255,255,0.85)'
            : 'var(--muted-foreground)';
          const dotColor = isSelected
            ? 'rgba(255,255,255,0.95)'
            : 'var(--goldy-maroon-500)';

          const cell = (
            <div
              className="flex flex-col items-center justify-center"
              style={{
                minHeight: 56,
                borderRadius: 12,
                background: bg,
                padding: '6px 0 4px',
                transition: 'background-color 120ms ease',
              }}
            >
              <span
                className="text-[17px] font-bold leading-none tabular-nums"
                style={{ color: fg }}
              >
                {dayNum}
              </span>
              <span
                className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-wide"
                style={{ color: letterFg }}
              >
                {label}
              </span>
              <span
                aria-hidden
                className="mt-1.5 block rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: hasEvents ? dotColor : 'transparent',
                }}
              />
            </div>
          );

          const ariaLabel = `${DAY_FULL[i]} ${dayNum}: ${
            count === 0 ? 'no events' : `${count} event${count === 1 ? '' : 's'}`
          }${isToday ? ' (today)' : ''}${isSelected ? ' (filter active)' : ''}`;

          if (!interactive) {
            return (
              <li key={label + i} aria-label={ariaLabel}>
                {cell}
              </li>
            );
          }

          return (
            <li key={label + i}>
              <button
                type="button"
                onClick={() => handleTap(i)}
                aria-pressed={isSelected}
                aria-label={ariaLabel}
                className="w-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
              >
                {cell}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
