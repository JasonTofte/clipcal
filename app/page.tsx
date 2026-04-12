'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CampusFeed } from '@/components/campus-feed';
import { Dropzone } from '@/components/dropzone';
import { EventCard } from '@/components/event-card';
import { WeekDensity } from '@/components/week-density';
import { Button } from '@/components/ui/button';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import { appendBatch, markBatchCommitted } from '@/lib/event-store';
import { triggerIcsDownload } from '@/lib/ics';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings } from '@/lib/noticings';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import { RelevanceBatchSchema, type RelevanceScore } from '@/lib/relevance';
import type { Event, Extraction } from '@/lib/schema';
import type { CampusMatch, CampusMatchResponse } from '@/app/api/campus-match/route';
import type { OrgMatch, OrgMatchResponse } from '@/app/api/campus-orgs/route';

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
const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';

// Stable sample event used for the idle-state teaser. Hardcoded (not computed
// from new Date()) so SSR prerender and client hydration produce identical
// output. Values are chosen so noticings + conflict + leave-by + relevance all
// fire with visually interesting results against DEMO_CALENDAR.
const TEASER_EVENT: Event = {
  title: 'Data Viz Workshop',
  start: '2026-04-18T19:00:00-05:00', // Sat 7:00 PM Central
  end: '2026-04-18T20:30:00-05:00',
  location: 'Walter Library 101',
  description: 'Intro to D3.js and observable notebooks. Beginner friendly — come play.',
  category: 'workshop',
  hasFreeFood: true,
  timezone: 'America/Chicago',
  confidence: 'high',
};

const TEASER_RELEVANCE: RelevanceScore = {
  score: 82,
  reason: 'matches your data + workshops interests',
};

async function fetchCampusMatches(
  events: Event[],
): Promise<(CampusMatch | null)[]> {
  const results = await Promise.all(
    events.map(async (event) => {
      try {
        const res = await fetch('/api/campus-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: event.title, start: event.start }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as CampusMatchResponse;
        return json.matches.length > 0 ? json.matches[0] : null;
      } catch {
        return null;
      }
    }),
  );
  return results;
}

async function fetchOrgMatches(
  events: Event[],
): Promise<(OrgMatch | null)[]> {
  const results = await Promise.all(
    events.map(async (event) => {
      try {
        const res = await fetch('/api/campus-orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: event.title, start: event.start }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as OrgMatchResponse;
        return json.matches.length > 0 ? json.matches[0] : null;
      } catch {
        return null;
      }
    }),
  );
  return results;
}

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function fetchRelevance(
  events: Event[],
  profile: Profile,
): Promise<RelevanceScore[] | null> {
  try {
    const response = await fetch('/api/relevance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, profile }),
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const parsed = RelevanceBatchSchema.safeParse(json);
    return parsed.success ? parsed.data.scores : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [state, setState] = useState<UxState>({ status: 'idle' });
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const lastFileRef = useRef<File | null>(null);

  // Load demo-mode preference, profile, and register service worker on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored !== null) setDemoMode(stored === 'true');
    setProfile(loadProfileFromStorage());

    // Register service worker for PWA share target (Android)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(demoMode));
  }, [demoMode]);

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

      // Kick off relevance scoring if we have a profile. Silent no-op
      // otherwise. Errors are absorbed — relevance is an enhancement, not
      // a hard dependency of the success state.
      const currentProfile = loadProfileFromStorage();
      if (currentProfile) {
        void fetchRelevance(extraction.events, currentProfile).then((scores) => {
          if (!scores) return;
          setState((prev) => {
            if (prev.status !== 'success') return prev;
            return { ...prev, relevance: scores };
          });
        });
      }

      // Kick off campus match lookup against UMN LiveWhale calendar.
      void fetchCampusMatches(extraction.events).then((matches) => {
        setState((prev) => {
          if (prev.status !== 'success') return prev;
          return { ...prev, campusMatches: matches };
        });
      });

      // Kick off GopherLink student org match lookup.
      void fetchOrgMatches(extraction.events).then((matches) => {
        setState((prev) => {
          if (prev.status !== 'success') return prev;
          return { ...prev, orgMatches: matches };
        });
      });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'network error',
      });
    }
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    }

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles]);

  // Pick up images shared via Android share sheet (PWA share target).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'share') return;

    // Clean the URL so a refresh doesn't re-trigger
    window.history.replaceState({}, '', '/');

    (async () => {
      try {
        const cache = await caches.open('clipcal-shared-media');
        const response = await cache.match('/shared-media/latest');
        if (!response) return;
        const blob = await response.blob();
        const file = new File([blob], response.headers.get('X-Filename') || 'shared.jpg', {
          type: blob.type,
        });
        await cache.delete('/shared-media/latest');
        handleFiles([file]);
      } catch {
        // Shared media pickup is best-effort
      }
    })();
  }, [handleFiles]);

  const updateEvent = (idx: number, updated: Event) => {
    setState((prev) => {
      if (prev.status !== 'success') return prev;
      const next = [...prev.events];
      next[idx] = updated;
      return { ...prev, events: next };
    });
  };

  const reset = () => setState({ status: 'idle' });

  // Derived: compute conflicts for each event against the active calendar source.
  // In demo mode, use DEMO_CALENDAR. When demo mode is off, we have no real
  // calendar source wired up yet (live OAuth is a Session 3 stretch), so we
  // return null → EventCard hides the badge.
  const events = state.status === 'success' ? state.events : [];
  const activeCalendar = demoMode ? DEMO_CALENDAR : [];
  const conflicts = useMemo(
    () => (demoMode ? events.map((e) => checkConflict(e, DEMO_CALENDAR)) : events.map(() => null)),
    [events, demoMode],
  );
  const noticingsPerEvent = useMemo(
    () =>
      events.map((event) =>
        generateNoticings(event, { demoCalendar: activeCalendar }),
      ),
    [events, demoMode],
  );
  const leaveByPerEvent = useMemo(
    () => events.map((event) => computeLeaveBy(event)),
    [events],
  );

  const handleDownloadIcs = (event: Event) => {
    triggerIcsDownload([event]);
    if (state.status === 'success') {
      markBatchCommitted(state.batchId);
    }
  };

  const handleDownloadAll = () => {
    if (state.status !== 'success') return;
    triggerIcsDownload(state.events);
    markBatchCommitted(state.batchId);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">ClipCal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your campus copilot. Snap a flyer, know if you should go.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <Link
            href="/interview"
            className="underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {profile ? 'edit profile' : 'set up profile'}
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
        {state.status === 'idle' && (
          <div className="flex flex-col gap-6">
            <Dropzone onFiles={handleFiles} />
            {demoMode && (
              <section className="space-y-3">
                <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>What you&rsquo;ll see</span>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="font-mono text-[10px] text-muted-foreground/60">sample</span>
                </div>
                <EventCard
                  event={TEASER_EVENT}
                  conflict={checkConflict(TEASER_EVENT, DEMO_CALENDAR)}
                  relevance={TEASER_RELEVANCE}
                  campusMatch={null}
                  orgMatch={null}
                  noticings={generateNoticings(TEASER_EVENT, { demoCalendar: DEMO_CALENDAR })}
                  leaveBy={computeLeaveBy(TEASER_EVENT)}
                  busySlots={DEMO_CALENDAR}
                  readOnly
                  onChange={() => undefined}
                  onDownloadIcs={() => undefined}
                  onOpenGoogle={() => undefined}
                  onOpenOutlook={() => undefined}
                />
                <p className="text-center text-[11px] text-muted-foreground/70">
                  Upload any flyer above to get your own.
                </p>
              </section>
            )}
            <CampusFeed />
          </div>
        )}

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
          <div className="flex flex-col gap-4">
            {state.events.length > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {state.events.length} events found on this flyer
                </p>
                <Button size="sm" variant="default" onClick={handleDownloadAll}>
                  + Add all
                </Button>
              </div>
            )}
            {state.events.map((event, idx) => (
              <EventCard
                key={idx}
                event={event}
                conflict={conflicts[idx]}
                relevance={state.relevance?.[idx] ?? null}
                campusMatch={state.campusMatches?.[idx] ?? null}
                orgMatch={state.orgMatches?.[idx] ?? null}
                noticings={noticingsPerEvent[idx]}
                leaveBy={leaveByPerEvent[idx]}
                busySlots={activeCalendar}
                onChange={(updated) => updateEvent(idx, updated)}
                onDownloadIcs={() => handleDownloadIcs(event)}
                onOpenGoogle={() => openInNewTab(googleCalendarUrl(event))}
                onOpenOutlook={() => openInNewTab(outlookCalendarUrl(event))}
              />
            ))}
            {state.sourceNotes && (
              <p className="text-xs italic text-muted-foreground">
                note from Claude: {state.sourceNotes}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={reset} variant="outline" className="w-fit">
                Upload another
              </Button>
              {state.events.some((e) => e.confidence === 'low' || e.confidence === 'medium') &&
                lastFileRef.current && (
                  <Button
                    variant="secondary"
                    className="w-fit"
                    onClick={() => {
                      if (lastFileRef.current) handleFiles([lastFileRef.current], 'sonnet');
                    }}
                  >
                    🔬 Try with stronger model
                  </Button>
                )}
            </div>
          </div>
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
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-10">
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
