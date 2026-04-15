'use client';

import { useEffect, useRef } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import type { Event } from '@/lib/schema';
import { formatEventWhen } from '@/lib/format';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { triggerIcsDownload } from '@/lib/ics';

type Props = {
  event: Event;
  onClose: () => void;
  onToggleStar?: () => void;
};

export function SavedDetailModal({ event, onClose, onToggleStar }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // iOS Safari background-scroll lock. `overflow: hidden` on body is a
    // no-op on iOS — `position: fixed` + a top offset is the standard
    // workaround. Capture prior style values so nested modals / other
    // scroll locks don't lose their state on cleanup.
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    // Move focus into the dialog so keyboard + screen reader users land
    // inside on open. Restored to prior element on unmount.
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  // Simple focus trap: keep Tab / Shift+Tab inside the panel. Prevents
  // keyboard + screen reader users from reaching the obscured page behind
  // the backdrop while the modal is open.
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = panelRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const isStarred = !!event.starred;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-detail-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(26, 18, 16, 0.55)', backdropFilter: 'blur(4px)' }}
      />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        style={{
          background: 'var(--surface-paper)',
          maxHeight: '90vh',
          boxShadow: '0 -8px 40px -12px rgba(26, 18, 16, 0.4)',
        }}
      >
        {/* Favorite ribbon (visual only — button below handles toggle) */}
        {isStarred && (
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: '18px',
              right: '-44px',
              transform: 'rotate(38deg)',
              background: 'var(--goldy-gold-500)',
              color: 'var(--goldy-maroon-700)',
              padding: '4px 48px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.14em',
              boxShadow: '0 2px 6px -1px rgba(230, 180, 34, 0.45)',
              zIndex: 1,
            }}
          >
            ★ FAVORITE
          </div>
        )}

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted/60 active:scale-[0.96]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X size={20} aria-hidden />
        </button>

        <div className="overflow-y-auto px-6 pb-6 pt-16">
          <div
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {event.category}
          </div>

          <h2
            id="saved-detail-title"
            className="mt-2 text-2xl font-bold leading-tight"
            style={{ color: 'var(--foreground)' }}
          >
            {event.title}
          </h2>

          <p
            className="mt-3 text-base font-semibold"
            style={{ color: 'var(--goldy-maroon-600)' }}
          >
            {formatEventWhen(event.start)}
          </p>

          {event.location && (
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {event.location}
            </p>
          )}

          {event.description && (
            <p
              className="mt-4 whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: 'var(--foreground)' }}
            >
              {event.description}
            </p>
          )}

          {/* Tag row */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {event.hasFreeFood && (
              <span className="inline-flex h-6 items-center rounded-full bg-amber-500/10 px-2.5 text-xs font-medium text-amber-700">
                free food
              </span>
            )}
            {event.room && (
              <span className="inline-flex h-6 items-center rounded-full bg-sky-500/10 px-2.5 text-xs font-medium text-sky-700">
                {event.room}
              </span>
            )}
            {event.dressCode && (
              <span className="inline-flex h-6 items-center rounded-full bg-violet-500/10 px-2.5 text-xs font-medium text-violet-700">
                {event.dressCode}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-2">
            {onToggleStar && (
              <button
                type="button"
                onClick={onToggleStar}
                aria-pressed={isStarred}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition-colors"
                style={{
                  background: isStarred ? 'rgba(251, 191, 36, 0.12)' : 'var(--surface-paper)',
                  color: isStarred ? 'var(--goldy-maroon-700)' : 'var(--foreground)',
                  borderColor: isStarred ? 'var(--goldy-gold-500)' : 'var(--border)',
                }}
              >
                <span style={{ color: isStarred ? 'var(--goldy-gold-500)' : 'var(--muted-foreground)' }}>
                  {isStarred ? '★' : '☆'}
                </span>
                {isStarred ? 'Favorited' : 'Mark as favorite'}
              </button>
            )}

            <button
              type="button"
              onClick={() => triggerIcsDownload([event])}
              className="press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold"
              style={{
                background: 'var(--goldy-maroon-500)',
                color: 'white',
              }}
            >
              <CalendarPlus size={16} aria-hidden />
              Add to calendar
            </button>

            <div className="flex gap-2">
              <a
                href={googleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center rounded-2xl border py-2.5 text-sm font-semibold"
                style={{
                  background: 'var(--surface-paper)',
                  color: 'var(--muted-foreground)',
                  borderColor: 'var(--border)',
                }}
              >
                Google
              </a>
              <a
                href={outlookCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center rounded-2xl border py-2.5 text-sm font-semibold"
                style={{
                  background: 'var(--surface-paper)',
                  color: 'var(--muted-foreground)',
                  borderColor: 'var(--border)',
                }}
              >
                Outlook
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
