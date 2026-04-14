'use client';

import { buildMonthGrid, type GridEvent } from '@/lib/calendar-grid';
import { cn } from '@/lib/utils';

export type EventCalendarGridProps = {
  events: GridEvent[];
  monthStart: Date;
  maxPillsPerDay?: number;
  onEventClick?: (event: GridEvent) => void;
  onOverflowClick?: (date: Date) => void;
};

const WEEKDAYS_SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function EventCalendarGrid({
  events,
  monthStart,
  maxPillsPerDay = 3,
  onEventClick,
  onOverflowClick,
}: EventCalendarGridProps) {
  const cells = buildMonthGrid(monthStart, events);

  return (
    <div className="rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 bg-muted/30 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS_SUN_FIRST.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const visible = cell.events.slice(0, maxPillsPerDay);
          const overflow = cell.events.length - visible.length;
          return (
            <div
              key={i}
              className={cn(
                'min-h-[88px] p-1.5 text-[11px]',
                !cell.inMonth && 'bg-muted/20 text-muted-foreground/50',
              )}
            >
              <div className="mb-1 text-[10px] font-medium">{cell.date.getUTCDate()}</div>
              <ul className="space-y-0.5">
                {visible.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => onEventClick?.(event)}
                      aria-label={`${event.title}, ${dayLabel(cell.date)}`}
                      className="block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[10px] text-primary hover:bg-primary/20"
                    >
                      {event.title}
                    </button>
                  </li>
                ))}
                {overflow > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => onOverflowClick?.(cell.date)}
                      aria-label={`${overflow} more events on ${dayLabel(cell.date)}`}
                      className="block w-full truncate rounded px-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      +{overflow} more
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
