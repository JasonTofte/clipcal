'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { GoldyWeekGlance } from '@/components/goldy-week-glance';
import { GoldyEventCard } from '@/components/goldy-event-card';
import { GoldyDayOfBanner } from '@/components/goldy-day-of-banner';
import { CampusFeed } from '@/components/campus-feed';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import {
  appendBatch,
  clearAllBatches,
  EVENT_STORE_KEY,
  loadBatches,
  markBatchCommitted,
  markBatchUncommitted,
  type StoredEventBatch,
} from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import { buildContext, pickGoldyLine } from '@/lib/goldy-commentary';
import { parseNowOverride } from '@/lib/day-of-reminder';
import { formatShortDate, formatWeekday } from '@/lib/format';
import { buildDemoBatch, DEMO_SEED_ID, isDemoBatch } from '@/lib/demo-feed-seed';
import type { Event } from '@/lib/schema';

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';
const DEMO_SEED_DISMISSED_KEY = 'clipcal_demo_seed_dismissed';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 5000;

type ChipFilter = 'all' | 'gameday' | 'free-food';

type FeedRow = {
  batchId: string;
  eventIndex: number;
  event: Event;
  addedAt: string;
  icsCommitted: boolean;
};

function bucketMatchPct(bucket: string): number {
  switch (bucket) {
    case 'urgent':
      return 99;
    case 'conflict':
      return 60;
    case 'top-pick-gameday':
      return 98;
    case 'interest-match':
      return 92;
    case 'free-food':
      return 88;
    case 'back-to-back':
      return 78;
    case 'late-night':
      return 55;
    case 'weekend-open':
      return 70;
    default:
      return 50;
  }
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

// Convert an event's start timestamp into a 0..6 weekday index where
// 0 = Monday, matching the week-glance grid.
function eventDayIdx(eventStart: string, weekStart: Date): number {
  const d = new Date(eventStart);
  if (Number.isNaN(d.getTime())) return -1;
  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);
  return Math.round((dayStart.getTime() - weekStart.getTime()) / MS_PER_DAY);
}

const DAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function GoldyFeedClient() {
  const [batches, setBatches] = useState<StoredEventBatch[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ batchId: string; title: string } | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const undoTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // Initial hydration: load batches + profile + demo-mode, and auto-seed
  // a demo batch on first visit if the user has no data yet.
  useEffect(() => {
    const loaded = loadBatches();
    const dismissed =
      window.localStorage.getItem(DEMO_SEED_DISMISSED_KEY) === 'true';
    if (loaded.length === 0 && !dismissed) {
      appendBatch(buildDemoBatch(new Date()).events, 'Demo events — first visit seed.');
      // appendBatch creates a fresh batch with a non-demo id; rewrite the
      // freshly-written batch to use the DEMO_SEED_ID so we can detect it.
      const refetched = loadBatches();
      const last = refetched[refetched.length - 1];
      if (last) {
        last.id = DEMO_SEED_ID;
        window.localStorage.setItem(EVENT_STORE_KEY, JSON.stringify(refetched));
      }
      setBatches(loadBatches());
    } else {
      setBatches(loaded);
    }
    setProfile(loadProfileFromStorage());
    const storedDemo = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (storedDemo !== null) setDemoMode(storedDemo === 'true');
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

  const rows: FeedRow[] = useMemo(
    () =>
      batches.flatMap((batch) =>
        batch.events.map((event, i) => ({
          batchId: batch.id,
          eventIndex: i,
          event,
          addedAt: batch.addedAt,
          icsCommitted: batch.icsCommitted,
        })),
      ),
    [batches],
  );

  const calendar = demoMode ? DEMO_CALENDAR : [];
  const allEvents = useMemo(
    () =>
      [...rows.map((r) => r.event)].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    [rows],
  );
  const interests = profile?.interests ?? [];
  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);
  const hasDemoSeed = batches.some((b) => isDemoBatch(b.id));

  // Share the same `?now=` override the day-of banner uses so urgent
  // commentary + the banner stay in sync during demos.
  const nowOverride = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return parseNowOverride(window.location.search);
  }, []);

  const ranked = useMemo(() => {
    const now = nowOverride ?? new Date();
    return rows
      .map((row) => {
        const ctx = buildContext(row.event, calendar, allEvents, interests, now);
        const line = pickGoldyLine(row.event, ctx);
        const pct = bucketMatchPct(ctx.bucket);
        return { row, ctx, line, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [rows, demoMode, interests, allEvents, nowOverride]);

  const recentClips = rows
    .slice()
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 6);

  const greetingBlurb = useMemo(() => {
    if (rows.length === 0) return null;
    const weekday = formatWeekday(new Date());
    const openWeekend = allEvents.every((e) => {
      const d = new Date(e.start).getDay();
      return d !== 0 && d !== 6;
    });
    if (openWeekend) {
      return `Hey! I peeked at your week — your weekend is wide open. Want me to surface what fits?`;
    }
    return `Hey! You've got ${rows.length} event${rows.length === 1 ? '' : 's'} on deck. ${weekday}'s looking like your day.`;
  }, [rows, allEvents]);

  const visibleRanked = useMemo(() => {
    let out = ranked;
    if (chipFilter !== 'all') {
      out = out.filter(({ ctx, row }) => {
        if (chipFilter === 'gameday') return ctx.bucket === 'top-pick-gameday';
        if (chipFilter === 'free-food')
          return ctx.bucket === 'free-food' || row.event.hasFreeFood;
        return true;
      });
    }
    if (selectedDayIdx !== null) {
      out = out.filter(({ row }) => eventDayIdx(row.event.start, weekStart) === selectedDayIdx);
    }
    return out;
  }, [ranked, chipFilter, selectedDayIdx, weekStart]);

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (chipFilter === 'gameday') parts.push('gameday');
    if (chipFilter === 'free-food') parts.push('free food');
    if (selectedDayIdx !== null) parts.push(DAY_FULL[selectedDayIdx]);
    return parts.join(' · ');
  }, [chipFilter, selectedDayIdx]);

  const handleAdd = (row: FeedRow) => {
    triggerIcsDownload([row.event]);
    markBatchCommitted(row.batchId);
    setBatches(loadBatches());
    // Pop an undo snackbar for UNDO_WINDOW_MS.
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndo({ batchId: row.batchId, title: row.event.title });
    undoTimerRef.current = window.setTimeout(() => {
      setUndo(null);
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  };

  const handleUndo = () => {
    if (!undo) return;
    markBatchUncommitted(undo.batchId);
    setBatches(loadBatches());
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndo(null);
  };

  const handleCameraTap = (key: string) => {
    const el = cardRefs.current.get(key);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlashKey(key);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashKey(null);
      flashTimerRef.current = null;
    }, 1600);
  };

  const handleResetDemo = () => {
    clearAllBatches();
    window.localStorage.setItem(DEMO_SEED_DISMISSED_KEY, 'true');
    setBatches([]);
  };

  const registerCardRef = (key: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  };

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <GoldyGreeting
          blurb="Hey! Your feed is clear. Snap a flyer and I'll keep it from getting lost in your camera roll."
        />
        <div
          className="mt-8 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-white/60 p-10 text-center"
          style={{ borderColor: 'var(--goldy-maroon-200)' }}
        >
          <div className="text-4xl" aria-hidden>
            📭
          </div>
          <p className="text-sm text-stone-600">
            No flyers extracted yet. Head back to the upload page.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-sm font-bold"
            style={{
              background: 'var(--goldy-maroon-500)',
              color: 'var(--goldy-gold-400)',
            }}
          >
            Upload a flyer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <GoldyDayOfBanner events={allEvents} />

      {greetingBlurb && (
        <GoldyGreeting
          blurb={greetingBlurb}
          chipFilter={chipFilter}
          onChipFilter={setChipFilter}
        />
      )}

      {hasDemoSeed && (
        <div
          className="mb-4 flex items-center justify-between rounded-2xl border px-3 py-2 text-[11px]"
          style={{
            background: 'var(--goldy-gold-50)',
            borderColor: 'var(--goldy-gold-200)',
            color: 'var(--goldy-maroon-700)',
          }}
        >
          <span>
            <strong>Demo data loaded.</strong> These three events are here so Goldy has something to react to.
          </span>
          <button
            type="button"
            onClick={handleResetDemo}
            className="ml-3 shrink-0 rounded-full border px-2.5 py-1 font-semibold"
            style={{
              borderColor: 'var(--goldy-maroon-500)',
              color: 'var(--goldy-maroon-600)',
              background: 'white',
            }}
          >
            Clear demo
          </button>
        </div>
      )}

      <GoldyWeekGlance
        events={allEvents}
        weekStart={weekStart}
        selectedDayIdx={selectedDayIdx}
        onSelectDay={setSelectedDayIdx}
      />

      {recentClips.length > 0 && (
        <section className="mb-8" aria-labelledby="goldy-recent-heading">
          <div className="mb-2 flex items-center justify-between">
            <h2
              id="goldy-recent-heading"
              className="flex items-center gap-1.5 text-sm font-bold text-stone-900"
            >
              <span aria-hidden className="text-base">📸</span> You screenshotted these
            </h2>
            <span className="text-xs text-stone-500">
              {recentClips.length} snapped · tap to jump
            </span>
          </div>
          <p className="mb-3 text-xs text-stone-500">
            I&apos;ll remember, so you don&apos;t have to.
          </p>
          <div className="scrollbar-hide goldy-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {recentClips.map(({ batchId, eventIndex, event }) => {
              const key = `${batchId}-${eventIndex}`;
              const t = event.title.toLowerCase();
              const flyer =
                event.category === 'sports' || /stadium|gophers|axe/.test(t)
                  ? 'flyer-game'
                  : event.category === 'hackathon' || t.includes('hack')
                    ? 'flyer-hack'
                    : event.hasFreeFood || /pizza|taco|donut|food/.test(t)
                      ? 'flyer-pizza'
                      : event.category === 'career' || event.category === 'networking'
                        ? 'flyer-career'
                        : 'flyer-default';
              const onPizza = flyer === 'flyer-pizza';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleCameraTap(key)}
                  aria-label={`Jump to ${event.title}`}
                  className="goldy-snap-item w-40 shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ borderRadius: '1rem' }}
                >
                  <div
                    className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg transition-transform active:scale-[0.98] ${flyer}`}
                  >
                    <div
                      className={`absolute inset-0 flex flex-col p-3 ${onPizza ? '' : 'text-white'}`}
                    >
                      <div
                        className="text-[9px] font-semibold uppercase tracking-widest"
                        style={{
                          color: onPizza ? 'var(--goldy-maroon-700)' : 'var(--goldy-gold-300)',
                        }}
                      >
                        {event.category}
                      </div>
                      <div className="goldy-display mt-1 text-lg font-bold leading-tight line-clamp-3">
                        {event.title}
                      </div>
                      <div
                        className="mt-auto text-[10px]"
                        style={{
                          color: onPizza ? 'var(--goldy-maroon-700)' : 'var(--goldy-gold-200)',
                        }}
                      >
                        {formatShortDate(event.start)}
                        {event.location ? ` · ${event.location.split(',')[0]}` : ''}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-6" aria-labelledby="goldy-picks-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="goldy-picks-heading"
            className="flex items-center gap-1.5 text-sm font-bold text-stone-900"
          >
            <span aria-hidden className="text-base">🐿️</span> Goldy&apos;s picks for you
          </h2>
          <span className="text-xs text-stone-500">
            {activeFilterSummary
              ? `${visibleRanked.length} of ${ranked.length} · ${activeFilterSummary}`
              : 'Sorted by fit'}
          </span>
        </div>
        {visibleRanked.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed bg-white/60 p-6 text-center text-sm text-stone-600"
            style={{ borderColor: 'var(--goldy-maroon-200)' }}
          >
            <p>Nothing matches your current filter.</p>
            {(selectedDayIdx !== null || chipFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDayIdx(null);
                  setChipFilter('all');
                }}
                className="mt-2 text-xs font-semibold underline"
                style={{ color: 'var(--goldy-maroon-600)' }}
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRanked.map(({ row, ctx, line, pct }, i) => {
              const key = `${row.batchId}-${row.eventIndex}`;
              const flashing = flashKey === key;
              return (
                <div
                  key={key}
                  ref={registerCardRef(key)}
                  className="rounded-3xl transition-shadow"
                  style={
                    flashing
                      ? {
                          boxShadow:
                            '0 0 0 3px var(--goldy-gold-400), 0 10px 25px -8px rgba(0,0,0,0.2)',
                        }
                      : undefined
                  }
                >
                  <GoldyEventCard
                    event={row.event}
                    goldyLine={line}
                    matchPct={pct}
                    isTopPick={i === 0 && chipFilter === 'all' && selectedDayIdx === null}
                    conflictTitle={
                      ctx.bucket === 'conflict' ? ctx.slots.conflictTitle : null
                    }
                    onAddToCalendar={() => handleAdd(row)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6">
        <CampusFeed />
      </div>

      {undo && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 128px)',
          }}
        >
          <div
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-full px-4 py-2.5 shadow-2xl"
            style={{
              background: 'var(--goldy-maroon-600)',
              color: 'white',
            }}
          >
            <span className="text-sm">
              Added <strong>{undo.title}</strong> to calendar.
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: 'var(--goldy-gold-400)',
                color: 'var(--goldy-maroon-700)',
              }}
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function GoldyGreeting({
  blurb,
  chipFilter,
  onChipFilter,
}: {
  blurb: string;
  chipFilter?: ChipFilter;
  onChipFilter?: (next: ChipFilter) => void;
}) {
  const showChips = chipFilter !== undefined && onChipFilter !== undefined;
  return (
    <section className="mb-6 flex items-start gap-3">
      <div className="shrink-0">
        <GoldyAvatar size={64} showStatus />
      </div>
      <div
        className="goldy-bubble max-w-md rounded-2xl rounded-tl-sm px-4 py-3 shadow-md"
        role="note"
        aria-label="Goldy's greeting"
      >
        <div
          className="mb-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--goldy-maroon-600)' }}
        >
          Goldy Gopher · just now
        </div>
        <p className="text-sm leading-snug text-stone-900">{blurb}</p>
        {showChips && (
          <div
            role="group"
            aria-label="Filter Goldy's picks"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            <GreetingChip
              label="Yes, show me"
              active={chipFilter === 'all'}
              onClick={() => onChipFilter('all')}
            />
            <GreetingChip
              label="Just gameday"
              active={chipFilter === 'gameday'}
              onClick={() => onChipFilter('gameday')}
            />
            <GreetingChip
              label="Free food only"
              active={chipFilter === 'free-food'}
              onClick={() => onChipFilter('free-food')}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function GreetingChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex min-h-[32px] items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={
        active
          ? {
              background: 'var(--goldy-maroon-500)',
              color: 'var(--goldy-gold-400)',
              borderColor: 'var(--goldy-maroon-500)',
            }
          : {
              background: 'white',
              color: 'var(--goldy-maroon-600)',
              borderColor: 'var(--goldy-maroon-500)',
            }
      }
    >
      {label}
    </button>
  );
}
