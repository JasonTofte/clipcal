import { z } from 'zod';
import { parseIcs, type IcsEvent } from '@/lib/ics-parse';
import { campusLimiter, extractClientIp } from '@/lib/rate-limit';

const GOPHERLINK_ICS_URL =
  'https://gopherlink.umn.edu/ical/twincitiesumn/ical_twincitiesumn.ics';

// Cache the parsed ICS feed in memory for 15 minutes to avoid hammering
// GopherLink on every request.
let icsCache: { events: IcsEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;
// Hard cap on ICS body size (2 MB). GopherLink's feed is ~200 KB today;
// the cap is defense-in-depth against an unbounded upstream response
// OOM-ing the server when parseIcs is invoked on raw text.
const MAX_ICS_BYTES = 2 * 1024 * 1024;

export type OrgMatch = {
  summary: string;
  dtstart: string;
  location: string | null;
  organizer: string | null;
  url: string | null;
  similarity: number;
};

export type OrgMatchResponse = {
  matches: OrgMatch[];
};

const RequestSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
});

/** Simple word-overlap similarity score (0–1). */
function similarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

async function fetchAndCacheIcs(): Promise<IcsEvent[]> {
  if (icsCache && Date.now() - icsCache.fetchedAt < CACHE_TTL_MS) {
    return icsCache.events;
  }

  const res = await fetch(GOPHERLINK_ICS_URL, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];

  // Stream into a capped buffer so an unbounded response never OOMs us.
  const reader = res.body?.getReader();
  if (!reader) return [];
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ICS_BYTES) {
      await reader.cancel().catch(() => {});
      console.warn('[campus-orgs] ICS body exceeded', MAX_ICS_BYTES, 'bytes');
      return [];
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  const text = new TextDecoder('utf-8').decode(buf);
  const events = parseIcs(text);
  icsCache = { events, fetchedAt: Date.now() };
  return events;
}

export async function POST(req: Request): Promise<Response> {
  const limit = campusLimiter.check(extractClientIp(req.headers));
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate limited, try again in a moment' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

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

  const { title } = parsed.data;

  try {
    const icsEvents = await fetchAndCacheIcs();

    const scored = icsEvents
      .map((e) => ({
        event: e,
        sim: similarity(title, e.summary),
      }))
      .filter((s) => s.sim >= 0.3)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 3);

    const matches: OrgMatch[] = scored.map((s) => ({
      summary: s.event.summary,
      dtstart: s.event.dtstart,
      location: s.event.location,
      organizer: s.event.organizer,
      url: s.event.url,
      similarity: Math.round(s.sim * 100),
    }));

    return Response.json({ matches } satisfies OrgMatchResponse);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.warn('[campus-orgs]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({ matches: [] } satisfies OrgMatchResponse);
  }
}
