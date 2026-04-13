'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { GoldyWeekGlance } from '@/components/goldy-week-glance';
import { GoldyEventCard } from '@/components/goldy-event-card';
import { CampusFeed } from '@/components/campus-feed';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import {
  loadBatches,
  markBatchCommitted,
  type StoredEventBatch,
} from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import { buildContext, pickGoldyLine } from '@/lib/goldy-commentary';
import { formatShortDate, formatWeekday } from '@/lib/format';
import type { Event } from '@/lib/schema';

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';

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

export function GoldyFeedClient() {
  const [batches, setBatches] = useState<StoredEventBatch[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');

  useEffect(() => {
    setBatches(loadBatches());
    setProfile(loadProfileFromStorage());
    const storedDemo = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (storedDemo !== null) setDemoMode(storedDemo === 'true');
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

  const ranked = useMemo(() => {
    return rows
      .map((row) => {
        const ctx = buildContext(row.event, calendar, allEvents, interests);
        const line = pickGoldyLine(row.event, ctx);
        const pct = bucketMatchPct(ctx.bucket);
        return { row, ctx, line, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [rows, demoMode, interests, allEvents]);

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
    if (chipFilter === 'all') return ranked;
    return ranked.filter(({ ctx, row }) => {
      if (chipFilter === 'gameday') return ctx.bucket === 'top-pick-gameday';
      if (chipFilter === 'free-food')
        return ctx.bucket === 'free-food' || row.event.hasFreeFood;
      return true;
    });
  }, [ranked, chipFilter]);

  const handleAdd = (row: FeedRow) => {
    triggerIcsDownload([row.event]);
    markBatchCommitted(row.batchId);
    setBatches(loadBatches());
  };

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <GoldyGreeting
          blurb="Hey! No flyers yet. Snap one and I'll do the rest."
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
      {greetingBlurb && (
        <GoldyGreeting
          blurb={greetingBlurb}
          chipFilter={chipFilter}
          onChipFilter={setChipFilter}
        />
      )}

      <GoldyWeekGlance events={allEvents} />

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
              {recentClips.length} snapped
            </span>
          </div>
          <p className="mb-3 text-xs text-stone-500">
            I&apos;ll remember, so you don&apos;t have to.
          </p>
          <div className="scrollbar-hide goldy-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {recentClips.map(({ batchId, eventIndex, event }) => {
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
                <div key={`${batchId}-${eventIndex}`} className="goldy-snap-item w-40 shrink-0">
                  <div
                    className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-lg ${flyer}`}
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
                </div>
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
            {chipFilter === 'all'
              ? 'Sorted by fit'
              : `${visibleRanked.length} of ${ranked.length}`}
          </span>
        </div>
        {visibleRanked.length === 0 ? (
          <p
            className="rounded-2xl border-2 border-dashed bg-white/60 p-6 text-center text-sm text-stone-600"
            style={{ borderColor: 'var(--goldy-maroon-200)' }}
          >
            Nothing matches &ldquo;{chipFilter === 'gameday' ? 'Just gameday' : 'Free food only'}&rdquo; right now.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleRanked.map(({ row, line, pct }, i) => (
              <GoldyEventCard
                key={`${row.batchId}-${row.eventIndex}`}
                event={row.event}
                goldyLine={line}
                matchPct={pct}
                isTopPick={i === 0 && chipFilter === 'all'}
                onAddToCalendar={() => handleAdd(row)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-6">
        <CampusFeed />
      </div>
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
