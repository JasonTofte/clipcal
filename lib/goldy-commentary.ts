import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';
import { checkConflict } from '@/lib/conflict';
import templates from '@/lib/goldy-templates.json';

export type GoldyBucket =
  | 'conflict'
  | 'top-pick-gameday'
  | 'interest-match'
  | 'free-food'
  | 'back-to-back'
  | 'late-night'
  | 'weekend-open'
  | 'default';

export type GoldyContext = {
  bucket: GoldyBucket;
  slots: {
    conflictTitle?: string;
    walkMinutes?: number;
    dayLabel?: string;
    nextEventTitle?: string;
    foodHint?: string;
    interestHit?: string;
  };
};

// djb2 hash — small, pure, no external deps
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

function isGameday(event: Event): boolean {
  const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase();
  return (
    event.category === 'sports' ||
    haystack.includes('game') ||
    haystack.includes('gophers vs') ||
    haystack.includes('axe') ||
    haystack.includes('stadium')
  );
}

function detectFoodHint(event: Event): string {
  const haystack = `${event.title} ${event.description ?? ''}`.toLowerCase();
  if (haystack.includes('pizza')) return 'pizza';
  if (haystack.includes('taco')) return 'tacos';
  if (haystack.includes('donut')) return 'donuts';
  if (haystack.includes('snack')) return 'snacks';
  if (haystack.includes('coffee')) return 'coffee';
  if (haystack.includes('food')) return 'food';
  return 'free food';
}

const MIN_PARTIAL_MATCH_LEN = 4;

function matchesAnyInterest(event: Event, interests: string[]): string | null {
  if (interests.length === 0) return null;
  const haystack = `${event.title} ${event.category}`.toLowerCase();
  const haystackWords = haystack.split(/\W+/).filter((w) => w.length >= MIN_PARTIAL_MATCH_LEN);

  for (const interest of interests) {
    const needle = interest.trim().toLowerCase();
    if (!needle) continue;
    // Exact substring match (catches full-word interests like "hackathon")
    if (haystack.includes(needle)) return interest;
    // Word-boundary partial match: a haystack word is a prefix of the interest,
    // OR the interest is a prefix of a haystack word. Min length on shorter side
    // avoids false positives ("art" → "part", "data" → "update").
    if (needle.length < MIN_PARTIAL_MATCH_LEN) continue;
    for (const word of haystackWords) {
      if (needle.startsWith(word) || word.startsWith(needle)) return interest;
    }
  }
  return null;
}

const BACK_TO_BACK_MS = 90 * 60 * 1000;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;
const LATE_NIGHT_START_HOUR = 21; // UTC hour at which an event is considered "late night"
const DEFAULT_WALK_MINUTES = 12; // assumed walk time between different venue locations

function findAdjacentEvent(
  event: Event,
  allEventsSortedByStart: Event[],
): Event | null {
  const eventStart = new Date(event.start).getTime();
  const eventEnd = event.end ? new Date(event.end).getTime() : eventStart + DEFAULT_EVENT_DURATION_MS;

  for (const other of allEventsSortedByStart) {
    if (other === event || other.start === event.start) continue;
    const otherStart = new Date(other.start).getTime();
    const otherEnd = other.end ? new Date(other.end).getTime() : otherStart + DEFAULT_EVENT_DURATION_MS;

    // other ends right before this starts
    if (otherEnd <= eventStart && eventStart - otherEnd <= BACK_TO_BACK_MS) {
      return other;
    }
    // other starts right after this ends
    if (otherStart >= eventEnd && otherStart - eventEnd <= BACK_TO_BACK_MS) {
      return other;
    }
  }
  return null;
}

export function buildContext(
  event: Event,
  calendar: BusySlot[],
  allEventsSortedByStart: Event[],
  interests?: string[],
): GoldyContext {
  // Priority 1: conflict
  const conflictResult = checkConflict(event, calendar);
  if (conflictResult.status === 'overlaps') {
    return {
      bucket: 'conflict',
      slots: { conflictTitle: conflictResult.conflictTitle },
    };
  }

  // Priority 2: top-pick-gameday
  if (isGameday(event)) {
    return { bucket: 'top-pick-gameday', slots: {} };
  }

  // Priority 3: interest-match
  const matchedInterest = matchesAnyInterest(event, interests ?? []);
  if (matchedInterest !== null) {
    return {
      bucket: 'interest-match',
      slots: { interestHit: matchedInterest },
    };
  }

  // Priority 4: free-food
  if (event.hasFreeFood) {
    return {
      bucket: 'free-food',
      slots: { foodHint: detectFoodHint(event) },
    };
  }

  // Priority 5: back-to-back
  const adjacent = findAdjacentEvent(event, allEventsSortedByStart);
  if (adjacent !== null) {
    // Leave walkMinutes undefined when same venue — templates that reference
    // {{walkMinutes}} will fall through to ones that don't, avoiding "0-min walk".
    const differentVenue =
      !!event.location && !!adjacent.location && event.location !== adjacent.location;
    return {
      bucket: 'back-to-back',
      slots: {
        nextEventTitle: adjacent.title,
        walkMinutes: differentVenue ? DEFAULT_WALK_MINUTES : undefined,
      },
    };
  }

  // Priority 6: late-night
  const startHourUtc = new Date(event.start).getUTCHours();
  if (startHourUtc >= LATE_NIGHT_START_HOUR) {
    return { bucket: 'late-night', slots: {} };
  }

  // Priority 7: weekend-open
  const startDay = new Date(event.start).getUTCDay(); // 0=Sun, 6=Sat
  if (startDay === 0 || startDay === 6) {
    return { bucket: 'weekend-open', slots: {} };
  }

  // Priority 8: default
  return { bucket: 'default', slots: {} };
}

type TemplateBank = Record<string, string[]>;

export function pickGoldyLine(event: Event, context: GoldyContext): string {
  const bank = templates as TemplateBank;
  const bucket = context.bucket;
  const slots = context.slots as Record<string, string | number | undefined>;

  function tryBucket(b: string): string | null {
    const variants: string[] | undefined = bank[b];
    if (!variants || variants.length === 0) return null;

    const hash = djb2(event.start + event.title);

    for (let attempt = 0; attempt < variants.length; attempt++) {
      const idx = (hash + attempt) % variants.length;
      const tmpl = variants[idx];

      // Check if all placeholders can be filled
      const placeholders = [...tmpl.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const allFilled = placeholders.every((p) => slots[p] !== undefined);
      if (!allFilled) continue;

      // Substitute
      const result = tmpl.replace(/\{\{(\w+)\}\}/g, (_, key) => String(slots[key] ?? ''));
      return result;
    }
    return null;
  }

  // Try the requested bucket first, then fall back to default
  const line = tryBucket(bucket) ?? tryBucket('default') ?? 'Something to check out.';
  return line;
}
