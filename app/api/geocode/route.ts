import { geocodeLimiter, extractClientIp } from '@/lib/rate-limit';

// Thin server-side proxy to OpenStreetMap Nominatim (free, no API key).
// We proxy (rather than calling from the browser) for three reasons:
//   1. Nominatim's usage policy requires a real User-Agent; the browser's
//      default is disallowed.
//   2. In-memory cache dedupes repeated geocoding of the same address
//      across users (e.g., "Coffman Memorial Union" gets geocoded once).
//   3. Rate-limiting + bounded upstream concurrency at the edge.
// See: https://operations.osmfoundation.org/policies/nominatim/

export type GeocodeResponse =
  | { ok: true; lat: number; lng: number; display: string; cached: boolean }
  | { ok: false; reason: 'not-found' | 'rate-limited' | 'bad-request' | 'upstream' };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — addresses are stable.
const CACHE_MAX_ENTRIES = 500;
const MAX_Q_LENGTH = 300;
const UA = 'ShowUp/1.0 (https://github.com/JasonTofte/clipcal)';

type CacheEntry = { lat: number; lng: number; display: string; at: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function trimCache(): void {
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const qRaw = url.searchParams.get('q') ?? '';
  const q = qRaw.trim();

  if (!q || q.length > MAX_Q_LENGTH) {
    const body: GeocodeResponse = { ok: false, reason: 'bad-request' };
    return Response.json(body, { status: 400 });
  }

  const ip = extractClientIp(req.headers);
  const rl = geocodeLimiter.check(ip);
  if (rl.allowed === false) {
    const body: GeocodeResponse = { ok: false, reason: 'rate-limited' };
    return Response.json(body, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
  }

  const key = cacheKey(q);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    const body: GeocodeResponse = {
      ok: true,
      lat: hit.lat,
      lng: hit.lng,
      display: hit.display,
      cached: true,
    };
    return Response.json(body);
  }

  // Bias to Minnesota + restrict to US to reduce ambiguity for UMN users.
  const upstream = new URL('https://nominatim.openstreetmap.org/search');
  upstream.searchParams.set('q', q);
  upstream.searchParams.set('format', 'jsonv2');
  upstream.searchParams.set('limit', '1');
  upstream.searchParams.set('countrycodes', 'us');

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      // Nominatim is slow; set a real timeout via AbortController.
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    const body: GeocodeResponse = { ok: false, reason: 'upstream' };
    return Response.json(body, { status: 502 });
  }

  if (!res.ok) {
    const body: GeocodeResponse = { ok: false, reason: 'upstream' };
    return Response.json(body, { status: 502 });
  }

  const parsed = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    const body: GeocodeResponse = { ok: false, reason: 'not-found' };
    return Response.json(body, { status: 404 });
  }

  const top = parsed[0];
  const lat = Number.parseFloat(top.lat);
  const lng = Number.parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const body: GeocodeResponse = { ok: false, reason: 'upstream' };
    return Response.json(body, { status: 502 });
  }

  cache.set(key, { lat, lng, display: top.display_name, at: now });
  trimCache();

  const body: GeocodeResponse = {
    ok: true,
    lat,
    lng,
    display: top.display_name,
    cached: false,
  };
  return Response.json(body);
}
