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

function bucketFor(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (max <= 1) return 3;
  const ratio = count / max;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

const BUCKET_FILL_PCT = [0, 30, 65, 100] as const;

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

  const maxCount = Math.max(1, ...counts);

  const handleTap = (i: number) => {
    if (!onSelectDay) return;
    onSelectDay(selectedDayIdx === i ? null : i);
  };

  return (
    <section
      aria-labelledby="week-strip-heading"
      className="mb-5 rounded-2xl border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
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

      <ul className="grid grid-cols-7 gap-1.5" role="list">
        {DAY_LABELS.map((label, i) => {
          const count = counts[i];
          const bucket = bucketFor(count, maxCount);
          const fillPct = BUCKET_FILL_PCT[bucket];
          const dayStart = new Date(start);
          dayStart.setDate(dayStart.getDate() + i);
          const isToday = isSameDay(dayStart, today);
          const isSelected = selectedDayIdx === i;
          const isOpen = count === 0;

          const pill = (
            <>
              <span
                className={`text-[11px] ${isToday || isSelected ? 'font-bold' : 'font-semibold'}`}
                style={{
                  color: isSelected || isToday
                    ? 'var(--goldy-maroon-600)'
                    : isOpen
                      ? 'var(--goldy-gold-700)'
                      : 'var(--muted-foreground)',
                  borderBottom:
                    isToday || isSelected
                      ? '2px solid var(--goldy-maroon-500)'
                      : '2px solid transparent',
                  lineHeight: 1,
                  paddingBottom: 2,
                }}
                aria-hidden
              >
                {label}
              </span>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: isOpen ? 'transparent' : 'var(--surface-calm)',
                  border: isOpen
                    ? '1.5px solid var(--goldy-gold-400)'
                    : isSelected
                      ? '2px solid var(--goldy-maroon-500)'
                      : '1px solid var(--border)',
                  boxShadow: isSelected
                    ? '0 0 0 3px rgba(122,0,25,0.08)'
                    : undefined,
                }}
              >
                {!isOpen && (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: `${fillPct}%`,
                      background: 'var(--goldy-maroon-500)',
                    }}
                  />
                )}
                {!isOpen && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      color: fillPct >= 60 ? 'white' : 'var(--goldy-maroon-600)',
                    }}
                  >
                    {count}
                  </span>
                )}
                {isOpen && (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: 8,
                        height: 8,
                        background: 'var(--goldy-gold-400)',
                      }}
                    />
                  </span>
                )}
              </div>
            </>
          );

          const ariaLabel = `${DAY_FULL[i]}: ${
            count === 0 ? 'open' : `${count} event${count === 1 ? '' : 's'}`
          }${isToday ? ' (today)' : ''}${isSelected ? ' (filter active)' : ''}`;

          if (!interactive) {
            return (
              <li
                key={label + i}
                aria-label={ariaLabel}
                className="flex flex-col items-center gap-1.5"
              >
                {pill}
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
                className="flex min-h-[72px] w-full flex-col items-center gap-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
              >
                {pill}
              </button>
            </li>
          );
        })}
      </ul>

      {interactive && (
        <p
          className="mt-3 text-[11px]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Tap a day to filter · tap again to clear.
        </p>
      )}
    </section>
  );
}
