'use client';

import { useEffect, useMemo, useState } from 'react';
import { EventSearch } from '@/components/event-search';
import { EventCalendarGrid } from '@/components/event-calendar-grid';
import { loadProfileFromStorage } from '@/lib/profile';
import { matchesInterests } from '@/lib/relevance';
import {
  applyFilters,
  dateRangeFor,
  eventHasFreeFood,
  eventIsFree,
  summarizeFilters,
  timeLabel,
  topEventTypes,
  type DateWindow,
  type FilterState,
  type TimeOfDay,
  type WhatsOnFlag,
} from '@/lib/browse-filters';
import type { LiveWhaleEvent } from '@/lib/livewhale';
import type { CampusBrowseResponse } from '@/app/api/campus-browse/route';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'calendar';

const DATE_WINDOW_OPTIONS: DateWindow[] = [
  'today',
  'tomorrow',
  'this-week',
  'this-weekend',
  'this-month',
  'next-month',
];

const DATE_WINDOW_LABELS: Record<DateWindow, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  'this-week': 'This week',
  'this-weekend': 'Weekend',
  'this-month': 'This month',
  'next-month': 'Next month',
};

const TIME_OPTIONS: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'late'];

export default function BrowsePage() {
  const [now] = useState(() => new Date());
  const [window_, setWindow] = useState<DateWindow>('this-week');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [interestsOnly, setInterestsOnly] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [timesOfDay, setTimesOfDay] = useState<Set<TimeOfDay>>(new Set());
  const [flags, setFlags] = useState<Set<WhatsOnFlag>>(new Set());
  const [eventTypes, setEventTypes] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<LiveWhaleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  const range = useMemo(() => dateRangeFor(window_, now), [window_, now]);

  useEffect(() => {
    const profile = loadProfileFromStorage();
    if (profile?.interests?.length) setInterests(profile.interests);
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams({
      startDate: range.startDate,
      endDate: range.endDate,
      max: '200',
    });
    if (debouncedQ) params.set('q', debouncedQ);

    const ctrl = new AbortController();
    setLoading(true);
    setErrored(false);

    fetch(`/api/campus-browse?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = (await res.json()) as CampusBrowseResponse;
        setEvents(body.events);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setErrored(true);
        setEvents([]);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [range.startDate, range.endDate, debouncedQ]);

  // Filter state object — passed to applyFilters and the summary.
  const filterState: FilterState = useMemo(
    () => ({
      window: window_,
      timesOfDay,
      flags,
      eventTypes,
      interestsOnly,
    }),
    [window_, timesOfDay, flags, eventTypes, interestsOnly],
  );

  const filtered = useMemo(
    () => applyFilters(events, filterState, range),
    [events, filterState, range],
  );

  const visibleEvents = useMemo(() => {
    // interestsOnly is a priority signal — sort matches to top, don't drop.
    if (!interestsOnly || interests.length === 0) return filtered;
    const matched: LiveWhaleEvent[] = [];
    const rest: LiveWhaleEvent[] = [];
    for (const e of filtered) {
      if (
        matchesInterests(
          { title: e.title, group_title: e.group_title, event_types: e.event_types },
          interests,
        )
      )
        matched.push(e);
      else rest.push(e);
    }
    return [...matched, ...rest];
  }, [filtered, interestsOnly, interests]);

  const availableTypes = useMemo(() => topEventTypes(events, 8), [events]);
  const summary = summarizeFilters(filterState, range);

  const toggleTime = (t: TimeOfDay) => {
    setTimesOfDay((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };
  const toggleFlag = (f: WhatsOnFlag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };
  const toggleType = (t: string) => {
    setEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };
  const clearAllFilters = () => {
    setWindow('this-week');
    setTimesOfDay(new Set());
    setFlags(new Set());
    setEventTypes(new Set());
    setInterestsOnly(false);
    setQ('');
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pt-4 pb-24">
      <header className="mb-4">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--foreground)' }}
        >
          What&rsquo;s on campus
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Live from events.tc.umn.edu. Filter the view to whatever fits.
        </p>
      </header>

      {/* Search */}
      <div className="mb-3">
        <EventSearch value={q} onChange={setQ} />
      </div>

      {/* Date window */}
      <ChipRow ariaLabel="Date window">
        {DATE_WINDOW_OPTIONS.map((w) => (
          <Chip key={w} active={window_ === w} onClick={() => setWindow(w)}>
            {DATE_WINDOW_LABELS[w]}
          </Chip>
        ))}
      </ChipRow>

      {/* Time of day */}
      <ChipRow ariaLabel="Time of day">
        {TIME_OPTIONS.map((t) => (
          <Chip key={t} active={timesOfDay.has(t)} onClick={() => toggleTime(t)}>
            {timeLabel(t)}
          </Chip>
        ))}
      </ChipRow>

      {/* What's on */}
      <ChipRow ariaLabel="What's on">
        <Chip active={flags.has('free-food')} onClick={() => toggleFlag('free-food')}>
          Free food
        </Chip>
        <Chip active={flags.has('free-cost')} onClick={() => toggleFlag('free-cost')}>
          $0 Free
        </Chip>
        <Chip
          active={flags.has('registration')}
          onClick={() => toggleFlag('registration')}
        >
          ✓ Registration
        </Chip>
        {interests.length > 0 && (
          <Chip active={interestsOnly} onClick={() => setInterestsOnly((v) => !v)}>
            ★ My interests
          </Chip>
        )}
      </ChipRow>

      {/* Event types — only render when results return some */}
      {availableTypes.length > 0 && (
        <ChipRow ariaLabel="Event type">
          {availableTypes.map((t) => (
            <Chip key={t} active={eventTypes.has(t)} onClick={() => toggleType(t)}>
              {t}
            </Chip>
          ))}
        </ChipRow>
      )}

      {/* Active-filter summary + view toggle */}
      <div className="mt-1 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="text-xs"
          style={{ color: 'var(--muted-foreground)' }}
          role="status"
          aria-live="polite"
        >
          {loading ? (
            <>Loading…</>
          ) : (
            <>
              <strong style={{ color: 'var(--foreground)' }}>
                {visibleEvents.length}
              </strong>{' '}
              of {events.length}
              {summary ? ` · ${summary}` : ''}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold underline decoration-dotted underline-offset-4"
              style={{ color: 'var(--goldy-maroon-500)' }}
            >
              Clear all
            </button>
          )}
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {errored && !loading && (
        <p
          className="mb-3 rounded-xl border px-3 py-2 text-xs"
          style={{
            background: '#FBEEEC',
            borderColor: 'rgba(179,58,43,0.25)',
            color: '#9C2C20',
          }}
        >
          Couldn&rsquo;t reach campus events right now. Try again in a minute.
        </p>
      )}

      {!loading && !errored && visibleEvents.length === 0 && events.length > 0 && (
        <div
          className="rounded-2xl border bg-card p-6 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {events.length} event{events.length === 1 ? '' : 's'} loaded but{' '}
            <strong style={{ color: 'var(--foreground)' }}>none match</strong> your
            current filters.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-3 inline-flex min-h-[40px] items-center rounded-full border px-4 py-1.5 text-sm font-semibold"
            style={{
              borderColor: 'var(--goldy-maroon-500)',
              color: 'var(--goldy-maroon-600)',
              background: 'white',
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && !errored && events.length === 0 && (
        <p
          className="rounded-2xl border bg-card p-6 text-sm text-center"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          No events found in this window. Try a different date or keyword.
        </p>
      )}

      {view === 'list' && visibleEvents.length > 0 && (
        <EventList events={visibleEvents} interests={interests} />
      )}

      {view === 'calendar' && visibleEvents.length > 0 && (
        <>
          <div className="hidden sm:block">
            <EventCalendarGrid
              events={visibleEvents.map((e) => ({
                id: e.id,
                title: e.title,
                url: e.url,
                date_iso: e.date_iso,
              }))}
              monthStart={new Date(range.startDate)}
              onEventClick={(ev) => window.open(ev.url, '_blank', 'noopener,noreferrer')}
              onOverflowClick={() => setView('list')}
            />
            <p
              className="mt-2 text-[11px]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Calendar shows the date window above. Filters apply to the list view too.
            </p>
          </div>
          <div className="sm:hidden">
            <p
              className="mb-2 text-[11px]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Calendar grid hidden on narrow screens — showing list.
            </p>
            <EventList events={visibleEvents} interests={interests} />
          </div>
        </>
      )}

      <footer
        className="mt-8 border-t pt-4 text-center text-[10px] font-mono"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--muted-foreground)',
        }}
      >
        events.tc.umn.edu · live
      </footer>
    </main>
  );
}

function ChipRow({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="scrollbar-hide -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4"
      style={{ scrollSnapType: 'x proximity' }}
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="press inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        scrollSnapAlign: 'start',
        minHeight: 36,
        background: active ? 'var(--goldy-maroon-500)' : 'var(--surface-paper)',
        color: active ? 'white' : 'var(--muted-foreground)',
        borderColor: active ? 'var(--goldy-maroon-500)' : 'var(--border)',
      }}
    >
      {children}
    </button>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex gap-1 rounded-full border p-1"
      style={{ background: 'var(--surface-paper)', borderColor: 'var(--border)' }}
    >
      {(['list', 'calendar'] as ViewMode[]).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors',
          )}
          style={
            view === v
              ? { background: 'var(--goldy-maroon-500)', color: 'white' }
              : { color: 'var(--muted-foreground)' }
          }
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function EventList({
  events,
  interests,
}: {
  events: LiveWhaleEvent[];
  interests: string[];
}) {
  const deduped = Array.from(new Map(events.map((e) => [e.id, e])).values());
  const sorted = deduped.sort((a, b) => a.date_iso.localeCompare(b.date_iso));
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
                      free food
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
  return `${h12}:${m.toString().padStart(2, '0')}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
