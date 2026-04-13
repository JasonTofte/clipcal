import { z } from 'zod';
import {
  fetchSearch,
  extractKeywords,
  dateWindow,
  type LiveWhaleEvent,
} from '@/lib/livewhale';
import { campusLimiter, extractClientIp } from '@/lib/rate-limit';

const RequestSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
});

export type CampusMatch = LiveWhaleEvent;

export type CampusMatchResponse = {
  matches: CampusMatch[];
};

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

  const { title, start } = parsed.data;

  const keywords = extractKeywords(title);
  if (!keywords) {
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }

  const window = dateWindow(start, 3);
  if (!window) {
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }

  try {
    const events = await fetchSearch({
      keywords,
      startDate: window.startDate,
      endDate: window.endDate,
      max: 5,
    });
    return Response.json(
      { matches: events.slice(0, 3) } satisfies CampusMatchResponse,
    );
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.warn('[campus-match]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({ matches: [] } satisfies CampusMatchResponse);
  }
}
