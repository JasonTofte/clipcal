'use client';

import type { Event } from '@/lib/schema';
import { formatWeekRange } from '@/lib/format';

// Shares the encoding of WeekDensity (home): bucketed fill against
// busiest-day count, hollow gold-ring for open days, maroon fill with
// count inside for busy days, today underline under the letter.
// Adds tap-to-filter so /feed can zoom to one weekday.

type Props = {
  events: Event[];
  weekStart?: Date;
  selectedDayIdx?: number | null;
  onSelectDay?: (idx: number | null) => void;
};

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

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
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

export function GoldyWeekGlance({
  events,
  weekStart,
  selectedDayIdx = null,
  onSelectDay,
}: Props) {
  const interactive = !!onSelectDay;
  const start = weekStart ?? startOfWeekMonday(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const maxCount = Math.max(1, ...counts);
  const todayIdx = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);

  const handleDayTap = (i: number) => {
    if (!onSelectDay) return;
    if (selectedDayIdx === i) onSelectDay(null);
    else onSelectDay(i);
  };

  return (
    <section
      aria-labelledby="goldy-week-heading"
      className="mb-5 rounded-2xl border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="goldy-week-heading"
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          This week
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
          const isToday = i === todayIdx;
          const isSelected = selectedDayIdx === i;
          const isOpen = count === 0;

          const pill = (
            <>
              <span
                className={`text-[11px] ${isToday || isSelected ? 'font-bold' : 'font-semibold'}`}
                style={{
                  color: isSelected
                    ? 'var(--goldy-maroon-600)'
                    : isToday
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
              <li key={label} className="flex flex-col items-center gap-1.5">
                {pill}
              </li>
            );
          }

          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => handleDayTap(i)}
                aria-pressed={isSelected}
                aria-label={ariaLabel}
                className="flex min-h-[72px] w-full flex-col items-center gap-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  // @ts-expect-error - custom ring color
                  '--tw-ring-color': 'var(--goldy-gold-400)',
                }}
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
