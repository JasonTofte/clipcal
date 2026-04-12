const LIVEWHALE_BASE = 'https://events.tc.umn.edu/live/json/events';

export type CampusFeedEvent = {
  id: number;
  title: string;
  url: string;
  date_iso: string;
  date_display: string;
  location: string | null;
  group_title: string | null;
  thumbnail: string | null;
  cost: string | null;
  event_types: string[];
  is_all_day: boolean;
};

export type CampusFeedResponse = {
  events: CampusFeedEvent[];
};

// In-memory cache — 10 minute TTL
let feedCache: { events: CampusFeedEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(): Promise<Response> {
  if (feedCache && Date.now() - feedCache.fetchedAt < CACHE_TTL_MS) {
    return Response.json({ events: feedCache.events } satisfies CampusFeedResponse);
  }

  try {
    const url = `${LIVEWHALE_BASE}/max/10/only_future/true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ events: [] } satisfies CampusFeedResponse);
    }

    const data: unknown = await res.json();
    const raw: unknown[] = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data ?? [];

    const events: CampusFeedEvent[] = raw.map((e: unknown) => {
      const ev = e as Record<string, unknown>;
      return {
        id: Number(ev.id) || 0,
        title: String(ev.title || ''),
        url: String(ev.url || ''),
        date_iso: String(ev.date_iso || ''),
        date_display: String(ev.date || ''),
        location: ev.location ? String(ev.location) : null,
        group_title: ev.group_title ? String(ev.group_title) : null,
        thumbnail: ev.thumbnail ? String(ev.thumbnail) : null,
        cost: ev.cost ? String(ev.cost) : null,
        event_types: Array.isArray(ev.event_types)
          ? (ev.event_types as string[])
          : [],
        is_all_day: Boolean(ev.is_all_day),
      };
    });

    feedCache = { events, fetchedAt: Date.now() };
    return Response.json({ events } satisfies CampusFeedResponse);
  } catch {
    return Response.json({ events: [] } satisfies CampusFeedResponse);
  }
}
