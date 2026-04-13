import type { Event } from '@/lib/schema';
import { GoldyAvatar } from '@/components/goldy-avatar';

type Props = {
  event: Event;
  goldyLine: string;
  matchPct?: number | null;
  isTopPick?: boolean;
  onAddToCalendar: () => void;
  onOpenMenu?: () => void;
};

function formatWhen(event: Event): string {
  const d = new Date(event.start);
  if (Number.isNaN(d.getTime())) return event.start;
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function flyerClass(event: Event): string {
  const t = event.title.toLowerCase();
  if (event.category === 'sports' || /stadium|gophers|axe/.test(t)) return 'flyer-game';
  if (event.category === 'hackathon' || t.includes('hack')) return 'flyer-hack';
  if (event.hasFreeFood || /pizza|taco|donut|food/.test(t)) return 'flyer-pizza';
  if (event.category === 'career' || event.category === 'networking') return 'flyer-career';
  if (event.category === 'culture' || event.category === 'social') return 'flyer-fest';
  return 'flyer-default';
}

export function GoldyEventCard({
  event,
  goldyLine,
  matchPct,
  isTopPick = false,
  onAddToCalendar,
  onOpenMenu,
}: Props) {
  const flyer = flyerClass(event);
  const onPizza = flyer === 'flyer-pizza';

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
          className="flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{
            background:
              'linear-gradient(to right, var(--goldy-maroon-500), var(--goldy-maroon-500), var(--goldy-gold-400))',
          }}
        >
          <span>🏆 Goldy&apos;s top pick · Ski-U-Mah!</span>
          {typeof matchPct === 'number' && (
            <span style={{ color: 'var(--goldy-gold-300)' }}>{matchPct}% match</span>
          )}
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
                {formatWhen(event)}
                {event.location ? ` · ${event.location}` : ''}
              </p>
            </div>
            {!isTopPick && typeof matchPct === 'number' && (
              <div className="shrink-0 text-right">
                <div
                  className="text-sm font-bold"
                  style={{ color: 'var(--goldy-maroon-500)' }}
                >
                  {matchPct}%
                </div>
              </div>
            )}
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
          </div>

          <div className="mt-3 flex gap-1.5">
            <button
              type="button"
              onClick={onAddToCalendar}
              className="min-h-[44px] flex-1 rounded-full py-2 text-xs font-bold"
              style={{
                background: 'var(--goldy-maroon-500)',
                color: 'var(--goldy-gold-400)',
              }}
            >
              📅 Add to Calendar
            </button>
            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                aria-label="More options"
                className="min-h-[44px] min-w-[44px] rounded-full bg-stone-100 px-3 py-2 text-xs text-stone-700"
              >
                ⋯
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
