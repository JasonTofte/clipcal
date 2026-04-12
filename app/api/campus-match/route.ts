import { z } from 'zod';

const LIVEWHALE_BASE = 'https://events.tc.umn.edu/live/json/events';

const RequestSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
});

export type CampusMatch = {
  id: number;
  title: string;
  url: string;
  date_iso: string;
  location: string | null;
  group_title: string | null;
  thumbnail: string | null;
};

export type CampusMatchResponse = {
  matches: CampusMatch[];
};

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'title and start required' }, { status: 400 });
  }

  const { title, start } = parsed.data;

  // Extract first 3 significant words for search (skip articles/prepositions)
  const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'in', 'at', 'to', 'is', 'on']);
  const keywords = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 3)
    .join('+');

  if (!keywords) {
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }

  // Compute a date window: 3 days before and after the event start
  const eventDate = new Date(start);
  if (Number.isNaN(eventDate.getTime())) {
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }

  const windowStart = new Date(eventDate);
  windowStart.setDate(windowStart.getDate() - 3);
  const windowEnd = new Date(eventDate);
  windowEnd.setDate(windowEnd.getDate() + 3);

  const startStr = windowStart.toISOString().slice(0, 10);
  const endStr = windowEnd.toISOString().slice(0, 10);

  const url = `${LIVEWHALE_BASE}/search/${encodeURIComponent(keywords)}/start_date/${startStr}/end_date/${endStr}/max/5`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ matches: [] } satisfies CampusMatchResponse);
    }

    const data: unknown = await res.json();

    // LiveWhale v1 returns an array directly; v2 wraps in { data: [...] }
    const events: unknown[] = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] })?.data ?? [];

    const matches: CampusMatch[] = events.slice(0, 3).map((e: unknown) => {
      const ev = e as Record<string, unknown>;
      return {
        id: Number(ev.id) || 0,
        title: String(ev.title || ''),
        url: String(ev.url || ''),
        date_iso: String(ev.date_iso || ''),
        location: ev.location ? String(ev.location) : null,
        group_title: ev.group_title ? String(ev.group_title) : null,
        thumbnail: ev.thumbnail ? String(ev.thumbnail) : null,
      };
    });

    return Response.json({ matches } satisfies CampusMatchResponse);
  } catch {
    // Network errors are non-fatal — campus match is an enhancement
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }
}
