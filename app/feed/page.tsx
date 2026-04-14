'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Dropzone } from '@/components/dropzone';
import { EventCard } from '@/components/event-card';
import { EinkSyncButton } from '@/components/eink-sync-button';
import { Button } from '@/components/ui/button';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import {
  appendBatch,
  loadBatches,
  markBatchCommitted,
  updateEventInBatch,
  type StoredEventBatch,
} from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings } from '@/lib/noticings';
import { loadProfileFromStorage } from '@/lib/profile';
import { decodeQRFromFile } from '@/lib/qr-decode';
import { syncToEinkWifi } from '@/lib/ble-sync';
import type { Event, Extraction } from '@/lib/schema';
import { cn } from '@/lib/utils';

type FilterKey = 'all' | 'free-food' | 'no-conflicts' | 'this-week';
type UploadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; count: number }
  | { status: 'error'; message: string };

type FeedRow = {
  batchId: string;
  eventIndex: number;
  event: Event;
  addedAt: string;
  icsCommitted: boolean;
};

const DEMO_MODE_STORAGE_KEY = 'showup_demo_mode';
const FORGOTTEN_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

async function compressImage(file: File, maxBytes = 4.5 * 1024 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, Math.sqrt(maxBytes / file.size));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg', 0.85,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function FeedPage() {
  const [batches, setBatches] = useState<StoredEventBatch[]>([]);
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [einkSync, setEinkSync] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');

  useEffect(() => {
    setBatches(loadBatches());
    loadProfileFromStorage();
    const storedDemo = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (storedDemo !== null) setDemoMode(storedDemo === 'true');
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadState({ status: 'loading' });
    setEinkSync('idle');

    const rawFile = files[0];
    const file = await compressImage(rawFile);
    const fd = new FormData();
    fd.append('image', file);
    const qrUrl = await decodeQRFromFile(rawFile);

    try {
      const response = await fetch('/api/extract', { method: 'POST', body: fd });
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errMsg =
          typeof json === 'object' && json !== null && 'error' in json &&
          typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : `HTTP ${response.status}`;
        setUploadState({ status: 'error', message: errMsg });
        return;
      }

      const extraction = json as Extraction;
      if (qrUrl) {
        extraction.events = extraction.events.map((e) => ({ ...e, signupUrl: qrUrl }));
      }
      appendBatch(extraction.events, extraction.sourceNotes);
      setBatches(loadBatches());
      setUploadState({ status: 'done', count: extraction.events.length });

      // Auto-sync to e-ink
      setEinkSync('syncing');
      syncToEinkWifi(extraction.events)
        .then(() => setEinkSync('done'))
        .catch(() => setEinkSync('error'));

      // Reset upload state after 3s so user can scan another
      setTimeout(() => setUploadState({ status: 'idle' }), 3000);
    } catch (err) {
      setUploadState({ status: 'error', message: err instanceof Error ? err.message : 'network error' });
    }
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

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [filtered],
  );

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
          <h1 className="font-heading text-2xl font-semibold tracking-tight">ShowUp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snap a flyer, know if you should go.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <EinkSyncButton events={rows.map((r) => r.event)} />
          <Link
            href="/interview"
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            profile
          </Link>
        </div>
      </header>

      {/* Upload section */}
      <div className="mb-6">
        {uploadState.status === 'idle' && (
          <Dropzone onFiles={handleFiles} />
        )}
        {uploadState.status === 'loading' && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6">
            <div className="size-6 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Claude is reading your flyer…</p>
          </div>
        )}
        {uploadState.status === 'done' && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              ✓ {uploadState.count} event{uploadState.count !== 1 ? 's' : ''} added
            </p>
            <button
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
              onClick={() => setUploadState({ status: 'idle' })}
            >
              scan another
            </button>
          </div>
        )}
        {uploadState.status === 'error' && (
          <div className="flex items-center justify-between rounded-2xl bg-destructive/10 px-4 py-3 ring-1 ring-destructive/20">
            <p className="text-sm text-destructive">{uploadState.message}</p>
            <button
              className="text-xs text-destructive underline decoration-dotted underline-offset-4"
              onClick={() => setUploadState({ status: 'idle' })}
            >
              try again
            </button>
          </div>
        )}
        {einkSync !== 'idle' && (
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            {einkSync === 'syncing' && '▦ syncing display…'}
            {einkSync === 'done'    && '▦ display updated ✓'}
            {einkSync === 'error'   && '▦ display sync failed — is Pi on the same network?'}
          </p>
        )}
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
          all ({rows.length})
        </FilterPill>
        <FilterPill active={filter === 'free-food'} onClick={() => setFilter('free-food')}>
          🍕 free food
        </FilterPill>
        <FilterPill active={filter === 'no-conflicts'} onClick={() => setFilter('no-conflicts')}>
          ✓ no conflicts
        </FilterPill>
        <FilterPill active={filter === 'this-week'} onClick={() => setFilter('this-week')}>
          this week
        </FilterPill>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No flyers scanned yet — snap one above.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {forgotten.length > 0 && filter === 'all' && (
            <section className="rounded-xl bg-amber-500/5 p-4 ring-1 ring-amber-500/20">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                You screenshotted these a while ago
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Added more than 7 days ago and never added to your calendar. Not a nag — just a noticing.
              </p>
              <ul className="space-y-1 text-sm">
                {forgotten.map((row) => (
                  <li key={`${row.batchId}-${row.eventIndex}`} className="flex items-start gap-2">
                    <span className="text-muted-foreground">·</span>
                    <span>
                      <span className="font-medium">{row.event.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{daysAgoLabel(row.addedAt)}</span>
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
                onChange={(updated) => {
                  updateEventInBatch(row.batchId, row.eventIndex, updated);
                  setBatches(loadBatches());
                }}
                onDownloadIcs={() => handleDownloadIcs(row)}
                onOpenGoogle={() => window.open(googleCalendarUrl(row.event), '_blank', 'noopener,noreferrer')}
                onOpenOutlook={() => window.open(outlookCalendarUrl(row.event), '_blank', 'noopener,noreferrer')}
              />
            ))
          )}
        </div>
      )}

      <footer className="mt-10 flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => {
              setDemoMode(e.target.checked);
              window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(e.target.checked));
            }}
            className="size-3.5 rounded border-border"
          />
          <span>Demo mode <span className="text-muted-foreground/60">(fake calendar)</span></span>
        </label>
        <span className="font-mono text-[10px]">inform · don&rsquo;t decide</span>
      </footer>
    </main>
  );
}

function FilterPill({
  active, onClick, children,
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
