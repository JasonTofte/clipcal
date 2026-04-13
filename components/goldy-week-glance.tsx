import type { Event } from '@/lib/schema';

type Props = {
  events: Event[];
  // "today" anchor — start of the current calendar week (Monday by default)
  weekStart?: Date;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function formatDayRange(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * MS_PER_DAY);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export function GoldyWeekGlance({ events, weekStart }: Props) {
  const start = weekStart ?? startOfWeekMonday(new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Tally events per weekday index (0=Mon..6=Sun).
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
            I&apos;m not scoring you. Just laying it out.
          </p>
        </div>
        <span className="text-[10px] text-stone-400">{formatDayRange(start)}</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {DAY_LABELS.map((label, i) => {
          const c = counts[i];
          const heightPct = Math.max(10, Math.round((c / maxCount) * 85));
          const isToday = i === todayIdx;
          const weekend = isWeekendIdx(i);
          const openSlot = weekend && c === 0;

          return (
            <div key={label} className="text-center">
              <div
                className={`mb-1 text-[9px] font-medium ${
                  isToday
                    ? 'font-bold'
                    : openSlot
                      ? ''
                      : 'text-stone-400'
                }`}
                style={
                  isToday
                    ? { color: 'var(--goldy-maroon-500)' }
                    : openSlot
                      ? { color: 'var(--goldy-gold-700)' }
                      : undefined
                }
              >
                {label}
              </div>
              <div
                className="relative h-12 overflow-hidden rounded-xl"
                style={{
                  background: openSlot
                    ? 'var(--goldy-gold-50)'
                    : '#F5F5F4',
                  boxShadow: isToday
                    ? '0 0 0 2px var(--goldy-maroon-400) inset'
                    : openSlot
                      ? '0 0 0 2px var(--goldy-gold-500) inset'
                      : undefined,
                }}
              >
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: c === 0 ? '0%' : `${heightPct}%`,
                    background: isToday
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
              <div
                className={`mt-1 text-[9px] ${isToday ? 'font-bold' : openSlot ? 'font-bold' : 'text-stone-400'}`}
                style={
                  isToday
                    ? { color: 'var(--goldy-maroon-500)' }
                    : openSlot
                      ? { color: 'var(--goldy-gold-700)' }
                      : undefined
                }
              >
                {c === 0 ? (openSlot ? 'OPEN' : '—') : c}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
