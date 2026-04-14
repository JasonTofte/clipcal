'use client';

import { Moon } from 'lucide-react';
import { useCalmMode } from '@/lib/calm-mode';

type Props = {
  compact?: boolean;
};

export function CalmModeToggle({ compact = false }: Props) {
  const { calmMode, setCalmMode } = useCalmMode();

  const label = compact ? 'Calm' : 'Calm mode';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={calmMode}
      aria-label={label}
      onClick={() => setCalmMode(!calmMode)}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--goldy-maroon-500)]"
      style={{
        minHeight: 44,
        color: calmMode ? 'var(--goldy-maroon-600)' : 'var(--muted-foreground)',
      }}
    >
      {!compact && <Moon aria-hidden size={14} />}
      <span>{label}</span>
      <span
        className="relative inline-block h-5 w-9 rounded-full"
        style={{
          background: calmMode ? 'var(--goldy-maroon-500)' : 'var(--border)',
          transition: 'background-color 180ms ease-out',
        }}
        aria-hidden
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
          style={{
            left: calmMode ? 'calc(100% - 18px)' : '2px',
            transition: 'left 180ms ease-out',
          }}
        />
      </span>
    </button>
  );
}
