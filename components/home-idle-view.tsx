'use client';

import { CampusFeed } from '@/components/campus-feed';
import { Dropzone } from '@/components/dropzone';
import { EventCard } from '@/components/event-card';
import { GoldyBubble } from '@/components/shared';
import { checkConflict } from '@/lib/conflict';
import { DEMO_CALENDAR } from '@/lib/demo-calendar';
import { computeLeaveBy } from '@/lib/leave-by';
import { generateNoticings } from '@/lib/noticings';
import { type RelevanceScore } from '@/lib/relevance';
import type { Event } from '@/lib/schema';

// Stable sample event for the idle teaser. Hardcoded (not computed from
// new Date()) so SSR prerender and client hydration produce identical output.
const TEASER_EVENT: Event = {
  title: 'Data Viz Workshop',
  start: '2026-04-18T19:00:00-05:00',
  end: '2026-04-18T20:30:00-05:00',
  location: 'Walter Library 101',
  description: 'Intro to D3.js and observable notebooks. Beginner friendly — come play.',
  category: 'workshop',
  hasFreeFood: true,
  timezone: 'America/Chicago',
  confidence: 'high',
};

const TEASER_RELEVANCE: RelevanceScore = {
  score: 82,
  reason: 'matches your data + workshops interests',
};

type Props = {
  demoMode: boolean;
  onFiles: (files: File[]) => void;
};

export function HomeIdleView({ demoMode, onFiles }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <GoldyBubble avatar tone="gold" className="self-start max-w-sm">
        <p className="text-sm leading-snug">
          Drop a flyer, I&rsquo;ll sort it. Camera roll, paste, or pick a file — I&rsquo;ll pull
          the when, where, and whether you&rsquo;re free.
        </p>
      </GoldyBubble>
      <Dropzone onFiles={onFiles} />
      {demoMode && (
        <section className="space-y-3">
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>What you&rsquo;ll see</span>
            <div className="h-px flex-1 bg-border/60" />
            <span className="font-mono text-[10px] text-muted-foreground/60">sample</span>
          </div>
          <EventCard
            event={TEASER_EVENT}
            conflict={checkConflict(TEASER_EVENT, DEMO_CALENDAR)}
            relevance={TEASER_RELEVANCE}
            campusMatch={null}
            orgMatch={null}
            noticings={generateNoticings(TEASER_EVENT, { demoCalendar: DEMO_CALENDAR })}
            leaveBy={computeLeaveBy(TEASER_EVENT)}
            busySlots={DEMO_CALENDAR}
            readOnly
            onChange={() => undefined}
            onDownloadIcs={() => undefined}
            onOpenGoogle={() => undefined}
            onOpenOutlook={() => undefined}
          />
          <p className="text-center text-[11px] text-muted-foreground/70">
            Upload any flyer above to get your own.
          </p>
        </section>
      )}
      <CampusFeed />
    </div>
  );
}
