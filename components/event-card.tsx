'use client';

import type { ReactNode } from 'react';
import type { Event } from '@/lib/schema';
import type { ConflictResult } from '@/lib/conflict';
import type { RelevanceScore } from '@/lib/relevance';
import { formatScoreBadge, scoreTone } from '@/lib/relevance';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EventCardProps = {
  event: Event;
  conflict: ConflictResult | null;
  relevance: RelevanceScore | null;
  onChange: (updated: Event) => void;
  onDownloadIcs: () => void;
  onOpenGoogle: () => void;
  onOpenOutlook: () => void;
};

const RELEVANCE_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-400',
  medium: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-400',
  low: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-400',
};

const CONFIDENCE_STYLES: Record<Event['confidence'], string> = {
  high: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400',
  medium: 'bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-400',
  low: 'bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-400',
};

const CATEGORY_EMOJI: Record<Event['category'], string> = {
  workshop: '🛠️',
  networking: '🤝',
  social: '🎉',
  cs: '💻',
  career: '💼',
  culture: '🎭',
  sports: '⚽',
  hackathon: '⚡',
  other: '📌',
};

const inputCls =
  'w-full bg-transparent outline-none rounded-sm focus:ring-2 focus:ring-ring/40 focus:bg-muted/30 hover:bg-muted/20 transition-colors px-1 -mx-1';

export function EventCard({
  event,
  conflict,
  relevance,
  onChange,
  onDownloadIcs,
  onOpenGoogle,
  onOpenOutlook,
}: EventCardProps) {
  const patch = <K extends keyof Event>(key: K, value: Event[K]) =>
    onChange({ ...event, [key]: value });

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
      {(conflict || relevance) && (
        <div className="flex flex-wrap gap-1.5">
          {conflict && <ConflictBadge conflict={conflict} />}
          {relevance && <RelevanceBadge relevance={relevance} />}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xl" aria-hidden>
            {CATEGORY_EMOJI[event.category]}
          </span>
          <input
            value={event.title}
            onChange={(e) => patch('title', e.target.value)}
            className={cn(inputCls, 'font-heading text-base font-medium')}
            aria-label="Event title"
          />
        </div>
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset',
            CONFIDENCE_STYLES[event.confidence],
          )}
        >
          {event.confidence}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="start">
          <input
            value={event.start}
            onChange={(e) => patch('start', e.target.value)}
            className={cn(inputCls, 'font-mono text-xs')}
          />
        </LabeledField>
        <LabeledField label="end">
          <input
            value={event.end ?? ''}
            placeholder="—"
            onChange={(e) => patch('end', e.target.value || null)}
            className={cn(inputCls, 'font-mono text-xs')}
          />
        </LabeledField>
      </div>

      <LabeledField label="location">
        <input
          value={event.location ?? ''}
          placeholder="—"
          onChange={(e) => patch('location', e.target.value || null)}
          className={cn(inputCls, 'text-sm')}
        />
      </LabeledField>

      <LabeledField label="description">
        <textarea
          value={event.description ?? ''}
          placeholder="—"
          onChange={(e) => patch('description', e.target.value || null)}
          rows={2}
          className={cn(inputCls, 'resize-y text-sm')}
        />
      </LabeledField>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-5 items-center rounded-full border border-border px-2 text-xs font-medium capitalize">
          {event.category}
        </span>
        {event.hasFreeFood && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400">
            🍕 free food
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
          {event.timezone}
        </span>
      </div>

      <div className="-mx-1 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button size="sm" variant="default" onClick={onDownloadIcs}>
          📅 Add to Calendar
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenGoogle}>
          Google
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenOutlook}>
          Outlook
        </Button>
      </div>
    </div>
  );
}

function RelevanceBadge({ relevance }: { relevance: RelevanceScore }) {
  const tone = scoreTone(relevance.score);
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset',
        RELEVANCE_STYLES[tone],
      )}
      title={relevance.reason}
    >
      <span className="font-semibold">{formatScoreBadge(relevance.score)}</span>
      <span className="opacity-80">match</span>
      <span className="hidden sm:inline opacity-60">· {relevance.reason}</span>
    </div>
  );
}

function ConflictBadge({ conflict }: { conflict: ConflictResult }) {
  if (conflict.status === 'free') {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
        <span aria-hidden>✓</span>
        <span>you&rsquo;re free</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-500/30 dark:text-rose-400">
      <span aria-hidden>⚠</span>
      <span>
        overlaps <span className="font-semibold">{conflict.conflictTitle}</span>
      </span>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
