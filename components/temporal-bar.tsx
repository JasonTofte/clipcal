'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type TemporalBarProps = {
  start: string;
};

function getTemporalState(startIso: string, now: Date) {
  const startDate = new Date(startIso);
  if (Number.isNaN(startDate.getTime())) return null;

  const hoursUntil = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil < 0) {
    return { label: 'already started', color: 'bg-zinc-400/30', pulse: false };
  }
  if (hoursUntil <= 1) {
    const mins = Math.round(hoursUntil * 60);
    return {
      label: mins <= 1 ? 'starting now' : `in ${mins} min`,
      color: 'bg-amber-500/60',
      pulse: true,
    };
  }
  if (hoursUntil <= 6) {
    return {
      label: `in ${Math.round(hoursUntil)} hours`,
      color: 'bg-amber-400/40',
      pulse: false,
    };
  }
  if (hoursUntil <= 24) {
    return {
      label: `in ${Math.round(hoursUntil)} hours`,
      color: 'bg-sky-400/30',
      pulse: false,
    };
  }
  if (hoursUntil <= 72) {
    const days = Math.round(hoursUntil / 24);
    return {
      label: `in ${days} day${days === 1 ? '' : 's'}`,
      color: 'bg-sky-300/20',
      pulse: false,
    };
  }
  const days = Math.round(hoursUntil / 24);
  return {
    label: `in ${days} days`,
    color: 'bg-zinc-300/15',
    pulse: false,
  };
}

export function TemporalBar({ start }: TemporalBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const state = getTemporalState(start, now);
  if (!state) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-1.5 flex-1 rounded-full transition-colors duration-700',
          state.color,
          state.pulse && 'animate-pulse',
        )}
      />
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
        {state.label}
      </span>
    </div>
  );
}
