import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface GoldyBubbleProps {
  children: ReactNode;
  tone?: 'gold' | 'maroon';
  tail?: 'left' | 'right' | 'none';
  avatar?: boolean;
  className?: string;
}

const TONE_STYLES: Record<NonNullable<GoldyBubbleProps['tone']>, string> = {
  gold: 'bg-gradient-to-br from-[var(--goldy-gold-400)] to-[var(--goldy-gold-200)] text-[var(--goldy-maroon-700)]',
  maroon: 'bg-gradient-to-br from-[var(--goldy-maroon-500)] to-[var(--goldy-maroon-700)] text-white',
};

const TAIL_TONE: Record<NonNullable<GoldyBubbleProps['tone']>, string> = {
  gold: 'var(--goldy-gold-400)',
  maroon: 'var(--goldy-maroon-500)',
};

export function GoldyBubble({
  children,
  tone = 'gold',
  tail = 'left',
  avatar = false,
  className,
}: GoldyBubbleProps) {
  const tailColor = TAIL_TONE[tone];
  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-3 rounded-2xl px-4 py-3 font-medium shadow-sm',
        TONE_STYLES[tone],
        className,
      )}
      style={
        tail === 'left'
          ? ({
              ['--bubble-tail' as const]: tailColor,
            } as CSSProperties)
          : undefined
      }
    >
      {tail === 'left' && (
        <span
          aria-hidden
          className="absolute -left-2.5 top-4 block h-0 w-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: `12px solid ${tailColor}`,
          }}
        />
      )}
      {tail === 'right' && (
        <span
          aria-hidden
          className="absolute -right-2.5 top-4 block h-0 w-0"
          style={{
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: `12px solid ${tailColor}`,
          }}
        />
      )}
      {avatar && (
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white/60 text-lg shadow-inner"
        >
          G
        </span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
