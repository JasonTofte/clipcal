'use client';

import type { BusySlot } from '@/lib/demo-calendar';

// Research-backed redesign (see PR): 7 rounded pills, fill bucketed to
// 0/25/60/100% against the busiest day (NOT against 24h — fixes the
// earlier hairline problem). Maroon fill = busy with count inside;
// hollow gold-ring = open slot (Moran/NN/g: "make next available
// action visually dominant"). Today gets a 2px underline under the
// day letter. Inline "Next open day: X" line below the strip.

type WeekDensityProps = {
  busySlots: BusySlot[];
  now?: Date;
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

function startOfIsoWeek(d: Date): Date {
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

// Bucketed fill to trade continuous-length precision for pre-attentive
// categorical read. 0 = empty, 1 = light, 2 = some, 3 = packed. Bucket
// selected by count vs. busiest-day count so a 3-event week and a
// 12-event week both fill their busy days visibly.
function bucketFor(count: number, max: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (max <= 1) return 3;
  const ratio = count / max;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

const BUCKET_FILL_PCT = [0, 30, 65, 100] as const;

export function WeekDensity({ busySlots, now = new Date() }: WeekDensityProps) {
  const monday = startOfIsoWeek(now);

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayStart = new Date(monday);
    dayStart.setDate(dayStart.getDate() + dayIndex);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = busySlots.filter(
      (slot) => slot.start < dayEnd && slot.end > dayStart,
    ).length;

    return {
      index: dayIndex,
      label: DAY_LABELS[dayIndex],
      fullName: DAY_FULL[dayIndex],
      isToday: isSameDay(dayStart, now),
      count,
    };
  });

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const firstOpenDay = days.find((d) => d.count === 0);

  return (
    <section
      aria-labelledby="weekdensity-heading"
      className="rounded-2xl border bg-card p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="weekdensity-heading"
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          This week
        </h2>
        <span
          className="text-[10px] font-mono"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {busySlots.length} busy block{busySlots.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="grid grid-cols-7 gap-1.5" role="list">
        {days.map((day) => {
          const bucket = bucketFor(day.count, maxCount);
          const fillPct = BUCKET_FILL_PCT[bucket];
          const isOpen = day.count === 0;
          return (
            <li key={day.index} className="flex flex-col items-center gap-1.5">
              <span
                className={`text-[11px] ${day.isToday ? 'font-bold' : 'font-semibold'}`}
                style={{
                  color: day.isToday
                    ? 'var(--goldy-maroon-600)'
                    : isOpen
                      ? 'var(--goldy-gold-700)'
                      : 'var(--muted-foreground)',
                  borderBottom: day.isToday
                    ? '2px solid var(--goldy-maroon-500)'
                    : '2px solid transparent',
                  lineHeight: 1,
                  paddingBottom: 2,
                }}
                aria-hidden
              >
                {day.label}
              </span>

              <div
                className="relative w-full overflow-hidden"
                style={{
                  height: 52,
                  borderRadius: 12,
                  background: isOpen ? 'transparent' : 'var(--surface-calm)',
                  border: isOpen
                    ? '1.5px solid var(--goldy-gold-400)'
                    : '1px solid var(--border)',
                }}
                aria-label={`${day.fullName}: ${
                  day.count === 0
                    ? 'open'
                    : `${day.count} event${day.count === 1 ? '' : 's'}`
                }${day.isToday ? ' (today)' : ''}`}
                role="img"
              >
                {/* Filled maroon for busy days, bucketed height */}
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
                {/* Count numeral for busy days */}
                {!isOpen && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      color: fillPct >= 60 ? 'white' : 'var(--goldy-maroon-600)',
                    }}
                  >
                    {day.count}
                  </span>
                )}
                {/* Gold dot for open days (categorical cue) */}
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
            </li>
          );
        })}
      </ul>

      {firstOpenDay && (
        <p
          className="mt-3 text-xs"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <span aria-hidden>👀 </span>
          Next open day:{' '}
          <strong
            className="font-semibold"
            style={{ color: 'var(--goldy-maroon-600)' }}
          >
            {firstOpenDay.fullName}
          </strong>
          .
        </p>
      )}
    </section>
  );
}
