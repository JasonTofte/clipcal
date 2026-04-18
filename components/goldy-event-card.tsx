'use client';

import { useState } from 'react';
import type { Event } from '@/lib/schema';
import type { GoldyBucket, GoldyContext } from '@/lib/goldy-commentary';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { buildGoldyWhy, bucketLabel } from '@/lib/goldy-why';
import { flyerClass } from '@/lib/flyer-class';
import { formatEventWhen } from '@/lib/format';
import {
  resolveSignupChip,
  SIGNUP_CHIP_LINK_LABEL,
  SIGNUP_CHIP_LINK_ARIA,
  SIGNUP_CHIP_FALLBACK_LABEL,
  SIGNUP_CHIP_FALLBACK_ARIA,
} from '@/lib/resolve-signup-chip';
import { CalendarPlus, ExternalLink, QrCode, Trophy } from 'lucide-react';

type Props = {
  event: Event;
  goldyLine: string;
  isTopPick?: boolean;
  // When present, the event overlaps a known busy slot. Rendering the
  // Add button switches to a two-tap "arm → commit" flow so users don't
  // silently double-book themselves.
  conflictTitle?: string | null;
  // Full bucket + slots context, used to render the expand-on-tap
  // "Why?" panel. Optional for backwards-compat with callers that
  // haven't been wired yet.
  goldyCtx?: GoldyContext;
  // "also on Apr 15" copy when this event has same-title siblings
  // within 7 days. Caller derives via lib/dedupe-events.
  duplicateLabel?: string | null;
  onAddToCalendar: () => void;
  // "Not for me" soft-hide. Wired up from goldy-feed-client with a
  // 5s undo snackbar; card just calls the callback.
  onHide?: () => void;
};

export function GoldyEventCard({
  event,
  goldyLine,
  isTopPick = false,
  conflictTitle,
  goldyCtx,
  duplicateLabel,
  onAddToCalendar,
  onHide,
}: Props) {
  const flyer = flyerClass(event);
  const onPizza = flyer === 'flyer-pizza';
  const hasConflict = !!conflictTitle;
  // When there's a conflict, first tap arms the button; second tap commits.
  const [armed, setArmed] = useState(false);
  // Expand-on-tap for the speech bubble — shows Goldy's reasoning for
  // this card's bucket + event.
  const [whyOpen, setWhyOpen] = useState(false);
  const whyText = goldyCtx ? buildGoldyWhy(event, goldyCtx) : null;
  const bucketLbl = goldyCtx ? bucketLabel(goldyCtx.bucket as GoldyBucket) : null;
  const signupChip = resolveSignupChip(event);

  const handleAddPress = () => {
    if (!hasConflict) {
      onAddToCalendar();
      return;
    }
    if (!armed) {
      setArmed(true);
      return;
    }
    onAddToCalendar();
    setArmed(false);
  };

  return (
    <article
      className="overflow-hidden rounded-3xl bg-white shadow-md"
      style={
        isTopPick
          ? { boxShadow: '0 0 0 2px var(--goldy-gold-400), 0 10px 25px -8px rgba(0,0,0,0.2)' }
          : undefined
      }
    >
      {isTopPick && (
        <div
          className="flex items-center justify-between gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{
            background:
              'linear-gradient(to right, var(--goldy-maroon-500) 0%, var(--goldy-maroon-500) 65%, var(--goldy-maroon-600) 100%)',
          }}
        >
          <Trophy aria-hidden size={12} className="shrink-0" />
          <span className="truncate">Goldy&apos;s top pick · Ski-U-Mah!</span>
        </div>
      )}

      <div className="flex @container">
        <div className={`relative w-24 shrink-0 sm:w-32 ${flyer}`}>
          <div
            className={`absolute inset-0 flex flex-col p-2 ${onPizza ? '' : 'text-white'}`}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-widest"
              style={{ color: onPizza ? 'var(--goldy-maroon-700)' : 'var(--goldy-gold-300)' }}
            >
              {event.category}
            </div>
            <div className="goldy-display mt-1 text-xs font-bold leading-tight line-clamp-3">
              {event.title}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-bold text-stone-900">{event.title}</h3>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatEventWhen(event.start)}
                {event.location ? ` · ${event.location}` : ''}
              </p>
              {duplicateLabel && (
                <span
                  className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: 'var(--goldy-gold-50)',
                    borderColor: 'var(--goldy-gold-200)',
                    color: 'var(--goldy-maroon-700)',
                  }}
                  title="Same-title event detected within a 7-day window"
                >
                  <span aria-hidden>↔</span>
                  Possible duplicate — {duplicateLabel}
                </span>
              )}
            </div>
          </div>

          <div
            className="goldy-bubble mt-2 rounded-xl rounded-tl-sm px-3 py-2 text-[11px] leading-snug text-stone-900"
            role="note"
            aria-label="Goldy's take on this event"
          >
            <span className="inline-flex items-center gap-1">
              <GoldyAvatar size={18} decorative />
              <strong style={{ color: 'var(--goldy-maroon-600)' }}>Goldy:</strong>
            </span>{' '}
            <span>&ldquo;{goldyLine}&rdquo;</span>
            {whyText && (
              <button
                type="button"
                onClick={() => setWhyOpen((v) => !v)}
                aria-expanded={whyOpen}
                aria-controls={`why-${event.start}`}
                className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--goldy-maroon-600)' }}
              >
                {whyOpen ? 'hide why' : 'why?'}
              </button>
            )}
            {whyText && whyOpen && (
              <div
                id={`why-${event.start}`}
                className="mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-snug"
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  borderColor: 'rgba(90,0,19,0.18)',
                  color: 'var(--goldy-maroon-700)',
                }}
              >
                {bucketLbl && (
                  <div
                    className="mb-1 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--goldy-maroon-500)' }}
                  >
                    {bucketLbl}
                  </div>
                )}
                <p>{whyText}</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            {hasConflict && (
              <div
                className="rounded-lg px-2.5 py-1.5 text-[11px]"
                style={{
                  background: 'rgba(225, 29, 72, 0.08)',
                  color: 'rgb(159, 18, 57)',
                  border: '1px solid rgba(225, 29, 72, 0.25)',
                }}
                role="note"
              >
                {armed ? (
                  <>
                    ⚠ Overlaps <strong>{conflictTitle}</strong>. Tap again to add anyway.
                  </>
                ) : (
                  <>
                    ⚠ Overlaps <strong>{conflictTitle}</strong>.
                  </>
                )}
              </div>
            )}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleAddPress}
                aria-label={
                  hasConflict
                    ? armed
                      ? `Confirm adding ${event.title} despite overlap with ${conflictTitle}`
                      : `Add ${event.title} — overlaps ${conflictTitle}`
                    : `Add ${event.title} to calendar`
                }
                className="min-h-[44px] flex-1 rounded-full py-2 text-xs font-bold transition-colors"
                style={
                  hasConflict && !armed
                    ? {
                        background: 'white',
                        color: 'var(--goldy-maroon-600)',
                        border: '2px solid var(--goldy-maroon-500)',
                      }
                    : {
                        background: 'var(--goldy-maroon-500)',
                        color: 'var(--goldy-gold-400)',
                      }
                }
              >
                {hasConflict
                  ? armed
                    ? 'Confirm — add anyway'
                    : 'Add anyway · you decide'
                  : 'Add to Calendar'}
              </button>
              {onHide && (
                <button
                  type="button"
                  onClick={onHide}
                  aria-label={`Not for me — hide ${event.title}`}
                  title="Not for me"
                  className="min-h-[44px] min-w-[44px] rounded-full bg-stone-100 px-3 py-2 text-xs text-stone-700 transition-colors hover:bg-stone-200"
                >
                  ✕
                </button>
              )}
            </div>
            {signupChip.kind === 'link' && (
              <a
                href={signupChip.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SIGNUP_CHIP_LINK_ARIA}
                className="mt-1 inline-flex items-center gap-1 self-start rounded-full border px-3 py-1 text-xs font-semibold"
                style={{
                  background: 'var(--goldy-gold-50)',
                  borderColor: 'var(--goldy-gold-300)',
                  color: 'var(--goldy-maroon-700)',
                  minHeight: 32,
                }}
              >
                <ExternalLink aria-hidden size={12} />
                {SIGNUP_CHIP_LINK_LABEL}
              </a>
            )}
            {signupChip.kind === 'fallback' && (
              <span
                role="note"
                aria-label={SIGNUP_CHIP_FALLBACK_ARIA}
                className="mt-1 inline-flex cursor-default select-none items-center gap-1 self-start whitespace-nowrap rounded-full border border-dashed px-3 py-1 text-xs font-medium"
                style={{
                  background: 'transparent',
                  borderColor: 'currentColor',
                  color: 'var(--muted-foreground)',
                  minHeight: 32,
                }}
              >
                <QrCode aria-hidden size={12} />
                {SIGNUP_CHIP_FALLBACK_LABEL}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
