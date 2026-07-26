'use client';

import type { BusySlot } from '@/lib/demo-calendar';
import type { Event } from '@/lib/schema';
import { cn } from '@/lib/utils';

type DayShapeProps = {
  event: Event;
  busySlots: BusySlot[];
};

// Visible window: 7 AM to midnight (17 hours)
const WINDOW_START_MIN = 7 * 60;
const WINDOW_END_MIN = 24 * 60;
const WINDOW_SPAN = WINDOW_END_MIN - WINDOW_START_MIN;

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function toPct(minuteOfDay: number): number {
  const clamped = Math.max(WINDOW_START_MIN, Math.min(WINDOW_END_MIN, minuteOfDay));
  return ((clamped - WINDOW_START_MIN) / WINDOW_SPAN) * 100;
}

export function DayShape({ event, busySlots }: DayShapeProps) {
  const eventStart = new Date(event.start);
  if (Number.isNaN(eventStart.getTime())) return null;

  const eventEnd = event.end
    ? new Date(event.end)
    : new Date(eventStart.getTime() + DEFAULT_DURATION_MS);

  // Get the day boundaries for the event's day
  const dayStart = new Date(eventStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Filter busy slots to just this day
  const slotsOnDay = busySlots.filter(
    (slot) => slot.start < dayEnd && slot.end > dayStart,
  );

  if (slotsOnDay.length === 0) return null; // No context to show

  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] text-muted-foreground/60">7a</span>
      <div className="relative h-4 flex-1 rounded-full bg-muted/40 ring-1 ring-inset ring-border/40">
        {/* Existing busy blocks */}
        {slotsOnDay.map((slot, i) => {
          const left = toPct(minuteOfDay(slot.start < dayStart ? dayStart : slot.start));
          const right = toPct(minuteOfDay(slot.end > dayEnd ? dayEnd : slot.end));
          return (
            <div
              key={i}
              className="absolute inset-y-0.5 rounded-full bg-zinc-400/40"
              style={{ left: `${left}%`, width: `${Math.max(right - left, 1)}%` }}
              title={slot.title}
            />
          );
        })}

        {/* Proposed event */}
        <div
          className="absolute inset-y-0.5 rounded-full bg-primary/70 ring-1 ring-primary/30"
          style={{
            left: `${toPct(minuteOfDay(eventStart))}%`,
            width: `${Math.max(toPct(minuteOfDay(eventEnd)) - toPct(minuteOfDay(eventStart)), 2)}%`,
          }}
          title={event.title}
        />
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground/60">12a</span>
    </div>
  );
}
