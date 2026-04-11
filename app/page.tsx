'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dropzone } from '@/components/dropzone';
import { EventCard } from '@/components/event-card';
import { Button } from '@/components/ui/button';
import type { Event, Extraction } from '@/lib/schema';

type UxState =
  | { status: 'idle' }
  | { status: 'loading'; message: string }
  | { status: 'success'; events: Event[]; sourceNotes: string | null }
  | { status: 'error'; message: string };

const LOADING_MESSAGE = 'Claude is reading your flyer…';

export default function Home() {
  const [state, setState] = useState<UxState>({ status: 'idle' });

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    // Single-flyer upload for Session 2. Multi-flyer batch is deferred.
    const file = files[0];
    setState({ status: 'loading', message: LOADING_MESSAGE });

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/extract', { method: 'POST', body: formData });
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const errMsg =
          typeof json === 'object' && json !== null && 'error' in json && typeof (json as { error: unknown }).error === 'string'
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
      // Don't hijack paste while the user is editing a field.
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

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">ClipCal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your campus copilot. Snap a flyer, know if you should go.
        </p>
      </header>

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
              {/* Session 3 wires up the actual "add all" → .ics download */}
              <Button size="sm" variant="default" disabled>
                + Add all
              </Button>
            </div>
          )}
          {state.events.map((event, idx) => (
            <EventCard
              key={idx}
              event={event}
              onChange={(updated) => updateEvent(idx, updated)}
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
