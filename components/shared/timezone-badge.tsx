'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimezoneBadgeProps {
  timezone: string;
  className?: string;
}

function shortName(tz: string): string {
  const slash = tz.lastIndexOf('/');
  return slash >= 0 ? tz.slice(slash + 1).replace(/_/g, ' ') : tz;
}

export function TimezoneBadge({ timezone, className }: TimezoneBadgeProps) {
  const [browserTz, setBrowserTz] = useState<string | null>(null);

  useEffect(() => {
    try {
      setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setBrowserTz(null);
    }
  }, []);

  const mismatch = browserTz !== null && browserTz !== timezone;
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold',
        mismatch
          ? 'bg-amber-500/10 text-amber-800'
          : 'bg-muted text-muted-foreground',
        className,
      )}
      title={
        mismatch
          ? `Event is in ${timezone}; your device is in ${browserTz}`
          : `Event is in ${timezone}`
      }
    >
      <Globe aria-hidden size={10} />
      <span>{shortName(timezone)}</span>
      {mismatch && <span aria-hidden>⚠</span>}
    </span>
  );
}
