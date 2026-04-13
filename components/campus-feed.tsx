'use client';

import { useEffect, useState } from 'react';
import type { CampusFeedEvent, CampusFeedResponse } from '@/app/api/campus-feed/route';
import { loadProfileFromStorage } from '@/lib/profile';
import { scoreEvent, scoreTone, formatScoreBadge } from '@/lib/relevance';

const TONE_STYLES: Record<'high' | 'medium' | 'low', { bg: string; fg: string }> = {
  high: { bg: 'var(--goldy-gold-100)', fg: 'var(--goldy-maroon-700)' },
  medium: { bg: 'var(--surface-calm)', fg: 'var(--muted-foreground)' },
  low: { bg: 'transparent', fg: 'var(--muted-foreground)' },
};

export function CampusFeed() {
  const [events, setEvents] = useState<CampusFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    const profile = loadProfileFromStorage();
    if (profile?.interests?.length) setInterests(profile.interests);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/campus-feed');
        if (!res.ok) return;
        const json = (await res.json()) as CampusFeedResponse;
        setEvents(json.events);
      } catch {
        // Silent fail — campus feed is an enhancement
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-3 animate-spin rounded-full border-[2px] border-muted-foreground/20 border-t-muted-foreground" />
          Loading campus events…
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>🏛️</span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Happening on Campus
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          live · events.tc.umn.edu
        </span>
      </div>

      <ul className="space-y-2">
        {events.map((event) => {
          const score = scoreEvent(event, interests);
          const tone = score === null ? null : scoreTone(score);
          return (
          <li key={event.id}>
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              {event.thumbnail && (
                <img
                  src={event.thumbnail}
                  alt=""
                  className="mt-0.5 size-8 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium group-hover:text-primary">
                    {event.title}
                  </p>
                  {score !== null && tone && (
                    <span
                      title="Match confidence based on your interests"
                      className="inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                      style={{
                        background: TONE_STYLES[tone].bg,
                        color: TONE_STYLES[tone].fg,
                      }}
                    >
                      {formatScoreBadge(score)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>{event.date_display}</span>
                  {event.location && (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate">{event.location}</span>
                    </>
                  )}
                  {event.cost && event.cost.toLowerCase() === 'free' && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                    </>
                  )}
                </div>
                {event.group_title && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">
                    {event.group_title}
                  </p>
                )}
              </div>
            </a>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
