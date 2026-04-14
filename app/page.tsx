'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HomeIdleView } from '@/components/home-idle-view';
import { HomeSuccessView } from '@/components/home-success-view';
import { decodeQRFromFile } from '@/lib/qr-decode';
import { downscaleIfNeeded } from '@/lib/image-downscale';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import { appendBatch, markBatchCommitted } from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings, type LatLng } from '@/lib/noticings';
import { geocodeCached } from '@/lib/geocode';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import type { RelevanceScore } from '@/lib/relevance';
import type { Event, Extraction } from '@/lib/schema';
import type { CampusMatch } from '@/app/api/campus-match/route';
import type { OrgMatch } from '@/app/api/campus-orgs/route';
import {
  fetchRelevance,
  fetchCampusMatches,
  fetchOrgMatches,
} from '@/lib/extraction-client';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { usePasteFiles } from '@/hooks/use-paste-files';
import { useShareTarget } from '@/hooks/use-share-target';

type UxState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | {
      status: 'success';
      batchId: string;
      events: Event[];
      sourceNotes: string | null;
      relevance: RelevanceScore[] | null;
      campusMatches: (CampusMatch | null)[] | null;
      orgMatches: (OrgMatch | null)[] | null;
    }
  | { status: 'error'; message: string };

const LOADING_MESSAGE = 'Claude is reading your flyer…';

export default function Home() {
  const [state, setState] = useState<UxState>({ status: 'idle' });
  const [demoMode, setDemoMode] = useDemoMode(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const lastFileRef = useRef<File | null>(null);

  useEffect(() => {
    setProfile(loadProfileFromStorage());
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const handleFiles = useCallback(async (files: File[], model?: 'sonnet') => {
    if (files.length === 0) return;
    const originalFile = files[0];
    lastFileRef.current = originalFile;
    setState({
      status: 'loading',
      message: model === 'sonnet' ? 'Retrying with Claude Sonnet…' : LOADING_MESSAGE,
    });

    const file = await downscaleIfNeeded(originalFile);
    const formData = new FormData();
    formData.append('image', file);
    if (model) formData.append('model', model);

    try {
      // Run QR decode in parallel with extraction. Decode is on-device
      // (BarcodeDetector or qr-scanner), filtered to http(s) URLs only.
      // If a QR is present, we attach the URL to every extracted event
      // as `signupUrl` — surfaced as a link chip in the event card.
      const [response, qrUrl] = await Promise.all([
        fetch('/api/extract', { method: 'POST', body: formData }),
        decodeQRFromFile(originalFile).catch(() => null),
      ]);
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errMsg =
          typeof json === 'object' &&
          json !== null &&
          'error' in json &&
          typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : response.status === 413
              ? 'Image too large — try a smaller photo'
              : `HTTP ${response.status}`;
        setState({ status: 'error', message: errMsg });
        return;
      }

      const extraction = json as Extraction;
      if (qrUrl) {
        extraction.events = extraction.events.map((e) => ({
          ...e,
          signupUrl: qrUrl,
        }));
      }
      const saved = appendBatch(extraction.events, extraction.sourceNotes);
      setState({
        status: 'success',
        batchId: saved.id,
        events: extraction.events,
        sourceNotes: extraction.sourceNotes,
        relevance: null,
        campusMatches: null,
        orgMatches: null,
      });

      // Kick off enrichment calls. All three are fire-and-forget — errors
      // are absorbed inside each client; these features enhance the success
      // state but aren't required for it.
      const currentProfile = loadProfileFromStorage();
      if (currentProfile) {
        void fetchRelevance(extraction.events, currentProfile).then((scores) => {
          if (!scores) return;
          setState((prev) => (prev.status === 'success' ? { ...prev, relevance: scores } : prev));
        });
      }
      void fetchCampusMatches(extraction.events).then((matches) => {
        setState((prev) => (prev.status === 'success' ? { ...prev, campusMatches: matches } : prev));
      });
      void fetchOrgMatches(extraction.events).then((matches) => {
        setState((prev) => (prev.status === 'success' ? { ...prev, orgMatches: matches } : prev));
      });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'network error',
      });
    }
  }, []);

  usePasteFiles(handleFiles);
  useShareTarget(useCallback((file: File) => handleFiles([file]), [handleFiles]));

  const updateEvent = (idx: number, updated: Event) => {
    setState((prev) => {
      if (prev.status !== 'success') return prev;
      const next = [...prev.events];
      next[idx] = updated;
      return { ...prev, events: next };
    });
  };

  const reset = () => setState({ status: 'idle' });

  const events = state.status === 'success' ? state.events : [];
  const activeCalendar = demoMode ? DEMO_CALENDAR : [];
  const conflicts = useMemo(
    () => (demoMode ? events.map((e) => checkConflict(e, DEMO_CALENDAR)) : events.map(() => null)),
    [events, demoMode],
  );
  // Geocoded coords per unique event location. Populated lazily by the
  // useEffect below; absent entries mean "not yet resolved or lookup failed",
  // which noticings treats as "no walk chip" rather than fabricating a time.
  const [locationCoords, setLocationCoords] = useState<Map<string, LatLng | null>>(
    () => new Map(),
  );
  useEffect(() => {
    const unique = new Set<string>();
    for (const ev of events) {
      if (ev.location && !locationCoords.has(ev.location)) unique.add(ev.location);
    }
    if (unique.size === 0) return;
    let cancelled = false;
    void Promise.all(
      Array.from(unique).map(async (loc) => {
        const hit = await geocodeCached(loc);
        return [loc, hit ? { lat: hit.lat, lng: hit.lng } : null] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      setLocationCoords((prev) => {
        const next = new Map(prev);
        for (const [loc, coords] of results) next.set(loc, coords);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [events, locationCoords]);

  const originCoords: LatLng | null = profile?.homeBase
    ? { lat: profile.homeBase.lat, lng: profile.homeBase.lng }
    : null;

  const noticingsPerEvent = useMemo(
    () =>
      events.map((event) =>
        generateNoticings(event, {
          demoCalendar: activeCalendar,
          originCoords,
          destinationCoords: event.location ? locationCoords.get(event.location) ?? null : null,
        }),
      ),
    [events, activeCalendar, originCoords, locationCoords],
  );
  const leaveByPerEvent = useMemo(
    () => events.map((event) => computeLeaveBy(event)),
    [events],
  );

  const handleDownloadIcs = (event: Event) => {
    triggerIcsDownload([event]);
    if (state.status === 'success') markBatchCommitted(state.batchId);
  };
  const handleDownloadAll = () => {
    if (state.status !== 'success') return;
    triggerIcsDownload(state.events);
    markBatchCommitted(state.batchId);
  };
  const handleRetryWithSonnet = () => {
    if (lastFileRef.current) handleFiles([lastFileRef.current], 'sonnet');
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">ClipCal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your campus copilot. Snap a flyer, know if you should go.
          </p>
        </div>
      </header>

      {demoMode && <TodaySnapshot busySlots={DEMO_CALENDAR} />}

      <div className="flex-1">
        {state.status === 'idle' && <HomeIdleView onFiles={handleFiles} />}

        {state.status === 'loading' && <LoadingPanel message={state.message} />}

        {state.status === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">
              Something went wrong: {state.message}
            </div>
            <Button onClick={reset} variant="outline" className="w-fit">
              Try another flyer
            </Button>
          </div>
        )}

        {state.status === 'success' && (
          <HomeSuccessView
            events={state.events}
            sourceNotes={state.sourceNotes}
            relevance={state.relevance}
            campusMatches={state.campusMatches}
            orgMatches={state.orgMatches}
            conflicts={conflicts}
            noticingsPerEvent={noticingsPerEvent}
            interests={profile?.interests ?? null}
            leaveByPerEvent={leaveByPerEvent}
            busySlots={activeCalendar}
            canRetryWithSonnet={
              state.events.some((e) => e.confidence === 'low' || e.confidence === 'medium') &&
              lastFileRef.current !== null
            }
            onUpdateEvent={updateEvent}
            onDownloadIcs={handleDownloadIcs}
            onDownloadAll={handleDownloadAll}
            onReset={reset}
            onRetryWithSonnet={handleRetryWithSonnet}
          />
        )}
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="size-3.5 rounded border-border"
          />
          <span>
            Demo mode <span className="text-muted-foreground/60">(fake calendar)</span>
          </span>
        </label>
        <span className="font-mono text-[10px]">inform · don&rsquo;t decide</span>
      </footer>
    </main>
  );
}

function TodaySnapshot({ busySlots }: { busySlots: typeof DEMO_CALENDAR }) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const count = busySlots.filter(
    (s) => s.start < dayEnd && s.end > dayStart,
  ).length;

  const dayLabel = now.toLocaleDateString('en-US', { weekday: 'short' });
  const dateLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fillPct = Math.min(100, count * 20);
  const busy = count > 0;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          {dayLabel}
        </span>
        <span className="text-lg font-bold leading-tight" style={{ color: 'var(--goldy-maroon-600)' }}>
          {dateLabel.split(' ')[1]}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          {dateLabel.split(' ')[0]}
        </span>
      </div>

      <div
        className="relative h-10 w-3 shrink-0 overflow-hidden rounded-full"
        style={{
          background: busy ? 'var(--surface-calm)' : 'transparent',
          border: busy ? '1px solid var(--border)' : '1.5px solid var(--goldy-gold-400)',
        }}
      >
        {busy && (
          <div
            className="absolute inset-x-0 bottom-0 rounded-full"
            style={{ height: `${fillPct}%`, background: 'var(--goldy-maroon-500)' }}
          />
        )}
        {!busy && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="block size-1.5 rounded-full" style={{ background: 'var(--goldy-gold-400)' }} />
          </span>
        )}
      </div>

      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {count === 0 ? 'Open day' : `${count} event${count === 1 ? '' : 's'} today`}
      </span>
    </div>
  );
}

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-10">
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
