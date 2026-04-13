import { fetchBrowse, type LiveWhaleEvent } from '@/lib/livewhale';
import { campusLimiter, extractClientIp } from '@/lib/rate-limit';

export type CampusBrowseResponse = {
  events: LiveWhaleEvent[];
  cached: boolean;
  range: { startDate: string; endDate: string };
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;
const MAX_ALLOWED = 200;
const MAX_Q_LENGTH = 200;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

type CacheEntry = { events: LiveWhaleEvent[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(q: string, startDate: string, endDate: string, max: number | undefined): string {
  return `${startDate}|${endDate}|${max ?? ''}|${encodeURIComponent(q)}`;
}

function trimCache(): void {
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export async function GET(request: Request): Promise<Response> {
  const limit = campusLimiter.check(extractClientIp(request.headers));
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate limited, try again in a moment' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate') ?? '';
  const endDate = url.searchParams.get('endDate') ?? '';
  const q = (url.searchParams.get('q') ?? '').slice(0, MAX_Q_LENGTH);
  const maxParam = url.searchParams.get('max');

  if (!YYYY_MM_DD.test(startDate) || !YYYY_MM_DD.test(endDate)) {
    return Response.json(
      { error: 'startDate and endDate are required in YYYY-MM-DD format' },
      { status: 400 },
    );
  }

  let max: number | undefined;
  if (maxParam !== null) {
    const parsed = Number(maxParam);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return Response.json({ error: 'max must be a positive integer' }, { status: 400 });
    }
    max = Math.min(MAX_ALLOWED, Math.trunc(parsed));
  }

  const key = cacheKey(q, startDate, endDate, max);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return Response.json({
      events: hit.events,
      cached: true,
      range: { startDate, endDate },
    } satisfies CampusBrowseResponse);
  }

  try {
    const events = await fetchBrowse({ q, startDate, endDate, max });
    cache.set(key, { events, fetchedAt: Date.now() });
    trimCache();
    return Response.json({
      events,
      cached: false,
      range: { startDate, endDate },
    } satisfies CampusBrowseResponse);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.warn('[campus-browse]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({
      events: [],
      cached: false,
      range: { startDate, endDate },
    } satisfies CampusBrowseResponse);
  }
}
