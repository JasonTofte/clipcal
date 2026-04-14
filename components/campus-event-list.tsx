import { eventHasFreeFood, eventIsFree } from '@/lib/browse-filters';
import type { LiveWhaleEvent } from '@/lib/livewhale';
import { matchesInterests } from '@/lib/relevance';

export function CampusEventList({
  events,
  interests = [],
}: {
  events: LiveWhaleEvent[];
  interests?: string[];
}) {
  const sorted = [...events].sort((a, b) => a.date_iso.localeCompare(b.date_iso));
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((e) => {
        const isMatch =
          interests.length > 0 &&
          matchesInterests(
            { title: e.title, group_title: e.group_title, event_types: e.event_types },
            interests,
          );
        const hasFreeFoodFlag = eventHasFreeFood(e);
        const isFree = eventIsFree(e);
        const time = e.is_all_day ? 'All day' : formatTimeOnly(e.date_iso);
        const day = formatDayShort(e.date_iso);
        return (
          <li key={e.id}>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="w-12 shrink-0 text-xs leading-tight">
                <div style={{ color: 'var(--muted-foreground)' }}>{day}</div>
                <div
                  className="font-semibold"
                  style={{ color: 'var(--goldy-maroon-600)' }}
                >
                  {time}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {e.title}
                  </p>
                  {isMatch && (
                    <span
                      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        background: 'var(--goldy-gold-100)',
                        color: 'var(--goldy-maroon-700)',
                      }}
                    >
                      <span aria-hidden>★</span> match
                    </span>
                  )}
                </div>
                <div
                  className="mt-0.5 truncate text-[11px]"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {e.location ?? 'unlisted location'}
                  {e.group_title ? ` · ${e.group_title}` : ''}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {hasFreeFoodFlag && (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold"
                      style={{
                        background: 'var(--goldy-gold-50)',
                        color: 'var(--goldy-maroon-700)',
                      }}
                    >
                      🍕 free food
                    </span>
                  )}
                  {isFree && (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold"
                      style={{
                        background: '#ECF2EE',
                        color: '#3D6B52',
                      }}
                    >
                      $0
                    </span>
                  )}
                  {e.has_registration && (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold"
                      style={{
                        background: 'var(--surface-calm)',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      ✓ register
                    </span>
                  )}
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function formatTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'pm' : 'am';
  if (m === 0) return `${h12}${ampm}`;
  return `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
