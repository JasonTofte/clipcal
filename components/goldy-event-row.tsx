'use client';

import type { Event } from '@/lib/schema';
import type { GoldyContext } from '@/lib/goldy-commentary';

// Compact horizontal list-item. Replaces the stacked thick-card look
// on /feed's "rest of the week" list. Left column is day + time,
// center is title + context, right is match % or action.
//
// Design: flat paper card, 1px hairline border, 12:1 body contrast.
// Conflict tint is a muted alert-red border + tinted time label.

type Props = {
  event: Event;
  ctx: GoldyContext;
  matchPct?: number | null;
  duplicateLabel?: string | null;
  onClick?: () => void;
  onHide?: () => void;
};

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
  matchPct,
  duplicateLabel,
  onClick,
  onHide,
}: Props) {
  const isConflict = ctx.bucket === 'conflict';
  const isUrgent = ctx.bucket === 'urgent';
  const isTopPick = ctx.bucket === 'top-pick-gameday';

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

  return (
    <article
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        background: 'var(--surface-paper)',
        borderColor,
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

      {typeof matchPct === 'number' && (
        <div
          className={`shrink-0 text-xs ${isTopPick || isUrgent ? 'font-bold' : ''}`}
          style={{
            color:
              isTopPick || isUrgent
                ? 'var(--goldy-maroon-600)'
                : 'var(--muted-foreground)',
          }}
        >
          {matchPct}%
        </div>
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
  );
}
