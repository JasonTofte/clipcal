'use client';

import { useEffect, useState } from 'react';
import type { CampusFeedEvent, CampusFeedResponse } from '@/app/api/campus-feed/route';
import { CampusEventList } from '@/components/campus-event-list';
import { loadProfileFromStorage } from '@/lib/profile';

export function CampusFeed() {
  const [events, setEvents] = useState<CampusFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

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

  if (loading || events.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="campus-feed-heading">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="campus-feed-list"
        className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>🏛️</span>
          <h2
            id="campus-feed-heading"
            className="text-sm font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            Happening on Campus
          </h2>
          <span
            className="text-[11px]"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {events.length} live
          </span>
        </div>
        <span
          aria-hidden
          className="text-xs transition-transform"
          style={{
            color: 'var(--muted-foreground)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div id="campus-feed-list" className="mt-3">
          <CampusEventList events={events} interests={interests} />
          <p
            className="mt-3 text-center text-[10px] font-mono"
            style={{ color: 'var(--muted-foreground)' }}
          >
            events.tc.umn.edu · live
          </p>
        </div>
      )}
    </section>
  );
}
