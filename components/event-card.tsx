'use client';

import { useState, type ReactNode } from 'react';
import { CalendarPlus, GraduationCap, Building2, Utensils, MapPin, Users, Shirt, DoorOpen, ExternalLink } from 'lucide-react';
import type { Event } from '@/lib/schema';
import type { ConflictResult } from '@/lib/conflict';
import type { LeaveByInfo } from '@/lib/leave-by';
import type { Noticing } from '@/lib/noticings';
import { rankChips } from '@/lib/chip-ranking';
import type { RelevanceScore } from '@/lib/relevance';
import { formatScoreBadge, scoreTone } from '@/lib/relevance';
import type { CampusMatch } from '@/app/api/campus-match/route';
import type { OrgMatch } from '@/app/api/campus-orgs/route';
import type { BusySlot } from '@/lib/demo-calendar';
import { TemporalBar } from '@/components/temporal-bar';
import { formatTimeRange, toDatetimeLocal, fromDatetimeLocal } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ConflictBadge, LeaveByClock, NoticingChip } from '@/components/shared';
import { cn } from '@/lib/utils';

type EventCardProps = {
  event: Event;
  conflict: ConflictResult | null;
  relevance: RelevanceScore | null;
  campusMatch: CampusMatch | null;
  orgMatch: OrgMatch | null;
  noticings: Noticing[];
  interests?: string[] | null;
  leaveBy: LeaveByInfo | null;
  busySlots?: BusySlot[];
  readOnly?: boolean;
  posterSrc?: string | null;
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


function formatTime12h(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const inputCls =
  'w-full bg-transparent outline-none rounded-sm focus:ring-2 focus:ring-ring/40 focus:bg-muted/30 hover:bg-muted/20 transition-colors px-1 -mx-1';

export function EventCard({
  event,
  conflict,
  relevance,
  campusMatch,
  orgMatch,
  noticings,
  interests,
  leaveBy,
  busySlots,
  readOnly = false,
  posterSrc,
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
    <div className="flex overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm">
      {/* Poster image — left panel */}
      {posterSrc ? (
        <img
          src={posterSrc}
          alt="Uploaded flyer"
          className="w-2/5 shrink-0 object-cover self-stretch"
          style={{ minHeight: 180 }}
        />
      ) : (
        <div
          className="w-2/5 shrink-0 self-stretch"
          style={{
            minHeight: 180,
            background: 'linear-gradient(160deg, var(--goldy-maroon-500) 0%, var(--goldy-maroon-700) 100%)',
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center opacity-30">
            <div className="text-3xl font-black text-white">EVENT</div>
            <div className="h-px w-8 bg-white" />
            <div className="text-xs font-semibold uppercase tracking-widest text-white">Flyer</div>
          </div>
        </div>
      )}

      {/* Info panel — right side */}
      <div className="flex flex-1 flex-col gap-3 p-4 min-w-0">
      {(conflict || relevance || orgMatch) && (
        <div className="flex flex-wrap gap-1.5">
          {conflict && <ConflictBadge conflict={conflict} />}
          {relevance && <RelevanceBadge relevance={relevance} />}
          {orgMatch && <OrgMatchBadge match={orgMatch} />}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
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
            'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium',
            CONFIDENCE_STYLES[event.confidence],
          )}
        >
          {event.confidence}
        </span>
      </div>

      <TemporalBar start={event.start} />

      {leaveBy && <LeaveByClock info={leaveBy} />}

      <WhenField
        start={event.start}
        end={event.end}
        readOnly={!!readOnly}
        busySlots={busySlots}
        onChangeStart={(v) => patch('start', v)}
        onChangeEnd={(v) => patch('end', v)}
        inputCls={inputCls}
      />

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
        <span className="inline-flex h-5 items-center rounded-full bg-muted/60 px-2 text-xs font-medium capitalize">
          {event.category}
        </span>
        {event.hasFreeFood && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-500/10 px-2 text-xs font-medium text-amber-700 ring-amber-500/30 dark:text-amber-400">
            <Utensils aria-hidden size={10} /> free food
          </span>
        )}
        {event.venueSetting && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-teal-500/10 px-2 text-xs font-medium text-teal-700 ring-teal-500/30 dark:text-teal-400">
            <MapPin aria-hidden size={10} /> {event.venueSetting}
          </span>
        )}
        {event.crowdSize && (
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-teal-500/10 px-2 text-xs font-medium text-teal-700 ring-teal-500/30 dark:text-teal-400">
            <Users aria-hidden size={10} /> ~{event.crowdSize === 'small' ? '<30' : event.crowdSize === 'medium' ? '30-100' : '100+'}
          </span>
        )}
        {event.dressCode && (
          <span
            className="inline-flex h-5 items-center gap-1 rounded-full bg-violet-500/10 px-2 text-xs font-medium text-violet-700 ring-violet-500/30 dark:text-violet-400"
            title={`Dress code: ${event.dressCode}`}
          >
            <Shirt aria-hidden size={10} /> {event.dressCode}
          </span>
        )}
        {event.room && (
          <span
            className="inline-flex h-5 items-center gap-1 rounded-full bg-sky-500/10 px-2 text-xs font-medium text-sky-700 ring-sky-500/30 dark:text-sky-400"
            title={event.room}
          >
            <DoorOpen aria-hidden size={10} /> {event.room}
          </span>
        )}
      </div>

      {noticings.length > 0 && (() => {
        const ranked = rankChips(noticings, interests ?? []);
        return (
          <div className="space-y-2 pt-3">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">worth noticing</div>
            <div className="flex flex-wrap gap-1.5">
              {ranked.map((r) => (
                <NoticingChip key={r.rankKey} noticing={r} priority={r.priority} />
              ))}
            </div>
          </div>
        );
      })()}

      {campusMatch && <CampusMatchBadge match={campusMatch} />}

      <div className="-mx-1 flex flex-col gap-2 pt-3">
        <Button size="default" variant="default" onClick={onDownloadIcs} className="w-full">
          <CalendarPlus aria-hidden size={15} /> Add to Calendar
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onOpenGoogle} className="flex-1">
            Google
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenOutlook} className="flex-1">
            Outlook
          </Button>
        </div>
      </div>
      </div> {/* end info panel */}
    </div>
  );
}

function RelevanceBadge({ relevance }: { relevance: RelevanceScore }) {
  const tone = scoreTone(relevance.score);
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
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
      className="flex items-center gap-1.5 rounded-md bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 ring-violet-500/30 transition-colors hover:bg-violet-500/20 dark:text-violet-400"
    >
      <GraduationCap aria-hidden size={14} />
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
  const isFree = match.cost?.toLowerCase() === 'free';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <a
        href={match.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-400"
      >
        <Building2 aria-hidden size={12} />
        Also on UMN Events Calendar →
      </a>
      {isFree && (
        <span className="text-emerald-600 dark:text-emerald-400">Free</span>
      )}
      {match.has_registration && (
        <a
          href={match.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:underline dark:text-sky-400"
        >
          RSVP
        </a>
      )}
      {match.event_types.slice(0, 3).map((t) => (
        <span
          key={t}
          className="inline-flex h-4 items-center rounded-full bg-sky-500/10 px-1.5 text-[10px] text-sky-600 dark:text-sky-400"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function WhenField({
  start,
  end,
  readOnly,
  busySlots,
  onChangeStart,
  onChangeEnd,
  inputCls,
}: {
  start: string;
  end: string | null;
  readOnly: boolean;
  busySlots?: BusySlot[];
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string | null) => void;
  inputCls: string;
}) {
  const [editing, setEditing] = useState(false);
  const { dateLabel, timeLabel, durationLabel } = formatTimeRange(start, end);

  let dayContext: string | null = null;
  if (busySlots && busySlots.length > 0) {
    const s = new Date(start);
    if (!Number.isNaN(s.getTime())) {
      const dayStart = new Date(s);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = busySlots.filter((b) => b.start < dayEnd && b.end > dayStart).length;
      if (count === 1) dayContext = '1 other event on your calendar that day';
      else if (count > 1) dayContext = `${count} other events on your calendar that day`;
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {dateLabel}
            <span className="mx-1.5 text-muted-foreground">·</span>
            {timeLabel || <span className="text-muted-foreground">time TBD</span>}
          </div>
          {(durationLabel || dayContext) && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {durationLabel}
              {durationLabel && dayContext && <span className="mx-1.5">·</span>}
              {dayContext}
            </div>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="shrink-0 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {editing ? 'done' : 'edit'}
          </button>
        )}
      </div>

      {!readOnly && editing && (
        <div className="grid grid-cols-2 gap-2">
          <LabeledField label="start">
            <input
              type="datetime-local"
              value={toDatetimeLocal(start)}
              onChange={(e) => onChangeStart(fromDatetimeLocal(e.target.value))}
              className={cn(inputCls, 'text-xs')}
            />
          </LabeledField>
          <LabeledField label="end">
            <input
              type="datetime-local"
              value={end ? toDatetimeLocal(end) : ''}
              onChange={(e) =>
                onChangeEnd(e.target.value ? fromDatetimeLocal(e.target.value) : null)
              }
              className={cn(inputCls, 'text-xs')}
            />
          </LabeledField>
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
