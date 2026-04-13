'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EventSearch } from '@/components/event-search';
import { EventCalendarGrid } from '@/components/event-calendar-grid';
import { Button } from '@/components/ui/button';
import { loadProfileFromStorage } from '@/lib/profile';
import { matchesInterests } from '@/lib/relevance';
import type { LiveWhaleEvent } from '@/lib/livewhale';
import type { CampusBrowseResponse } from '@/app/api/campus-browse/route';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'calendar';

function firstOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function lastOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function BrowsePage() {
  const [monthStart, setMonthStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [useInterests, setUseInterests] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [events, setEvents] = useState<LiveWhaleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const profile = loadProfileFromStorage();
    if (profile?.interests?.length) setInterests(profile.interests);
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const startDate = iso(monthStart);
    const endDate = iso(lastOfMonth(monthStart));
    const params = new URLSearchParams({ startDate, endDate });
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
  }, [monthStart, debouncedQ]);

  const visibleEvents = useMemo(() => {
    if (!useInterests || interests.length === 0) return events;
    return events.filter((e) =>
      matchesInterests(
        { title: e.title, group_title: e.group_title, event_types: e.event_types },
        interests,
      ),
    );
  }, [events, useInterests, interests]);

  const goPrevMonth = () =>
    setMonthStart(
      (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)),
    );
  const goNextMonth = () =>
    setMonthStart(
      (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Browse</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campus events from events.tc.umn.edu. Search or browse by month.
          </p>
        </div>
        <div className="flex shrink-0 gap-3 text-xs">
          <Link href="/feed" className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
            feed
          </Link>
          <Link href="/" className="text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
            upload
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3">
        <EventSearch value={q} onChange={setQ} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={goPrevMonth} aria-label="Previous month">
              ←
            </Button>
            <span className="min-w-[14ch] text-center font-mono text-xs">{monthLabel(monthStart)}</span>
            <Button size="sm" variant="outline" onClick={goNextMonth} aria-label="Next month">
              →
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {interests.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={useInterests}
                  onChange={(e) => setUseInterests(e.target.checked)}
                  className="size-4 accent-primary"
                  aria-label="Filter events by my interests"
                />
                match my interests
              </label>
            )}
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'Loading campus events' : errored ? 'Could not load campus events. Try again.' : ''}
      </div>
      {loading && (
        <p aria-hidden="true" className="text-xs text-muted-foreground">Loading campus events…</p>
      )}
      {errored && !loading && (
        <p aria-hidden="true" className="rounded-md bg-amber-500/5 p-3 text-xs text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-400">
          Couldn&rsquo;t reach campus events right now. Try again in a minute.
        </p>
      )}

      {!loading && !errored && visibleEvents.length === 0 && (
        <p className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">
          No events found. Try a different keyword or month.
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
              monthStart={monthStart}
              onEventClick={(ev) => window.open(ev.url, '_blank', 'noopener,noreferrer')}
              onOverflowClick={() => setView('list')}
            />
          </div>
          <div className="sm:hidden">
            <p className="mb-2 text-[11px] text-muted-foreground">
              Agenda view (calendar grid hidden on narrow screens)
            </p>
            <EventList events={visibleEvents} interests={interests} />
          </div>
        </>
      )}

      <footer className="mt-10 border-t border-border/50 pt-4 text-center text-[10px] font-mono text-muted-foreground">
        events.tc.umn.edu · live
      </footer>
    </main>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="View mode"
      className="inline-flex gap-1 rounded-full bg-muted p-1 ring-1 ring-inset ring-border"
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
            view === v
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function EventList({ events, interests }: { events: LiveWhaleEvent[]; interests: string[] }) {
  const sorted = [...events].sort((a, b) => a.date_iso.localeCompare(b.date_iso));
  return (
    <ul className="flex flex-col gap-2.5">
      {sorted.map((e) => {
        const isMatch =
          interests.length > 0 &&
          matchesInterests(
            { title: e.title, group_title: e.group_title, event_types: e.event_types },
            interests,
          );
        return (
          <li key={e.id}>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-border shadow-sm transition-colors hover:ring-primary/40"
            >
              {e.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.thumbnail}
                  alt=""
                  className="mt-0.5 size-12 shrink-0 rounded-xl object-cover"
                  onError={(ev) => {
                    ev.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{e.title}</p>
                  {isMatch && (
                    <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-inset ring-primary/20">
                      <span aria-hidden>★</span> your interests
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{e.date_display}</span>
                  {e.location && (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate">{e.location}</span>
                    </>
                  )}
                  {e.cost?.toLowerCase() === 'free' && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                    </>
                  )}
                </div>
                {e.group_title && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                    {e.group_title}
                  </p>
                )}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
