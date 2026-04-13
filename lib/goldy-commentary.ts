import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';
import { checkConflict } from '@/lib/conflict';
import { computeLeaveBy } from '@/lib/leave-by';
import templates from '@/lib/goldy-templates.json';

export type GoldyBucket =
  | 'urgent'
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
    // For the `urgent` bucket: whole-minute countdown to leave-by.
    minutesToLeaveBy?: number;
  };
};

// Mirror of URGENT_WINDOW_MS in lib/day-of-reminder (30 min). Duplicated
// here to keep goldy-commentary free of a day-of-reminder import cycle.
const URGENT_LEAVEBY_WINDOW_MS = 30 * 60 * 1000;

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
const LATE_NIGHT_START_HOUR = 21; // local hour at which an event is considered "late night"
const DEFAULT_WALK_MINUTES = 12; // assumed walk time between different venue locations

// Hour-of-day and day-of-week in the event's local timezone. UTC would classify
// events as "late night" based on server clock, not the user's wall clock — for
// America/Chicago that's off by 5-6 hours and breaks the bucket entirely.
function localHourAndDay(event: Event): { hour: number; day: number } {
  const d = new Date(event.start);
  const tz = event.timezone || 'America/Chicago';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    }).formatToParts(d);
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const wkd = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    // Intl sometimes returns "24" for midnight — normalize to 0.
    const hourNum = Number(hourStr) % 24;
    return { hour: hourNum, day: dayMap[wkd] ?? d.getUTCDay() };
  } catch {
    return { hour: d.getUTCHours(), day: d.getUTCDay() };
  }
}

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
  now?: Date,
): GoldyContext {
  // Priority 0: urgent — event is ≤30 min from its leave-by. Wins over
  // everything else (including conflict) because day-of execution is the
  // narrowest window for the user to act.
  if (now) {
    const leaveBy = computeLeaveBy(event);
    if (leaveBy) {
      const msToLeaveBy = leaveBy.leaveByDate.getTime() - now.getTime();
      const msToStart = new Date(event.start).getTime() - now.getTime();
      // Only surface urgent while the event hasn't started AND leave-by
      // is in (or very recently passed) the window.
      if (
        msToStart > 0 &&
        msToLeaveBy <= URGENT_LEAVEBY_WINDOW_MS &&
        msToLeaveBy > -URGENT_LEAVEBY_WINDOW_MS
      ) {
        return {
          bucket: 'urgent',
          slots: {
            minutesToLeaveBy: Math.max(0, Math.round(msToLeaveBy / (60 * 1000))),
            walkMinutes: leaveBy.walkMinutes,
          },
        };
      }
    }
  }

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

  // Priority 6 + 7: time-of-day / day-of-week in the event's local timezone.
  const { hour, day } = localHourAndDay(event);
  if (hour >= LATE_NIGHT_START_HOUR) {
    return { bucket: 'late-night', slots: {} };
  }
  if (day === 0 || day === 6) {
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
