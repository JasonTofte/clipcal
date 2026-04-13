import type { Event } from '@/lib/schema';
import { formatWeekRange } from '@/lib/format';

type Props = {
  events: Event[];
  // "today" anchor — start of the current calendar week (Monday by default)
  weekStart?: Date;
  // Optional interactivity — when provided, each day becomes a button that
  // filters the feed to that day (or clears the filter when the same day
  // is tapped again). selectedDayIdx is 0..6 where 0 = Monday.
  selectedDayIdx?: number | null;
  onSelectDay?: (idx: number | null) => void;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL_LABELS = [
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
    const daysFromStart = Math.round((dayStart.getTime() - start.getTime()) / MS_PER_DAY);
    if (daysFromStart >= 0 && daysFromStart < 7) counts[daysFromStart] += 1;
  }

  const maxCount = Math.max(1, ...counts);
  const todayIdx = Math.round((today.getTime() - start.getTime()) / MS_PER_DAY);
  const isWeekendIdx = (i: number) => i >= 5;

  const handleDayTap = (i: number) => {
    if (!onSelectDay) return;
    // Toggle: tapping the already-selected day clears the filter.
    if (selectedDayIdx === i) onSelectDay(null);
    else onSelectDay(i);
  };

  return (
    <section
      aria-labelledby="goldy-week-heading"
      className="goldy-theme-scope relative mb-6 overflow-hidden rounded-3xl border-2 bg-white p-4 sm:p-5 shadow-md"
      style={{ borderColor: 'var(--goldy-gold-400)' }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2
            id="goldy-week-heading"
            className="flex items-center gap-1.5 text-sm font-bold"
            style={{ color: 'var(--goldy-maroon-600)' }}
          >
            <span aria-hidden className="text-base">🗓️</span> Your week at a glance
          </h2>
          <p className="mt-0.5 text-[11px] text-stone-500">
            {interactive
              ? 'Tap a day to zoom in. Tap again to clear.'
              : "I'm not scoring you. Just laying it out."}
          </p>
        </div>
        <span className="text-[10px] text-stone-400">{formatWeekRange(start)}</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAY_LABELS.map((label, i) => {
          const c = counts[i];
          const heightPct = Math.max(10, Math.round((c / maxCount) * 85));
          const isToday = i === todayIdx;
          const isSelected = selectedDayIdx === i;
          const weekend = isWeekendIdx(i);
          const openSlot = weekend && c === 0;

          const barStyle = {
            background: openSlot
              ? 'var(--goldy-gold-50)'
              : '#F5F5F4',
            boxShadow: isSelected
              ? '0 0 0 3px var(--goldy-maroon-500) inset'
              : isToday
                ? '0 0 0 2px var(--goldy-maroon-400) inset'
                : openSlot
                  ? '0 0 0 2px var(--goldy-gold-500) inset'
                  : undefined,
          };

          const bar = (
            <div className="relative h-12 overflow-hidden rounded-xl" style={barStyle}>
              <div
                className="absolute inset-x-0 bottom-0"
                style={{
                  height: c === 0 ? '0%' : `${heightPct}%`,
                  background: isSelected
                    ? 'var(--goldy-maroon-600)'
                    : isToday
                      ? 'var(--goldy-maroon-500)'
                      : openSlot
                        ? 'var(--goldy-gold-400)'
                        : 'var(--goldy-maroon-200)',
                }}
              />
              {openSlot && (
                <div className="absolute inset-x-0 top-1 text-center text-[10px]" aria-hidden>
                  ✨
                </div>
              )}
            </div>
          );

          const topLabelCls = `mb-1 text-[9px] font-medium ${
            isToday || isSelected ? 'font-bold' : openSlot ? '' : 'text-stone-400'
          }`;
          const topLabelStyle = isSelected
            ? { color: 'var(--goldy-maroon-600)' }
            : isToday
              ? { color: 'var(--goldy-maroon-500)' }
              : openSlot
                ? { color: 'var(--goldy-gold-700)' }
                : undefined;
          const bottomLabel = c === 0 ? (openSlot ? 'OPEN' : '—') : String(c);
          const bottomLabelCls = `mt-1 text-[9px] ${
            isToday || isSelected ? 'font-bold' : openSlot ? 'font-bold' : 'text-stone-400'
          }`;
          const bottomLabelStyle = isSelected
            ? { color: 'var(--goldy-maroon-600)' }
            : isToday
              ? { color: 'var(--goldy-maroon-500)' }
              : openSlot
                ? { color: 'var(--goldy-gold-700)' }
                : undefined;

          const inner = (
            <>
              <div className={topLabelCls} style={topLabelStyle}>
                {label}
              </div>
              {bar}
              <div className={bottomLabelCls} style={bottomLabelStyle}>
                {bottomLabel}
              </div>
            </>
          );

          if (!interactive) {
            return (
              <div key={label} className="text-center">
                {inner}
              </div>
            );
          }

          return (
            <button
              key={label}
              type="button"
              onClick={() => handleDayTap(i)}
              aria-pressed={isSelected}
              aria-label={`${DAY_FULL_LABELS[i]}${
                c === 0 ? ', no events' : `, ${c} event${c === 1 ? '' : 's'}`
              }${isSelected ? ' (filter active)' : ''}`}
              className="flex min-h-[72px] flex-col text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                borderRadius: '0.75rem',
                // Bigger tap target via padding without affecting layout.
                padding: '2px',
              }}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
