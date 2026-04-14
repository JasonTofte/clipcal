'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { WeekStrip } from '@/components/week-strip';
import { DayRail } from '@/components/day-rail';
import { GoldyEventRow } from '@/components/goldy-event-row';
import { OneThingHero } from '@/components/one-thing-hero';
import { FeedOverflowMenu } from '@/components/feed-overflow-menu';
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
import { formatShortDate } from '@/lib/format';
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
import { flyerClass } from '@/lib/flyer-class';
import type { Event } from '@/lib/schema';

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 5000;

type UndoAction =
  | { kind: 'add'; batchId: string; title: string }
  | { kind: 'hide'; rowKey: string; title: string };

type FeedRow = {
  batchId: string;
  eventIndex: number;
  event: Event;
  addedAt: string;
  icsCommitted: boolean;
};

// Ranking key used only to sort the picks list. Not shown to users as a
// percentage because it isn't a real affinity score — the bucket already
// encodes the signal ("urgent" > "top-pick-gameday" > "interest-match"
// etc.) and presenting it as "92% match" would overclaim.
function bucketRank(bucket: string): number {
  switch (bucket) {
    case 'urgent': return 100;
    case 'top-pick-gameday': return 90;
    case 'interest-match': return 80;
    case 'free-food': return 70;
    case 'back-to-back': return 60;
    case 'conflict': return 50;
    case 'weekend-open': return 40;
    case 'late-night': return 30;
    default: return 20;
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
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  // Undo is a discriminated action — same snackbar handles Add-to-Cal
  // reversal and hide reversal.
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
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
        const rank = bucketRank(ctx.bucket);
        return { row, ctx, line, rank };
      })
      .sort((a, b) => b.rank - a.rank);
  }, [rows, demoMode, interests, allEvents, nowOverride]);

  const recentClips = rows
    .filter((r) => showHidden || !hiddenIds.has(`${r.batchId}-${r.eventIndex}`))
    .slice()
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 6);

  const visibleRanked = useMemo(() => {
    let out = ranked;
    if (selectedDayIdx !== null) {
      out = out.filter(({ row }) => eventDayIdx(row.event.start, weekStart) === selectedDayIdx);
    }
    // Hidden events only show when the user explicitly expands the
    // "Hidden (N)" pill at the bottom.
    if (!showHidden) {
      out = out.filter(({ row }) => !hiddenIds.has(`${row.batchId}-${row.eventIndex}`));
    }
    return out;
  }, [ranked, selectedDayIdx, weekStart, hiddenIds, showHidden]);

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
    if (selectedDayIdx === null) return '';
    return DAY_FULL[selectedDayIdx];
  }, [selectedDayIdx]);

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
    // The top-ranked event lives inside OneThingHero (not the ranked list,
    // which is .slice(1)), so its ref is never registered. Fall back to a
    // top-of-page scroll so tapping its thumbnail always shows SOMETHING.
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
      <div
        className="mt-6 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-white/60 p-10 text-center"
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
    );
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-end">
        <FeedOverflowMenu events={allEvents} />
      </div>

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

      <WeekStrip
        mode={{ source: 'events', events: allEvents }}
        weekStart={weekStart}
        selectedDayIdx={selectedDayIdx}
        onSelectDay={setSelectedDayIdx}
      />

      {selectedDayIdx !== null && (
        <div className="mb-5">
          <DayRail
            dayIdx={selectedDayIdx}
            weekStart={weekStart}
            events={allEvents}
            busySlots={calendar}
            now={nowOverride ?? undefined}
            onBack={() => setSelectedDayIdx(null)}
          />
        </div>
      )}

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
              const flyer = flyerClass(event);
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
            {selectedDayIdx !== null && (
              <button
                type="button"
                onClick={() => setSelectedDayIdx(null)}
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
            {visibleRanked.slice(1).map(({ row, ctx }) => {
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

