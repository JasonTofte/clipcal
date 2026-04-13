'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { GoldyWeekGlance } from '@/components/goldy-week-glance';
import { GoldyEventRow } from '@/components/goldy-event-row';
import { OneThingHero } from '@/components/one-thing-hero';
import { LeaveByNotifyToggle } from '@/components/leave-by-notify-toggle';
import { CampusFeed } from '@/components/campus-feed';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import {
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
// Inlined: prior demo seed module (lib/demo-feed-seed.ts) was removed
// when we dropped auto-seeded fake flyers. The legacy id prefix is
// preserved here so this cleanup pass keeps stripping stale data
// from existing localStorage state for one or two release cycles.
const isDemoBatch = (id: string) => id.startsWith('demo_');
import {
  hideEvent,
  loadHiddenIds,
  unhideEvent,
  clearHiddenEvents,
} from '@/lib/hidden-events';
import { detectDuplicates, siblingDatesLabel } from '@/lib/dedupe-events';
import type { Event } from '@/lib/schema';

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 5000;

type UndoAction =
  | { kind: 'add'; batchId: string; title: string }
  | { kind: 'hide'; rowKey: string; title: string };

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
  // Undo is a discriminated action — same snackbar handles Add-to-Cal
  // reversal and hide reversal.
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const picksSectionRef = useRef<HTMLElement | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // Initial hydration: load user-uploaded batches + profile + demo-mode
  // + hidden-events set. No auto-seed: if the user hasn't uploaded
  // anything, the feed shows an empty state (with a LiveWhale fallback
  // hero further down). Stale demo_goldy_v* batches from prior builds
  // are stripped on first mount so they don't linger as fake "real"
  // data.
  useEffect(() => {
    const rawLoaded = loadBatches();
    const anyDemo = rawLoaded.some((b) => isDemoBatch(b.id));
    if (anyDemo) {
      const kept = rawLoaded.filter((b) => !isDemoBatch(b.id));
      window.localStorage.setItem(EVENT_STORE_KEY, JSON.stringify(kept));
    }
    setBatches(loadBatches());
    setProfile(loadProfileFromStorage());
    setHiddenIds(loadHiddenIds());
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

  // Greeting blurb picks the most interesting signal out of the ranked
  // results and addresses it directly. Falls back through: urgent →
  // packed-today → gameday-this-week → free-food-coming → open-weekend →
  // light-week → default. Each branch is a distinct sentence so reloading
  // the feed in different states reads as deliberate observation, not
  // a generic greeting.
  const greetingBlurb = useMemo(() => {
    if (rows.length === 0) return null;
    const weekday = formatWeekday(new Date());
    const todayISO = new Date().toISOString().slice(0, 10);

    const urgent = ranked.find(({ ctx }) => ctx.bucket === 'urgent');
    if (urgent) {
      const m = urgent.ctx.slots.minutesToLeaveBy ?? 0;
      return `Heads up — ${urgent.row.event.title} needs you moving in about ${m} min. Everything else can wait.`;
    }

    const todayEvents = allEvents.filter((e) => e.start.startsWith(todayISO));
    if (todayEvents.length >= 3) {
      return `${weekday}'s stacked — ${todayEvents.length} things on deck today. Want me to zoom in on today?`;
    }

    const gameday = ranked.find(({ ctx }) => ctx.bucket === 'top-pick-gameday');
    if (gameday) {
      return `Gameday on the calendar this week — ${gameday.row.event.title}. Want me to surface everything that fits around it?`;
    }

    const freeFood = ranked.find(({ ctx }) => ctx.bucket === 'free-food');
    if (freeFood) {
      return `Free food incoming: ${freeFood.row.event.title}. Worth a detour?`;
    }

    const weekendBooked = allEvents.some((e) => {
      const d = new Date(e.start).getDay();
      return d === 0 || d === 6;
    });
    if (!weekendBooked) {
      return `Peeked at your week — your weekend's wide open. Want me to surface what fits?`;
    }

    if (rows.length <= 2) {
      return `Quiet week — just ${rows.length} event${rows.length === 1 ? '' : 's'} on deck. Want a look at what's new on campus?`;
    }

    return `You've got ${rows.length} events on deck. ${weekday}'s looking like your day.`;
  }, [rows, ranked, allEvents]);

  const visibleRanked = useMemo(() => {
    let out = ranked;
    if (chipFilter !== 'all') {
      out = out.filter(({ ctx, row }) => {
        const hay = `${row.event.title} ${row.event.description ?? ''} ${row.event.category}`.toLowerCase();
        if (chipFilter === 'gameday') {
          // Bucket alone misses when a higher-priority bucket (urgent,
          // conflict) preempts gameday for the same event. Fall back to
          // the same keyword signals the commentary lib uses so the
          // chip matches human expectation.
          return (
            ctx.bucket === 'top-pick-gameday' ||
            row.event.category === 'sports' ||
            /\b(game|axe|stadium|gophers vs|huntington)\b/.test(hay)
          );
        }
        if (chipFilter === 'free-food') {
          // Extractor may not have set hasFreeFood reliably on
          // user-uploaded events. Keyword scan on the title +
          // description catches pizza/bagel/tacos/snacks/coffee/etc.
          return (
            ctx.bucket === 'free-food' ||
            row.event.hasFreeFood ||
            /\b(pizza|taco|donut|bagel|snack|coffee|food|lunch|brunch|dinner|treats)\b/.test(hay)
          );
        }
        return true;
      });
    }
    if (selectedDayIdx !== null) {
      out = out.filter(({ row }) => eventDayIdx(row.event.start, weekStart) === selectedDayIdx);
    }
    // Hidden events only show when the user explicitly expands the
    // "Hidden (N)" pill at the bottom.
    if (!showHidden) {
      out = out.filter(({ row }) => !hiddenIds.has(`${row.batchId}-${row.eventIndex}`));
    }
    return out;
  }, [ranked, chipFilter, selectedDayIdx, weekStart, hiddenIds, showHidden]);

  // Build duplicate index over all rows (even hidden ones, since a
  // hidden event can still be a sibling of a visible one).
  const duplicateIndex = useMemo(() => {
    const inputs = rows.map((r) => ({
      rowKey: `${r.batchId}-${r.eventIndex}`,
      event: r.event,
    }));
    return detectDuplicates(inputs);
  }, [rows]);

  const hiddenCount = hiddenIds.size;

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (chipFilter === 'gameday') parts.push('gameday');
    if (chipFilter === 'free-food') parts.push('free food');
    if (selectedDayIdx !== null) parts.push(DAY_FULL[selectedDayIdx]);
    return parts.join(' · ');
  }, [chipFilter, selectedDayIdx]);

  // Single helper: set undo action + start/reset the 5s dismissal timer.
  const armUndo = (action: UndoAction) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndo(action);
    undoTimerRef.current = window.setTimeout(() => {
      setUndo(null);
      undoTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  };

  const handleAdd = (row: FeedRow) => {
    triggerIcsDownload([row.event]);
    markBatchCommitted(row.batchId);
    setBatches(loadBatches());
    armUndo({ kind: 'add', batchId: row.batchId, title: row.event.title });
  };

  const handleHide = (row: FeedRow) => {
    const key = `${row.batchId}-${row.eventIndex}`;
    hideEvent(key);
    setHiddenIds(loadHiddenIds());
    armUndo({ kind: 'hide', rowKey: key, title: row.event.title });
  };

  const handleUndo = () => {
    if (!undo) return;
    if (undo.kind === 'add') {
      markBatchUncommitted(undo.batchId);
      setBatches(loadBatches());
    } else {
      unhideEvent(undo.rowKey);
      setHiddenIds(loadHiddenIds());
    }
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndo(null);
  };

  const handleUnhideAll = () => {
    clearHiddenEvents();
    setHiddenIds(new Set());
    setShowHidden(false);
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

  const registerCardRef = (key: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(key, el);
    else cardRefs.current.delete(key);
  };

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <GoldyGreeting
          blurb="Snap a flyer. I'll pull it out of your camera roll so it doesn't live there forever."
        />
        <div
          className="mt-8 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-white/60 p-10 text-center"
          style={{ borderColor: 'var(--goldy-maroon-200)' }}
        >
          <div className="text-4xl" aria-hidden>
            📸
          </div>
          <p className="text-sm text-stone-600">
            Your camera roll is full of flyers you meant to go to. Feed me one and I&rsquo;ll
            turn it into a decision you can actually act on.
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
      <OneThingHero
        events={allEvents}
        ranked={visibleRanked.map(({ row, ctx, line }) => ({
          event: row.event,
          ctx,
          line,
        }))}
        onAddToCalendar={(event) => {
          const hit = visibleRanked.find((r) => r.row.event === event);
          if (hit) handleAdd(hit.row);
        }}
        onHide={(event) => {
          const hit = visibleRanked.find((r) => r.row.event === event);
          if (hit) handleHide(hit.row);
        }}
      />

      <LeaveByNotifyToggle events={allEvents} />

      {greetingBlurb && (
        <GoldyGreeting
          blurb={greetingBlurb}
          chipFilter={chipFilter}
          onChipFilter={(next) => {
            setChipFilter(next);
            // Always clear any day filter so chip intent reads clearly.
            setSelectedDayIdx(null);
            // Scroll the picks into view so tapping a chip produces a
            // visible response even when the filter was already applied.
            window.requestAnimationFrame(() => {
              picksSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            });
          }}
          onScrollToToday={() => {
            // Filter picks to today.
            const todayIdx = new Date().getDay();
            // Convert JS getDay (0=Sun..6=Sat) to our Mon=0 system.
            const monIdx = todayIdx === 0 ? 6 : todayIdx - 1;
            setSelectedDayIdx(monIdx);
            setChipFilter('all');
            window.requestAnimationFrame(() => {
              picksSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            });
          }}
        />
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

      <section
        ref={picksSectionRef}
        className="mb-6 scroll-mt-20"
        aria-labelledby="goldy-picks-heading"
      >
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
          <div className="space-y-2">
            {/* Hero already surfaces index 0 when filters are off. Skip it in
                the list so we don't double-promote the same event. When a
                filter is active the hero still shows the ranked top of the
                filtered view, so skipping index 0 is consistent. */}
            {visibleRanked.slice(1).map(({ row, ctx, pct }) => {
              const key = `${row.batchId}-${row.eventIndex}`;
              const flashing = flashKey === key;
              return (
                <div
                  key={key}
                  ref={registerCardRef(key)}
                  className="rounded-2xl transition-shadow"
                  style={
                    flashing
                      ? {
                          boxShadow:
                            '0 0 0 3px var(--goldy-gold-400), 0 6px 18px -10px rgba(0,0,0,0.2)',
                        }
                      : undefined
                  }
                >
                  <GoldyEventRow
                    event={row.event}
                    ctx={ctx}
                    matchPct={pct}
                    duplicateLabel={siblingDatesLabel(key, duplicateIndex)}
                    onClick={() => handleAdd(row)}
                    onHide={() => handleHide(row)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold"
              style={{
                background: 'white',
                borderColor: 'var(--goldy-maroon-500)',
                color: 'var(--goldy-maroon-600)',
              }}
              aria-pressed={showHidden}
            >
              {showHidden
                ? `Hiding ${hiddenCount} — hide them again`
                : `Hidden (${hiddenCount}) — show`}
            </button>
            {showHidden && (
              <button
                type="button"
                onClick={handleUnhideAll}
                className="inline-flex min-h-[36px] items-center rounded-full px-3 py-1.5 font-semibold underline decoration-dotted underline-offset-4"
                style={{ color: 'var(--goldy-maroon-500)' }}
              >
                Unhide all
              </button>
            )}
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
              {undo.kind === 'add' ? (
                <>
                  Added <strong>{undo.title}</strong> to calendar.
                </>
              ) : (
                <>
                  Hid <strong>{undo.title}</strong>.
                </>
              )}
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
  onScrollToToday,
}: {
  blurb: string;
  chipFilter?: ChipFilter;
  onChipFilter?: (next: ChipFilter) => void;
  onScrollToToday?: () => void;
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
            aria-label="Jump into Goldy's picks"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            <GreetingChip
              label="Show me the picks ↓"
              active={chipFilter === 'all'}
              onClick={() => onChipFilter('all')}
            />
            {onScrollToToday && (
              <GreetingChip
                label="Just today"
                active={false}
                onClick={onScrollToToday}
              />
            )}
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
