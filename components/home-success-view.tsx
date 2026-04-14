'use client';

import { EventCard } from '@/components/event-card';
import { Button } from '@/components/ui/button';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import type { Event } from '@/lib/schema';
import type { RelevanceScore } from '@/lib/relevance';
import type { CampusMatch } from '@/app/api/campus-match/route';
import type { OrgMatch } from '@/app/api/campus-orgs/route';
import type { ConflictResult } from '@/lib/conflict';
import type { BusySlot } from '@/lib/demo-calendar';
import type { Noticing } from '@/lib/noticings';
import type { LeaveByInfo } from '@/lib/leave-by';

type Props = {
  events: Event[];
  sourceNotes: string | null;
  relevance: RelevanceScore[] | null;
  campusMatches: (CampusMatch | null)[] | null;
  orgMatches: (OrgMatch | null)[] | null;
  conflicts: (ConflictResult | null)[];
  noticingsPerEvent: Noticing[][];
  interests?: string[] | null;
  leaveByPerEvent: (LeaveByInfo | null)[];
  busySlots: BusySlot[];
  canRetryWithSonnet: boolean;
  onUpdateEvent: (idx: number, updated: Event) => void;
  onDownloadIcs: (event: Event) => void;
  onDownloadAll: () => void;
  onReset: () => void;
  onRetryWithSonnet: () => void;
};

function openInNewTab(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function HomeSuccessView({
  events,
  sourceNotes,
  relevance,
  campusMatches,
  orgMatches,
  conflicts,
  noticingsPerEvent,
  interests,
  leaveByPerEvent,
  busySlots,
  canRetryWithSonnet,
  onUpdateEvent,
  onDownloadIcs,
  onDownloadAll,
  onReset,
  onRetryWithSonnet,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      {events.length > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {events.length} events found on this flyer
          </p>
          <Button size="sm" variant="default" onClick={onDownloadAll}>
            + Add all
          </Button>
        </div>
      )}
      {events.map((event, idx) => (
        <EventCard
          key={idx}
          event={event}
          conflict={conflicts[idx]}
          relevance={relevance?.[idx] ?? null}
          campusMatch={campusMatches?.[idx] ?? null}
          orgMatch={orgMatches?.[idx] ?? null}
          noticings={noticingsPerEvent[idx]}
          interests={interests}
          leaveBy={leaveByPerEvent[idx]}
          busySlots={busySlots}
          onChange={(updated) => onUpdateEvent(idx, updated)}
          onDownloadIcs={() => onDownloadIcs(event)}
          onOpenGoogle={() => openInNewTab(googleCalendarUrl(event))}
          onOpenOutlook={() => openInNewTab(outlookCalendarUrl(event))}
        />
      ))}
      {sourceNotes && (
        <p className="text-xs italic text-muted-foreground">
          note from Claude: {sourceNotes}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onReset} variant="outline" className="w-fit">
          Upload another
        </Button>
        {canRetryWithSonnet && (
          <Button variant="secondary" className="w-fit" onClick={onRetryWithSonnet}>
            Try with stronger model
          </Button>
        )}
      </div>
    </div>
  );
}
