import type { Noticing, NoticingTone } from '@/lib/noticings';
import type { ChipPriority } from '@/lib/chip-ranking';
import { cn } from '@/lib/utils';

export interface NoticingChipProps {
  noticing: Noticing;
  priority?: ChipPriority;
  className?: string;
}

const NOTICING_STYLES: Record<NoticingTone, string> = {
  info: 'bg-muted/60 text-foreground/80 ring-border',
  'heads-up': 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400',
  delight: 'bg-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-400',
};

// Priority chip style mirrors the match-% badge's visual weight so the
// top chip reads as "this is the reason" at the same glance. Intentional
// that empty-interest users never see this style (see lib/chip-ranking.ts
// AC-7) — keeps the profile interview the anchor for interest-aware UX.
// Outset ring (not inset) so the gold border pops against the gold fill
// rather than blending into it. Visual weight matches the match-% badge.
const PRIORITY_STYLE =
  'bg-[var(--goldy-gold-400)] text-[var(--goldy-maroon-700)] ring-2 ring-[var(--goldy-gold-500)] font-semibold';

export function NoticingChip({ noticing, priority = 'secondary', className }: NoticingChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        priority === 'priority' ? PRIORITY_STYLE : NOTICING_STYLES[noticing.tone],
        className,
      )}
    >
      <span aria-hidden>{noticing.icon}</span>
      <span>{noticing.text}</span>
    </span>
  );
}
