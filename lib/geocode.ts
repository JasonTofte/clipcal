import type { GeocodeResponse } from '@/app/api/geocode/route';

// Client wrapper around /api/geocode. Returns null on any failure so
// callers treat geocoding as best-effort (fallback origin = UMN campus).

export type GeocodeHit = { lat: number; lng: number; display: string };

export async function geocode(q: string): Promise<GeocodeHit | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
    const body = (await res.json()) as GeocodeResponse;
    if (!body.ok) return null;
    return { lat: body.lat, lng: body.lng, display: body.display };
  } catch {
    return null;
  }
}

// In-memory cache for the current session — avoids re-geocoding the same
// location every time the feed renders. localStorage version would persist
// across sessions; deferred to follow-up.
const sessionCache = new Map<string, GeocodeHit | null>();

export async function geocodeCached(q: string): Promise<GeocodeHit | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  if (sessionCache.has(key)) return sessionCache.get(key) ?? null;
  const hit = await geocode(trimmed);
  sessionCache.set(key, hit);
  return hit;
}
