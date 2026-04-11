'use client';

import type { BusySlot } from '@/lib/demo-calendar';
import { cn } from '@/lib/utils';

type WeekDensityProps = {
  busySlots: BusySlot[];
  now?: Date;
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Total minutes in a day for block height math
const DAY_MINUTES = 24 * 60;

export function WeekDensity({ busySlots, now = new Date() }: WeekDensityProps) {
  const monday = startOfIsoWeek(now);

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayStart = new Date(monday);
    dayStart.setDate(dayStart.getDate() + dayIndex);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const slotsOnDay = busySlots
      .filter((slot) => slot.start < dayEnd && slot.end > dayStart)
      .map((slot) => ({
        title: slot.title,
        topPct: clampPct(minutesSinceMidnight(slot.start, dayStart) / DAY_MINUTES),
        heightPct: clampPct(
          (minutesSinceMidnight(slot.end, dayStart) - minutesSinceMidnight(slot.start, dayStart)) /
            DAY_MINUTES,
        ),
      }));

    return {
      index: dayIndex,
      label: DAY_LABELS[dayIndex],
      fullName: FULL_DAY_NAMES[dayIndex],
      isToday: isSameDay(dayStart, now),
      slotCount: slotsOnDay.length,
      slotsOnDay,
    };
  });

  const firstOpenDay = days.find((d) => d.slotCount === 0);
  const busiestDay = [...days].sort((a, b) => b.slotCount - a.slotCount)[0];

  const insight = buildInsight(firstOpenDay, busiestDay);

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          This week
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {busySlots.length} busy block{busySlots.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex items-end gap-1">
        {days.map((day) => (
          <div key={day.index} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                'relative h-14 w-full rounded-md bg-muted/50 ring-1 ring-inset ring-border/60',
                day.isToday && 'ring-2 ring-primary/40',
              )}
              title={`${day.fullName}: ${day.slotCount} busy block${day.slotCount === 1 ? '' : 's'}`}
            >
              {day.slotsOnDay.map((slot, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0.5 rounded-[2px] bg-primary/60"
                  style={{
                    top: `${slot.topPct * 100}%`,
                    height: `${Math.max(slot.heightPct * 100, 4)}%`,
                  }}
                />
              ))}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium',
                day.isToday ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>

      {insight && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span aria-hidden>👀 </span>
          {insight}
        </p>
      )}
    </div>
  );
}

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function minutesSinceMidnight(slotBoundary: Date, dayStart: Date): number {
  if (slotBoundary < dayStart) return 0;
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const clamped = slotBoundary > dayEnd ? dayEnd : slotBoundary;
  return (clamped.getTime() - dayStart.getTime()) / 60000;
}

function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildInsight(
  firstOpenDay: { fullName: string } | undefined,
  busiestDay: { fullName: string; slotCount: number } | undefined,
): string | null {
  const parts: string[] = [];
  if (firstOpenDay) {
    parts.push(`First open day is ${firstOpenDay.fullName}.`);
  }
  if (busiestDay && busiestDay.slotCount >= 2) {
    parts.push(`${busiestDay.fullName} is back-to-back.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}
