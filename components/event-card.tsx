'use client';

import { useState, type ReactNode } from 'react';
import type { Event } from '@/lib/schema';
import type { ConflictResult } from '@/lib/conflict';
import type { LeaveByInfo } from '@/lib/leave-by';
import type { Noticing } from '@/lib/noticings';
import type { RelevanceScore } from '@/lib/relevance';
import { formatScoreBadge, scoreTone } from '@/lib/relevance';
import type { CampusMatch } from '@/app/api/campus-match/route';
import type { OrgMatch } from '@/app/api/campus-orgs/route';
import type { BusySlot } from '@/lib/demo-calendar';
import { DayShape } from '@/components/day-shape';
import { TemporalBar } from '@/components/temporal-bar';
import { Button } from '@/components/ui/button';
import { ConflictBadge, LeaveByClock, NoticingChip, TimezoneBadge } from '@/components/shared';
import { cn } from '@/lib/utils';

type EventCardProps = {
  event: Event;
  conflict: ConflictResult | null;
  relevance: RelevanceScore | null;
  campusMatch: CampusMatch | null;
  orgMatch: OrgMatch | null;
  noticings: Noticing[];
  leaveBy: LeaveByInfo | null;
  busySlots?: BusySlot[];
  readOnly?: boolean;
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
  campusMatch,
  orgMatch,
  noticings,
  leaveBy,
  busySlots,
  readOnly = false,
  onChange,
  onDownloadIcs,
  onOpenGoogle,
  onOpenOutlook,
}: EventCardProps) {
  const patch = <K extends keyof Event>(key: K, value: Event[K]) =>
    onChange({ ...event, [key]: value });

  const [descExpanded, setDescExpanded] = useState(false);
  const shouldCollapseDesc = !readOnly && (event.description?.length ?? 0) > 80 && !descExpanded;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10">
      {(conflict || relevance || orgMatch) && (
        <div className="flex flex-wrap gap-1.5">
          {conflict && <ConflictBadge conflict={conflict} />}
          {relevance && <RelevanceBadge relevance={relevance} />}
          {orgMatch && <OrgMatchBadge match={orgMatch} />}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xl" aria-hidden>
            {CATEGORY_EMOJI[event.category]}
          </span>
          <input
            value={event.title}
            readOnly={readOnly}
            onChange={(e) => patch('title', e.target.value)}
            className={cn(inputCls, 'font-heading text-base font-medium', readOnly && 'pointer-events-none')}
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

      <TemporalBar start={event.start} />

      {leaveBy && <LeaveByClock info={leaveBy} />}

      <div className="grid grid-cols-2 gap-3">
        <LabeledField label="start">
          <input
            value={event.start}
            readOnly={readOnly}
            onChange={(e) => patch('start', e.target.value)}
            className={cn(inputCls, 'font-mono text-xs', readOnly && 'pointer-events-none')}
          />
        </LabeledField>
        <LabeledField label="end">
          <input
            value={event.end ?? ''}
            readOnly={readOnly}
            placeholder="—"
            onChange={(e) => patch('end', e.target.value || null)}
            className={cn(inputCls, 'font-mono text-xs', readOnly && 'pointer-events-none')}
          />
        </LabeledField>
      </div>

      <LabeledField label="location">
        <input
          value={event.location ?? ''}
          readOnly={readOnly}
          placeholder="—"
          onChange={(e) => patch('location', e.target.value || null)}
          className={cn(inputCls, 'text-sm', readOnly && 'pointer-events-none')}
        />
      </LabeledField>

      <LabeledField label="description">
        {shouldCollapseDesc ? (
          <button
            type="button"
            onClick={() => setDescExpanded(true)}
            className="text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {event.description!.slice(0, 80)}…{' '}
            <span className="text-xs underline decoration-dotted underline-offset-2">show more</span>
          </button>
        ) : (
          <textarea
            value={event.description ?? ''}
            readOnly={readOnly}
            placeholder="—"
            onChange={(e) => patch('description', e.target.value || null)}
            rows={2}
            className={cn(inputCls, 'resize-y text-sm', readOnly && 'pointer-events-none')}
          />
        )}
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
        {event.venueSetting && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-teal-500/10 px-2 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-500/30 dark:text-teal-400">
            {event.venueSetting === 'outdoor' ? '🌳' : event.venueSetting === 'hybrid' ? '🔄' : '🏢'}{' '}
            {event.venueSetting}
          </span>
        )}
        {event.crowdSize && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-teal-500/10 px-2 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-500/30 dark:text-teal-400">
            👥 ~{event.crowdSize === 'small' ? '<30' : event.crowdSize === 'medium' ? '30-100' : '100+'}
          </span>
        )}
        <TimezoneBadge timezone={event.timezone} className="ml-auto" />
      </div>

      {noticings.length > 0 && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">worth noticing</div>
          <div className="flex flex-wrap gap-1.5">
            {noticings.map((n, i) => (
              <NoticingChip key={i} noticing={n} />
            ))}
          </div>
        </div>
      )}

      {busySlots && busySlots.length > 0 && (
        <DayShape event={event} busySlots={busySlots} />
      )}

      {campusMatch && <CampusMatchBadge match={campusMatch} />}

      <div className="-mx-1 flex flex-col gap-2 border-t border-border/60 pt-3">
        <Button size="default" variant="default" disabled={readOnly} onClick={onDownloadIcs} className="w-full">
          📅 Add to Calendar
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={readOnly} onClick={onOpenGoogle} className="flex-1">
            Google
          </Button>
          <Button size="sm" variant="outline" disabled={readOnly} onClick={onOpenOutlook} className="flex-1">
            Outlook
          </Button>
        </div>
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

function OrgMatchBadge({ match }: { match: OrgMatch }) {
  return (
    <a
      href={match.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-md bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-500/30 transition-colors hover:bg-violet-500/20 dark:text-violet-400"
    >
      <span aria-hidden>🎓</span>
      <span>
        GopherLink
        {match.organizer && (
          <span className="hidden sm:inline opacity-60"> · {match.organizer}</span>
        )}
      </span>
    </a>
  );
}

function CampusMatchBadge({ match }: { match: CampusMatch }) {
  return (
    <div className="rounded-lg bg-sky-500/5 p-3 ring-1 ring-inset ring-sky-500/20">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400">
        <span aria-hidden>🏛️</span>
        <span>Found on UMN Events Calendar</span>
      </div>
      <a
        href={match.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        {match.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {match.group_title && <span>{match.group_title}</span>}
        {match.location && (
          <>
            {match.group_title && <span className="text-border">·</span>}
            <span>{match.location}</span>
          </>
        )}
        {match.cost && (
          <>
            <span className="text-border">·</span>
            <span className={match.cost.toLowerCase() === 'free' ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {match.cost}
            </span>
          </>
        )}
        {match.has_registration && (
          <>
            <span className="text-border">·</span>
            <a
              href={match.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:underline dark:text-sky-400"
            >
              RSVP
            </a>
          </>
        )}
      </div>
      {match.event_types.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {match.event_types.slice(0, 3).map((t) => (
            <span
              key={t}
              className="inline-flex h-4 items-center rounded-full bg-sky-500/10 px-1.5 text-[10px] text-sky-600 dark:text-sky-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
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
