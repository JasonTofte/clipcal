'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { WeekSection } from '@/components/week-section';
import { CampusFeed } from '@/components/campus-feed';
import { OneThingHero } from '@/components/one-thing-hero';
import { LeaveByNotifyToggle } from '@/components/leave-by-notify-toggle';
import { DEMO_CALENDAR, computeDemoFeedEvents } from '@/lib/demo-calendar';
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
import { formatWeekday } from '@/lib/format';
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
import { FOOD_RX, GAMEDAY_RX } from '@/lib/flyer-class';
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

  // When demo mode is on and nothing has been uploaded yet, seed the feed
  // with sample events so first-time visitors (and phone users on a fresh
  // session) see a real feed instead of the empty-state upload prompt.
  const demoFeedRows: FeedRow[] = useMemo(() => {
    if (!demoMode || rows.length > 0) return [];
    return computeDemoFeedEvents().map((event, i) => ({
      batchId: 'demo_feed',
      eventIndex: i,
      event,
      addedAt: new Date().toISOString(),
      icsCommitted: false,
    }));
  }, [demoMode, rows.length]);

  const activeRows = rows.length > 0 ? rows : demoFeedRows;

  const allEvents = useMemo(
    () =>
      [...activeRows.map((r) => r.event)].sort((a, b) =>
        a.start.localeCompare(b.start),
      ),
    [activeRows],
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
    return activeRows
      .map((row) => {
        const ctx = buildContext(row.event, calendar, allEvents, interests, now);
        const line = pickGoldyLine(row.event, ctx);
        const rank = bucketRank(ctx.bucket);
        return { row, ctx, line, rank };
      })
      .sort((a, b) => b.rank - a.rank);
  }, [activeRows, demoMode, interests, allEvents, nowOverride]);

  const recentClips = activeRows
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
    if (activeRows.length === 0) return null;
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

    if (activeRows.length <= 2) {
      return `Quiet week — just ${activeRows.length} event${activeRows.length === 1 ? '' : 's'} on deck. Want a look at what's new on campus?`;
    }

    return `You've got ${activeRows.length} events on deck. ${weekday}'s looking like your day.`;
  }, [activeRows, ranked, allEvents]);


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

  if (activeRows.length === 0) {
    return (
      <div
        className="mt-6 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed bg-white/60 p-10 text-center"
        style={{ borderColor: 'var(--goldy-maroon-200)' }}
      >
        <Camera aria-hidden size={40} strokeWidth={1.5} className="text-[var(--goldy-maroon-200)]" />
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

      <LeaveByNotifyToggle events={allEvents} />

      <WeekSection
        events={allEvents}
        busySlots={calendar}
        weekStart={weekStart}
        selectedDayIdx={selectedDayIdx}
        onSelectDay={setSelectedDayIdx}
        now={nowOverride ?? undefined}
      />

      <CampusFeed />

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

