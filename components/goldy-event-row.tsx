'use client';

import type { Event } from '@/lib/schema';
import type { GoldyContext } from '@/lib/goldy-commentary';
import { useSwipeReveal } from '@/lib/use-swipe-reveal';
import { resolveSignupChip } from '@/lib/resolve-signup-chip';
import { CalendarPlus, ExternalLink, QrCode } from 'lucide-react';

// Compact horizontal list-item. Replaces the stacked thick-card look
// on /feed's "rest of the week" list. Left column is day + time,
// center is title + context, right is match % or action.
//
// Design: flat paper card, 1px hairline border, 12:1 body contrast.
// Conflict tint is a muted alert-red border + tinted time label.
//
// Swipe-to-act: drag the row right to add to calendar, left to hide.
// Both gestures fire the same callbacks the trailing buttons do —
// pure accelerator, never a replacement (Mail/Gmail pattern).
// `useSwipeReveal` cancels the gesture when vertical scroll dominates.

type Props = {
  event: Event;
  ctx: GoldyContext;
  duplicateLabel?: string | null;
  onClick?: () => void;
  onHide?: () => void;
};

const SWIPE_THRESHOLD = 80;

function dayAbbrev(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function timeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h >= 12 ? 'pm' : 'am';
  if (m === 0) return `${h12}${ampm}`;
  return `${h12}:${m.toString().padStart(2, '0')}`;
}

export function GoldyEventRow({
  event,
  ctx,
  duplicateLabel,
  onClick,
  onHide,
}: Props) {
  const isConflict = ctx.bucket === 'conflict';
  const isUrgent = ctx.bucket === 'urgent';
  const isTopPick = ctx.bucket === 'top-pick-gameday';
  const signupChip = resolveSignupChip(event);

  const { ref: swipeRef, dx, isDragging } = useSwipeReveal<HTMLElement>({
    onSwipeRight: onClick,
    onSwipeLeft: onHide,
    threshold: SWIPE_THRESHOLD,
  });

  const borderColor = isConflict
    ? 'rgba(179, 58, 43, 0.28)'
    : isUrgent
      ? 'var(--goldy-maroon-500)'
      : 'var(--border)';
  const timeColor = isConflict
    ? '#B33A2B'
    : isUrgent
      ? 'var(--goldy-maroon-500)'
      : isTopPick
        ? 'var(--goldy-maroon-500)'
        : 'var(--muted-foreground)';

  // Reveal opacity scales with swipe distance — gives the user a
  // visual confirmation that the gesture is being interpreted.
  const addRevealActive = dx > 6;
  const addRevealOpacity = Math.min(1, Math.max(0, dx / SWIPE_THRESHOLD));
  const hideRevealActive = dx < -6;
  const hideRevealOpacity = Math.min(1, Math.max(0, -dx / SWIPE_THRESHOLD));
  const addCommitted = dx >= SWIPE_THRESHOLD;
  const hideCommitted = dx <= -SWIPE_THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Reveal layer — left side ("Add") and right side ("Hide"). */}
      <div
        className="pointer-events-none absolute inset-0 flex items-stretch"
        aria-hidden="true"
      >
        {/* Add reveal — appears under the swiping row when dragged right. */}
        <div
          className="flex flex-1 items-center px-4 text-sm font-bold"
          style={{
            background: addCommitted
              ? 'var(--goldy-maroon-500)'
              : 'var(--goldy-maroon-50)',
            color: addCommitted ? 'white' : 'var(--goldy-maroon-700)',
            opacity: addRevealActive ? addRevealOpacity : 0,
            transition: isDragging ? 'none' : 'opacity 180ms ease-out',
          }}
        >
          <CalendarPlus aria-hidden size={16} className="mr-2 shrink-0" />
          {addCommitted ? 'Release to add' : 'Add'}
        </div>
        {/* Hide reveal — appears under the swiping row when dragged left. */}
        <div
          className="flex flex-1 items-center justify-end px-4 text-sm font-bold"
          style={{
            background: hideCommitted ? '#B33A2B' : '#FBEEEC',
            color: hideCommitted ? 'white' : '#9C2C20',
            opacity: hideRevealActive ? hideRevealOpacity : 0,
            transition: isDragging ? 'none' : 'opacity 180ms ease-out',
          }}
        >
          {hideCommitted ? 'Release to hide' : 'Hide'}
          <span aria-hidden className="ml-2 text-base">✕</span>
        </div>
      </div>

      <article
        ref={(el) => swipeRef(el as unknown as HTMLElement)}
        className="relative flex items-center gap-3 rounded-2xl border px-4 py-3"
        style={{
          background: 'var(--surface-paper)',
          borderColor,
          transform: `translateX(${dx}px)`,
          // touch-action pan-y lets the page scroll vertically while we
          // intercept horizontal swipes. Critical: without this,
          // pointermove never fires on touch because the browser owns
          // the gesture.
          touchAction: 'pan-y',
          transition: isDragging ? 'none' : 'transform 220ms ease-out',
        }}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex flex-1 items-center gap-3 text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            // @ts-expect-error - custom property for focus ring
            '--tw-ring-color': 'var(--goldy-gold-400)',
          }}
        >
          <div
            className="w-12 shrink-0 text-xs leading-tight"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {dayAbbrev(event.start)}
            <br />
            <span className="font-semibold" style={{ color: timeColor }}>
              {timeShort(event.start)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {event.title}
            </div>
            <div
              className="truncate text-xs"
              style={{ color: isConflict ? '#B33A2B' : 'var(--muted-foreground)' }}
            >
              {isConflict
                ? `overlaps ${ctx.slots.conflictTitle ?? 'a busy slot'}`
                : (event.location ?? 'unlisted location')}
            </div>
            {duplicateLabel && (
              <div
                className="mt-0.5 text-[10px] font-semibold"
                style={{ color: 'var(--goldy-maroon-500)' }}
              >
                ↔ {duplicateLabel}
              </div>
            )}
          </div>
        </button>

        {signupChip.kind === 'link' && (
          <a
            href={signupChip.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open signup link in new tab"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold"
            style={{
              background: 'var(--goldy-gold-50)',
              borderColor: 'var(--goldy-gold-300)',
              color: 'var(--goldy-maroon-700)',
              minHeight: 32,
            }}
          >
            <ExternalLink aria-hidden size={10} />
            Sign up
          </a>
        )}
        {signupChip.kind === 'fallback' && (
          <span
            role="note"
            aria-label="This flyer has a QR code. Open the original flyer on your phone and scan the QR code with your camera app."
            className="shrink-0 inline-flex cursor-default select-none items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[10px] font-medium"
            style={{
              background: 'transparent',
              borderColor: 'currentColor',
              color: 'var(--muted-foreground)',
              minHeight: 32,
            }}
          >
            <QrCode aria-hidden size={10} />
            QR — scan flyer
          </span>
        )}

        {onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label={`Hide ${event.title}`}
            className="shrink-0 rounded-full px-2 py-1 text-xs"
            style={{ color: 'var(--muted-foreground)' }}
          >
            ✕
          </button>
        )}
      </article>
    </div>
  );
}
