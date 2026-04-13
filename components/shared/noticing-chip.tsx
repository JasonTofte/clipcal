import type { Noticing, NoticingTone } from '@/lib/noticings';
import { cn } from '@/lib/utils';

export interface NoticingChipProps {
  noticing: Noticing;
  className?: string;
}

const NOTICING_STYLES: Record<NoticingTone, string> = {
  info: 'bg-muted/60 text-foreground/80 ring-border',
  'heads-up': 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400',
  delight: 'bg-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-400',
};

export function NoticingChip({ noticing, className }: NoticingChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        NOTICING_STYLES[noticing.tone],
        className,
      )}
    >
      <span aria-hidden>{noticing.icon}</span>
      <span>{noticing.text}</span>
    </span>
  );
}
