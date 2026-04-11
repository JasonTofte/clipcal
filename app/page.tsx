'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Dropzone } from '@/components/dropzone';
import { EventCard } from '@/components/event-card';
import { Button } from '@/components/ui/button';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import { triggerIcsDownload } from '@/lib/ics';
import { loadProfileFromStorage, type Profile } from '@/lib/profile';
import { RelevanceBatchSchema, type RelevanceScore } from '@/lib/relevance';
import type { Event, Extraction } from '@/lib/schema';

type UxState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | {
      status: 'success';
      events: Event[];
      sourceNotes: string | null;
      relevance: RelevanceScore[] | null;
    }
  | { status: 'error'; message: string };

const LOADING_MESSAGE = 'Claude is reading your flyer…';
const DEMO_MODE_STORAGE_KEY = 'clipcal_demo_mode';

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

  // Load demo-mode preference and profile once on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    if (stored !== null) setDemoMode(stored === 'true');
    setProfile(loadProfileFromStorage());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, String(demoMode));
  }, [demoMode]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setState({ status: 'loading', message: LOADING_MESSAGE });

    const formData = new FormData();
    formData.append('image', file);

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
      setState({
        status: 'success',
        events: extraction.events,
        sourceNotes: extraction.sourceNotes,
        relevance: null,
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
  const conflicts = useMemo(
    () => (demoMode ? events.map((e) => checkConflict(e, DEMO_CALENDAR)) : events.map(() => null)),
    [events, demoMode],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">ClipCal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your campus copilot. Snap a flyer, know if you should go.
          </p>
        </div>
        <Link
          href="/interview"
          className="shrink-0 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {profile ? 'edit profile' : 'set up profile'}
        </Link>
      </header>

      <div className="flex-1">
        {state.status === 'idle' && <Dropzone onFiles={handleFiles} />}

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
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => triggerIcsDownload(state.events)}
                >
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
                onChange={(updated) => updateEvent(idx, updated)}
                onDownloadIcs={() => triggerIcsDownload([event])}
                onOpenGoogle={() => openInNewTab(googleCalendarUrl(event))}
                onOpenOutlook={() => openInNewTab(outlookCalendarUrl(event))}
              />
            ))}
            {state.sourceNotes && (
              <p className="text-xs italic text-muted-foreground">
                note from Claude: {state.sourceNotes}
              </p>
            )}
            <Button onClick={reset} variant="outline" className="w-fit">
              Upload another
            </Button>
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
