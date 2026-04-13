'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HomeIdleView } from '@/components/home-idle-view';
import { HomeSuccessView } from '@/components/home-success-view';
import { WeekDensity } from '@/components/week-density';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import { appendBatch, markBatchCommitted } from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings } from '@/lib/noticings';
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
    const file = files[0];
    lastFileRef.current = file;
    setState({
      status: 'loading',
      message: model === 'sonnet' ? 'Retrying with Claude Sonnet…' : LOADING_MESSAGE,
    });

    const formData = new FormData();
    formData.append('image', file);
    if (model) formData.append('model', model);

    try {
      const response = await fetch('/api/extract', { method: 'POST', body: formData });
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errMsg =
          typeof json === 'object' &&
          json !== null &&
          'error' in json &&
          typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : `HTTP ${response.status}`;
        setState({ status: 'error', message: errMsg });
        return;
      }

      const extraction = json as Extraction;
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
  const noticingsPerEvent = useMemo(
    () => events.map((event) => generateNoticings(event, { demoCalendar: activeCalendar })),
    [events, activeCalendar],
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-lg shadow-sm">
              📅
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">ClipCal</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Your campus copilot. Snap a flyer, know if you should go.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <Link
            href="/profile"
            className="underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {profile ? 'edit interests' : 'pick your interests'}
          </Link>
          <Link
            href="/feed"
            className="underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            feed
          </Link>
        </div>
      </header>

      {demoMode && (
        <div className="mb-4">
          <WeekDensity busySlots={DEMO_CALENDAR} />
        </div>
      )}

      <div className="flex-1">
        {state.status === 'idle' && <HomeIdleView demoMode={demoMode} onFiles={handleFiles} />}

        {state.status === 'loading' && <LoadingPanel message={state.message} />}

        {state.status === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-destructive/10 p-4 ring-1 ring-destructive/20">
              <p className="text-sm font-medium text-destructive">Hmm, couldn&rsquo;t read that one</p>
              <p className="mt-0.5 text-xs text-destructive/70">{state.message}</p>
            </div>
            <Button onClick={reset} variant="outline" className="w-fit">
              Try a different flyer
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

function LoadingPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center">
      <div className="text-4xl animate-bounce" aria-hidden>🔍</div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs text-muted-foreground">Usually takes about 5 seconds</p>
      </div>
    </div>
  );
}
