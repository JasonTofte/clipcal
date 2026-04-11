'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EventCard } from '@/components/event-card';
import { Button } from '@/components/ui/button';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import {
  loadBatches,
  markBatchCommitted,
  type StoredEventBatch,
} from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings } from '@/lib/noticings';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import type { Event } from '@/lib/schema';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'free-food' | 'no-conflicts' | 'this-week';

type FeedRow = {
  batchId: string;
  eventIndex: number;
  event: Event;
  addedAt: string;
  icsCommitted: boolean;
};

const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';
const FORGOTTEN_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export default function FeedPage() {
  const [batches, setBatches] = useState<StoredEventBatch[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterKey>('all');

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

  const now = new Date();
  const activeCalendar = demoMode ? DEMO_CALENDAR : [];
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filter === 'free-food') return row.event.hasFreeFood;
      if (filter === 'no-conflicts') {
        const c = checkConflict(row.event, activeCalendar);
        return c.status === 'free';
      }
      if (filter === 'this-week') {
        const start = new Date(row.event.start);
        if (Number.isNaN(start.getTime())) return false;
        return start >= thisWeekStart && start < thisWeekEnd;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, demoMode]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Primary: addedAt desc (most recent first). Relevance sort would
      // require fetching /api/relevance across all batches which we do
      // not persist — Session 5 keeps that as a stretch.
      return b.addedAt.localeCompare(a.addedAt);
    });
  }, [filtered]);

  const forgotten = useMemo(() => {
    const nowMs = Date.now();
    return rows.filter((row) => {
      if (row.icsCommitted) return false;
      const ageMs = nowMs - new Date(row.addedAt).getTime();
      return ageMs > FORGOTTEN_THRESHOLD_MS;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const handleDownloadIcs = (row: FeedRow) => {
    triggerIcsDownload([row.event]);
    markBatchCommitted(row.batchId);
    setBatches(loadBatches());
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you&rsquo;ve extracted. Filter by what matters.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          back to upload
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          all ({rows.length})
        </FilterPill>
        <FilterPill
          active={filter === 'free-food'}
          onClick={() => setFilter('free-food')}
        >
          🍕 free food
        </FilterPill>
        <FilterPill
          active={filter === 'no-conflicts'}
          onClick={() => setFilter('no-conflicts')}
        >
          ✓ no conflicts
        </FilterPill>
        <FilterPill
          active={filter === 'this-week'}
          onClick={() => setFilter('this-week')}
        >
          this week
        </FilterPill>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {forgotten.length > 0 && filter === 'all' && (
            <section className="rounded-xl bg-amber-500/5 p-4 ring-1 ring-amber-500/20">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                You screenshotted these a while ago
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Added more than 7 days ago and never added to your calendar. Not a
                nag — just a noticing.
              </p>
              <ul className="space-y-1 text-sm">
                {forgotten.map((row) => (
                  <li key={`${row.batchId}-${row.eventIndex}`} className="flex items-start gap-2">
                    <span className="text-muted-foreground">·</span>
                    <span>
                      <span className="font-medium">{row.event.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {daysAgoLabel(row.addedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matches this filter.</p>
          ) : (
            sorted.map((row) => (
              <EventCard
                key={`${row.batchId}-${row.eventIndex}`}
                event={row.event}
                conflict={demoMode ? checkConflict(row.event, DEMO_CALENDAR) : null}
                relevance={null}
                noticings={generateNoticings(row.event, { demoCalendar: activeCalendar })}
                leaveBy={computeLeaveBy(row.event)}
                onChange={() => undefined /* feed rows are read-only for Session 5 */}
                onDownloadIcs={() => handleDownloadIcs(row)}
                onOpenGoogle={() => window.open(googleCalendarUrl(row.event), '_blank', 'noopener,noreferrer')}
                onOpenOutlook={() => window.open(outlookCalendarUrl(row.event), '_blank', 'noopener,noreferrer')}
              />
            ))
          )}
        </div>
      )}

      <footer className="mt-10 border-t border-border/50 pt-4 text-center text-[10px] font-mono text-muted-foreground">
        inform · don&rsquo;t decide
      </footer>
    </main>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
        active
          ? 'bg-primary text-primary-foreground ring-primary'
          : 'bg-background text-muted-foreground ring-border hover:bg-muted/50',
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
      <div className="text-4xl" aria-hidden>
        📭
      </div>
      <p className="text-sm text-muted-foreground">
        No flyers extracted yet. Head back to the upload page.
      </p>
      <Link href="/">
        <Button size="sm" variant="default">
          Upload a flyer
        </Button>
      </Link>
    </div>
  );
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function daysAgoLabel(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
