import { Clock } from 'lucide-react';
import type { LeaveByInfo } from '@/lib/leave-by';
import { cn } from '@/lib/utils';

export interface LeaveByClockProps {
  info: LeaveByInfo;
  className?: string;
}

export function LeaveByClock({ info, className }: LeaveByClockProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3 ring-1 ring-inset ring-primary/20',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Clock aria-hidden size={20} className="shrink-0" />
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">leave by</div>
          <div className="text-2xl font-bold tracking-tight leading-none">{info.displayText}</div>
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <div>{info.walkMinutes}-min walk</div>
      </div>
    </div>
  );
}
