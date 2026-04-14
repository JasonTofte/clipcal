'use client';

import { useEffect, useRef, useState } from 'react';
import { CalmModeToggle } from '@/components/calm-mode-toggle';
import { EinkSyncButton } from '@/components/eink-sync-button';
import type { Event } from '@/lib/schema';

type Props = {
  events: Event[];
};

// Collapses low-frequency toggles (Calm mode, e-ink sync) behind a single
// "⋯" affordance so the feed header isn't a toggle-graveyard. Per-session
// placement rubric: frequency 1-2, so overflow is the right tier.
export function FeedOverflowMenu({ events }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the panel so keyboard users don't have to Tab
    // from the trigger through the page to reach the menu contents.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button, [role="switch"], [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();

    const onDocMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 place-items-center rounded-full text-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
        style={{ color: 'var(--muted-foreground)' }}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={panelRef}
          aria-label="Display settings"
          className="absolute right-0 z-40 mt-1 flex w-64 flex-col gap-2 rounded-2xl border p-3 shadow-xl"
          style={{
            background: 'var(--surface-paper)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              Display
            </span>
            <CalmModeToggle compact />
          </div>
          <div className="px-1">
            <EinkSyncButton events={events} />
          </div>
        </div>
      )}
    </div>
  );
}
