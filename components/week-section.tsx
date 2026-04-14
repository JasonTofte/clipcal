'use client';

import { useMemo } from 'react';
import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';

const DAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_FULL = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday', 'Sunday',
];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'pm' : 'am';
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

type Props = {
  events: Event[];
  busySlots?: BusySlot[];
  weekStart?: Date;
  selectedDayIdx: number | null;
  onSelectDay: (idx: number | null) => void;
  now?: Date;
};

export function WeekSection({
  events,
  busySlots = [],
  weekStart,
  selectedDayIdx,
  onSelectDay,
  now,
}: Props) {
  const today = now ?? new Date();
  const start = weekStart ?? startOfWeekMonday(today);

  const eventsByDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [] as Event[]);
    for (const ev of events) {
      const d = new Date(ev.start);
      if (Number.isNaN(d.getTime())) continue;
      const ds = new Date(d);
      ds.setHours(0, 0, 0, 0);
      const idx = Math.round((ds.getTime() - start.getTime()) / MS_PER_DAY);
      if (idx >= 0 && idx < 7) map[idx].push(ev);
    }
    return map;
  }, [events, start]);

  const busyByDay = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const ds = new Date(start);
      ds.setDate(ds.getDate() + i);
      ds.setHours(0, 0, 0, 0);
      const de = new Date(ds);
      de.setDate(de.getDate() + 1);
      return busySlots.filter(b => b.start < de && b.end > ds);
    }),
    [busySlots, start],
  );

  type Item =
    | { kind: 'event'; time: Date; event: Event }
    | { kind: 'busy'; time: Date; slot: BusySlot };

  const selectedItems = useMemo((): Item[] => {
    if (selectedDayIdx === null) return [];
    const evs: Item[] = eventsByDay[selectedDayIdx].map(e => ({
      kind: 'event', time: new Date(e.start), event: e,
    }));
    const busy: Item[] = busyByDay[selectedDayIdx].map(b => ({
      kind: 'busy', time: b.start, slot: b,
    }));
    return [...evs, ...busy].sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [selectedDayIdx, eventsByDay, busyByDay]);

  const isOpen = selectedDayIdx !== null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl bg-card shadow-sm">

      {/* ── Week bar ── */}
      <div className="flex items-stretch px-1 pt-2.5 pb-2 gap-0.5">
        {DAY_SHORT.map((label, i) => {
          const dayDate = new Date(start);
          dayDate.setDate(dayDate.getDate() + i);
          const isToday = isSameDay(dayDate, today);
          const isSel = selectedDayIdx === i;
          const count = eventsByDay[i].length;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDay(isSel ? null : i)}
              aria-pressed={isSel}
              aria-label={`${DAY_FULL[i]}: ${count || 'no'} event${count === 1 ? '' : 's'}${isToday ? ' (today)' : ''}`}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-all duration-200 active:scale-95 select-none"
              style={{
                background: isSel
                  ? 'var(--goldy-maroon-500)'
                  : isToday
                    ? 'var(--goldy-maroon-50)'
                    : 'transparent',
              }}
            >
              {/* Day letter */}
              <span
                className="text-[10px] font-semibold uppercase tracking-wide leading-none"
                style={{
                  color: isSel
                    ? 'rgba(255,255,255,0.65)'
                    : isToday
                      ? 'var(--goldy-maroon-500)'
                      : 'var(--muted-foreground)',
                }}
              >
                {label}
              </span>

              {/* Date number */}
              <span
                className="text-[15px] font-bold leading-tight"
                style={{
                  color: isSel
                    ? 'white'
                    : isToday
                      ? 'var(--goldy-maroon-600)'
                      : 'var(--foreground)',
                }}
              >
                {dayDate.getDate()}
              </span>

              {/* Event dots */}
              <div className="flex h-1.5 items-center gap-[3px] mt-0.5">
                {count === 0 ? (
                  <span
                    className="block size-1 rounded-full"
                    style={{ background: isSel ? 'rgba(255,255,255,0.25)' : 'var(--border)' }}
                  />
                ) : (
                  Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                    <span
                      key={j}
                      className="block size-1 rounded-full"
                      style={{
                        background: isSel
                          ? 'rgba(255,255,255,0.7)'
                          : 'var(--goldy-maroon-500)',
                      }}
                    />
                  ))
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Animated day detail ── */}
      <div
        className="grid"
        style={{
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="overflow-hidden">
          <div
            className="px-3 pb-3"
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 240ms ease, transform 240ms ease',
            }}
          >
            {selectedDayIdx !== null && (
              <>
                <p
                  className="mb-2 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {DAY_FULL[selectedDayIdx]}, {new Date(start.getTime() + selectedDayIdx * MS_PER_DAY).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>

                {selectedItems.length === 0 ? (
                  <p className="py-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Nothing on — wide open.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {selectedItems.map((item, j) => {
                      if (item.kind === 'event') {
                        return (
                          <div
                            key={`ev-${j}`}
                            className="flex items-start gap-2.5 rounded-xl px-3 py-2"
                            style={{ background: 'var(--goldy-maroon-50)' }}
                          >
                            <span
                              className="shrink-0 text-[11px] font-semibold tabular-nums pt-0.5"
                              style={{ color: 'var(--goldy-maroon-500)', minWidth: 36 }}
                            >
                              {fmtTime(item.time)}
                            </span>
                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-semibold"
                                style={{ color: 'var(--foreground)' }}
                              >
                                {item.event.title}
                              </p>
                              {item.event.location && (
                                <p
                                  className="truncate text-[11px]"
                                  style={{ color: 'var(--muted-foreground)' }}
                                >
                                  {item.event.location}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={`busy-${j}`}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                          style={{ background: 'var(--muted)' }}
                        >
                          <span
                            className="shrink-0 text-[11px] font-medium tabular-nums"
                            style={{ color: 'var(--muted-foreground)', minWidth: 36 }}
                          >
                            {fmtTime(item.time)}
                          </span>
                          <p
                            className="truncate text-sm font-medium"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            {item.slot.title}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
