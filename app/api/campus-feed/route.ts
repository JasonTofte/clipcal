import { fetchUpcoming, type LiveWhaleEvent } from '@/lib/livewhale';

export type CampusFeedEvent = LiveWhaleEvent;

export type CampusFeedResponse = {
  events: CampusFeedEvent[];
};

// In-memory cache — 10 minute TTL.
let feedCache: { events: CampusFeedEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(): Promise<Response> {
  if (feedCache && Date.now() - feedCache.fetchedAt < CACHE_TTL_MS) {
    return Response.json({ events: feedCache.events } satisfies CampusFeedResponse);
  }

  try {
    const events = await fetchUpcoming(10);
    // Don't cache empty results: fetchUpcoming swallows upstream failures
    // by returning []. Caching [] for the full TTL would freeze the feed
    // empty even after LiveWhale recovers.
    if (events.length > 0) {
      feedCache = { events, fetchedAt: Date.now() };
    }
    return Response.json({ events } satisfies CampusFeedResponse);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.warn('[campus-feed]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({ events: [] } satisfies CampusFeedResponse);
  }
}
