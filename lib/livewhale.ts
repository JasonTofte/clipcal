import { z } from 'zod';

const LIVEWHALE_BASE = 'https://events.tc.umn.edu/live/json/events';

// LiveWhale's real responses use snake_case, mix number/string numerics, and
// sometimes include nulls where booleans are expected. Coerce defensively but
// in one place — the route handlers stay shape-agnostic.
const RawEventSchema = z
  .object({
    id: z.coerce.number().catch(0),
    title: z.string().catch(''),
    url: z.string().catch(''),
    date_iso: z.string().catch(''),
    date: z.string().optional(),
    location: z.string().nullish(),
    location_latitude: z.coerce.number().nullish(),
    location_longitude: z.coerce.number().nullish(),
    group_title: z.string().nullish(),
    thumbnail: z.string().nullish(),
    cost: z.string().nullish(),
    has_registration: z.coerce.boolean().catch(false),
    is_all_day: z.coerce.boolean().catch(false),
    event_types: z.array(z.string()).catch([]),
  })
  .passthrough();

type RawEvent = z.infer<typeof RawEventSchema>;

export type LiveWhaleEvent = {
  id: number;
  title: string;
  url: string;
  date_iso: string;
  date_display: string;
  location: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  group_title: string | null;
  thumbnail: string | null;
  cost: string | null;
  has_registration: boolean;
  is_all_day: boolean;
  event_types: string[];
};

function normalize(raw: RawEvent): LiveWhaleEvent {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    date_iso: raw.date_iso,
    date_display: raw.date ?? '',
    location: raw.location ?? null,
    location_latitude: raw.location_latitude ?? null,
    location_longitude: raw.location_longitude ?? null,
    group_title: raw.group_title ?? null,
    thumbnail: raw.thumbnail ?? null,
    cost: raw.cost ?? null,
    has_registration: raw.has_registration,
    is_all_day: raw.is_all_day,
    event_types: raw.event_types,
  };
}

async function fetchLiveWhale(path: string, timeoutMs = 5000): Promise<LiveWhaleEvent[]> {
  const res = await fetch(`${LIVEWHALE_BASE}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) return [];

  const body: unknown = await res.json();
  // LiveWhale v1 returns an array directly; v2 wraps in { data: [...] }.
  const rawList: unknown[] = Array.isArray(body)
    ? body
    : (body as { data?: unknown[] })?.data ?? [];

  const out: LiveWhaleEvent[] = [];
  for (const item of rawList) {
    const parsed = RawEventSchema.safeParse(item);
    if (parsed.success) out.push(normalize(parsed.data));
  }
  return out;
}

export async function fetchUpcoming(max = 10): Promise<LiveWhaleEvent[]> {
  return fetchLiveWhale(`/max/${max}/only_future/true`);
}

export async function fetchSearch(params: {
  keywords: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  max?: number;
}): Promise<LiveWhaleEvent[]> {
  const max = params.max ?? 5;
  const path = `/search/${encodeURIComponent(params.keywords)}/start_date/${params.startDate}/end_date/${params.endDate}/max/${max}`;
  return fetchLiveWhale(path);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'and', 'in', 'at', 'to', 'is', 'on',
]);

export function extractKeywords(title: string, count = 3): string {
  return title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, count)
    .join('+');
}

export function dateWindow(
  centerIso: string,
  paddingDays = 3,
): { startDate: string; endDate: string } | null {
  const d = new Date(centerIso);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d);
  start.setDate(start.getDate() - paddingDays);
  const end = new Date(d);
  end.setDate(end.getDate() + paddingDays);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
