'use client';

import { useEffect, useState } from 'react';
import { X, Check, MapPin, List } from 'lucide-react';
import type { CampusFeedEvent, CampusFeedResponse } from '@/app/api/campus-feed/route';
import { loadProfileFromStorage } from '@/lib/profile';
import { scoreEvent, scoreTone, formatScoreBadge } from '@/lib/relevance';
import { useSwipeReveal } from '@/lib/use-swipe-reveal';
import { appendBatch, removeBatch } from '@/lib/event-store';
import type { Event } from '@/lib/schema';

function toEvent(ev: CampusFeedEvent): Event {
  // LiveWhale doesn't expose an end time; synthesize a 1-hour window so the
  // saved event renders as a block in the day rail and exports a valid DTEND
  // to ICS instead of a zero-duration marker.
  const start = new Date(ev.date_iso);
  const end = Number.isFinite(start.getTime())
    ? new Date(start.getTime() + 60 * 60 * 1000).toISOString()
    : null;
  return {
    title: ev.title,
    start: ev.date_iso,
    end,
    location: ev.location,
    description: ev.group_title,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

const TONE_STYLES: Record<'high' | 'medium' | 'low', { bg: string; fg: string }> = {
  high: { bg: 'var(--goldy-gold-100)', fg: 'var(--goldy-maroon-700)' },
  medium: { bg: 'var(--surface-calm)', fg: 'var(--muted-foreground)' },
  low: { bg: 'rgba(255,255,255,0.15)', fg: 'rgba(255,255,255,0.8)' },
};

const PLACEHOLDER_COLORS = [
  'linear-gradient(135deg, var(--goldy-maroon-500) 0%, var(--goldy-maroon-700) 100%)',
  'linear-gradient(135deg, #1a3a5c 0%, #0f2340 100%)',
  'linear-gradient(135deg, #2d5a3d 0%, #1a3a27 100%)',
  'linear-gradient(135deg, #4a2060 0%, #2a1040 100%)',
];

function SwipeCard({
  event,
  interests,
  colorIdx,
  onSkip,
  onOpen,
  isTop,
  stackOffset,
}: {
  event: CampusFeedEvent;
  interests: string[];
  colorIdx: number;
  onSkip: () => void;
  onOpen: () => void;
  isTop: boolean;
  stackOffset: number;
}) {
  const score = scoreEvent(event, interests);
  const tone = score === null ? null : scoreTone(score);

  const THRESHOLD = 90;
  const { ref, dx, isDragging } = useSwipeReveal<HTMLDivElement>({
    onSwipeLeft: onSkip,
    onSwipeRight: onOpen,
    threshold: THRESHOLD,
  });

  const absDx = Math.abs(dx);
  const swipeProgress = Math.min(1, absDx / THRESHOLD);
  const isSkipping = dx < -20;
  const isOpening = dx > 20;

  const rotation = isTop ? (dx / 18) : 0;

  return (
    <div
      ref={isTop ? ref : undefined}
      className="absolute inset-0"
      style={{
        transform: isTop
          ? `translateX(${dx}px) rotate(${rotation}deg) scale(${1 - stackOffset * 0.04})`
          : `translateY(${stackOffset * 10}px) scale(${1 - stackOffset * 0.04})`,
        transition: isDragging ? 'none' : 'transform 250ms ease-out',
        zIndex: 10 - stackOffset,
        touchAction: 'pan-y',
        userSelect: 'none',
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-3xl shadow-lg"
        style={{
          background: event.thumbnail
            ? undefined
            : PLACEHOLDER_COLORS[colorIdx % PLACEHOLDER_COLORS.length],
        }}
      >
        {event.thumbnail && (
          <img
            src={event.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ imageRendering: 'auto', objectPosition: 'center top' }}
            loading="eager"
            decoding="sync"
            draggable={false}
          />
        )}

        {/* gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* swipe intent overlays */}
        {isTop && (
          <>
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'rgba(220,50,50,0.25)',
                opacity: isSkipping ? swipeProgress : 0,
                transition: isDragging ? 'none' : 'opacity 150ms',
              }}
            />
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'rgba(30,180,80,0.25)',
                opacity: isOpening ? swipeProgress : 0,
                transition: isDragging ? 'none' : 'opacity 150ms',
              }}
            />
          </>
        )}

        {/* intent labels */}
        {isTop && isSkipping && (
          <div
            className="absolute left-4 top-6 rounded-xl border-2 border-red-400 px-3 py-1"
            style={{ opacity: swipeProgress }}
          >
            <span className="text-lg font-black uppercase tracking-widest text-red-400">Skip</span>
          </div>
        )}
        {isTop && isOpening && (
          <div
            className="absolute right-4 top-6 rounded-xl border-2 border-emerald-400 px-3 py-1"
            style={{ opacity: swipeProgress }}
          >
            <span className="text-lg font-black uppercase tracking-widest text-emerald-400">Open</span>
          </div>
        )}

        {/* match badge */}
        {score !== null && tone && (
          <div className="absolute right-3 top-3">
            <span
              className="inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold tabular-nums shadow"
              style={{
                background: TONE_STYLES[tone].bg,
                color: TONE_STYLES[tone].fg,
              }}
            >
              {formatScoreBadge(score)} match
            </span>
          </div>
        )}

        {/* content */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10">
          <h3 className="text-base font-bold leading-snug text-white line-clamp-2">
            {event.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/70">
            <span>{event.date_display}</span>
            {event.location && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <MapPin size={10} className="shrink-0" />
                  {event.location}
                </span>
              </>
            )}
          </div>
          {event.group_title && (
            <p className="mt-0.5 text-[11px] text-white/50 truncate">{event.group_title}</p>
          )}
          {event.cost && event.cost.toLowerCase() === 'free' && (
            <span className="mt-1.5 inline-block rounded-full bg-emerald-500/80 px-2 py-0.5 text-[11px] font-semibold text-white">
              Free
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({
  events,
  interests,
}: {
  events: CampusFeedEvent[];
  interests: string[];
}) {
  return (
    <ul className="space-y-2">
      {events.map((event) => {
        const score = scoreEvent(event, interests);
        const tone = score === null ? null : scoreTone(score);
        return (
          <li key={event.id}>
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
              style={{ borderColor: 'var(--border)' }}
            >
              {event.thumbnail && (
                <img
                  src={event.thumbnail}
                  alt=""
                  className="mt-0.5 size-10 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug group-hover:text-primary line-clamp-2">
                    {event.title}
                  </p>
                  {score !== null && tone && (
                    <span
                      className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                      style={{
                        background: TONE_STYLES[tone].bg,
                        color: tone === 'low' ? 'var(--muted-foreground)' : TONE_STYLES[tone].fg,
                      }}
                    >
                      {formatScoreBadge(score)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span>{event.date_display}</span>
                  {event.location && <><span>·</span><span className="truncate">{event.location}</span></>}
                  {event.cost?.toLowerCase() === 'free' && <span className="text-emerald-600">Free</span>}
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function CampusFeed() {
  const [events, setEvents] = useState<CampusFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [listMode, setListMode] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [savedToast, setSavedToast] = useState<{ batchId: string; title: string } | null>(null);

  useEffect(() => {
    const profile = loadProfileFromStorage();
    if (profile?.interests?.length) setInterests(profile.interests);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/campus-feed');
        if (!res.ok) return;
        const json = (await res.json()) as CampusFeedResponse;
        setEvents(json.events);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || events.length === 0) return null;

  const remaining = events.filter((_, i) => !dismissed.has(i));
  const allDone = remaining.length === 0;

  const skip = () => {
    const currentIdx = events.indexOf(remaining[0]);
    setDismissed((prev) => new Set([...prev, currentIdx]));
  };

  const open = () => {
    const current = remaining[0];
    if (!current) return;
    const batch = appendBatch([toEvent(current)], `Campus feed: ${current.url}`);
    window.open(current.url, '_blank', 'noopener,noreferrer');
    const currentIdx = events.indexOf(current);
    setDismissed((prev) => new Set([...prev, currentIdx]));
    setSavedToast({ batchId: batch.id, title: current.title });
    window.setTimeout(() => {
      setSavedToast((t) => (t && t.batchId === batch.id ? null : t));
    }, 5000);
  };

  const undoSave = () => {
    if (!savedToast) return;
    removeBatch(savedToast.batchId);
    setSavedToast(null);
  };

  return (
    <section className="mt-8" aria-labelledby="campus-feed-heading">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="campus-feed-body"
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>🏛️</span>
          <h2
            id="campus-feed-heading"
            className="text-sm font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            Happening on Campus
          </h2>
          <span
            className="text-[11px]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {events.length} live
          </span>
        </div>
        <span
          aria-hidden
          className="text-xs transition-transform"
          style={{
            color: 'var(--muted-foreground)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▾
        </span>
      </button>
      {!expanded ? null : (
      <div id="campus-feed-body" className="mt-3">
      {/* header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--goldy-maroon-600)' }}>
          Happening on Campus
        </span>
        <div className="flex items-center gap-3">
          {!listMode && !allDone && (
            <span className="text-[11px] text-muted-foreground">
              {remaining.length} of {events.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setListMode((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium"
            style={{ color: 'var(--goldy-maroon-500)' }}
          >
            <List size={13} />
            {listMode ? 'Card view' : 'See all'}
          </button>
        </div>
      </div>

      {listMode ? (
        <ListView events={events} interests={interests} />
      ) : allDone ? (
        <div
          className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed py-8 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--goldy-maroon-600)' }}>
            You&rsquo;ve seen everything
          </p>
          <button
            type="button"
            onClick={() => { setDismissed(new Set()); }}
            className="text-xs underline decoration-dotted underline-offset-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Start over
          </button>
        </div>
      ) : (
        <div>
          {/* card stack */}
          <div className="relative mx-auto" style={{ height: 300, maxWidth: 400 }}>
            {remaining.slice(0, 3).map((event, stackOffset) => {
              const originalIdx = events.indexOf(event);
              return (
                <SwipeCard
                  key={event.id}
                  event={event}
                  interests={interests}
                  colorIdx={originalIdx}
                  onSkip={skip}
                  onOpen={open}
                  isTop={stackOffset === 0}
                  stackOffset={stackOffset}
                />
              );
            })}
          </div>

          <div className="mx-auto mt-4 flex max-w-[400px] flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={skip}
                aria-label="Skip"
                className="flex items-center justify-center rounded-full border-2 shadow-sm transition-transform active:scale-95"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-paper)', width: 52, height: 52 }}
              >
                <X size={20} style={{ color: 'var(--muted-foreground)' }} />
              </button>
              <button
                type="button"
                onClick={open}
                aria-label="Open event"
                className="flex items-center justify-center rounded-full border-2 shadow-sm transition-transform active:scale-95"
                style={{ borderColor: 'var(--goldy-maroon-500)', background: 'var(--surface-paper)', width: 52, height: 52 }}
              >
                <Check size={20} style={{ color: 'var(--goldy-maroon-500)' }} />
              </button>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Swipe right to save · left to skip (or tap the buttons)
            </p>
          </div>
        </div>
      )}
      </div>
      )}
      {savedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 bottom-6 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-sm shadow-lg"
          style={{
            background: 'var(--surface-paper)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <span>Saved &ldquo;{savedToast.title.slice(0, 40)}{savedToast.title.length > 40 ? '…' : ''}&rdquo;</span>
          <button
            type="button"
            onClick={undoSave}
            className="font-semibold underline decoration-dotted underline-offset-2"
            style={{ color: 'var(--goldy-maroon-600)' }}
          >
            Undo
          </button>
        </div>
      )}
    </section>
  );
}
