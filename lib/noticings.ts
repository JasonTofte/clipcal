import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';
import { walkMinutesOrNull, UMN_CAMPUS } from '@/lib/distance';

export type NoticingTone = 'info' | 'heads-up' | 'delight';

export type Noticing = {
  icon: string;
  text: string;
  tone: NoticingTone;
};

export type LatLng = { lat: number; lng: number };

export type NoticingContext = {
  demoCalendar: BusySlot[];
  now?: Date;
  // Origin for walk-distance calculation. When null/omitted, consumers
  // fall back to UMN campus center — "walk from campus" is a useful
  // baseline for UMN students even without a home address set.
  originCoords?: LatLng | null;
  // Pre-geocoded destination for this specific event (keyed by location
  // string in the caller, then threaded through here). When null/omitted,
  // no walk chip is emitted — we refuse to fabricate a time.
  destinationCoords?: LatLng | null;
  // Back-compat override for tests; if set, ignores origin/destination.
  hardcodedWalkMinutes?: number;
};
const BACK_TO_BACK_WINDOW_MIN = 15;
const BUFFER_WINDOW_MIN = 45;
const EARLY_CLASS_HOUR = 9;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Classes whose lectures are published as recordings — so "conflict" doesn't
// mean "can't attend", it means "review later". Curated for demo.
const RECORDED_CLASS_PATTERNS: RegExp[] = [
  /CSCI\s*5801/i,
];

export function generateNoticings(
  event: Event,
  context: NoticingContext,
): Noticing[] {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return [];

  const end = event.end
    ? new Date(event.end)
    : new Date(start.getTime() + DEFAULT_DURATION_MS);

  const noticings: Noticing[] = [];

  // 1. Walk time — only when we can actually compute it. Either a caller-
  //    supplied hardcodedWalkMinutes (tests), or both origin + destination
  //    coordinates available. If the destination hasn't been geocoded yet
  //    (still loading or lookup failed), we emit NO walk chip rather than
  //    fabricate a time. Origin defaults to UMN campus center when the user
  //    hasn't set a home address.
  if (event.location) {
    const shortLoc = event.location.split(',')[0];
    let walkMin: number | null = null;
    if (context.hardcodedWalkMinutes !== undefined) {
      walkMin = context.hardcodedWalkMinutes;
    } else if (context.destinationCoords) {
      const origin = context.originCoords ?? UMN_CAMPUS;
      walkMin = walkMinutesOrNull(origin, context.destinationCoords);
    }
    if (walkMin !== null) {
      const label = context.originCoords
        ? `${walkMin}-min walk to ${shortLoc}`
        : `${walkMin}-min walk from campus`;
      noticings.push({ icon: '🚶', text: label, tone: 'info' });
    }
  }

  // 2. First open {day} — if the event's day has no conflicting busy slots,
  //    flag it as the first open window that day this week.
  const eventDayStart = startOfDay(start);
  const eventDayEnd = new Date(eventDayStart);
  eventDayEnd.setDate(eventDayEnd.getDate() + 1);

  const anyBusyThatDay = context.demoCalendar.some(
    (slot) => slot.start < eventDayEnd && slot.end > eventDayStart,
  );
  if (!anyBusyThatDay) {
    const dayName = DAY_NAMES[start.getDay()];
    noticings.push({
      icon: '✨',
      text: `first open ${dayName} this week`,
      tone: 'delight',
    });
  }

  // 3. Early class next day. Look at day after event.start. Earliest busy
  //    slot that day determines the message. Demo calendar has no 8 AM
  //    slots, so this will typically be the calm version.
  const nextDay = new Date(eventDayStart);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayAfterNextDay = new Date(nextDay);
  dayAfterNextDay.setDate(dayAfterNextDay.getDate() + 1);

  const busyNextDay = context.demoCalendar
    .filter((slot) => slot.start < dayAfterNextDay && slot.end > nextDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const nextDayName = DAY_NAMES[nextDay.getDay()];
  if (busyNextDay.length === 0 || busyNextDay[0].start.getHours() >= 12) {
    noticings.push({
      icon: '😴',
      text: `no early class ${nextDayName}`,
      tone: 'delight',
    });
  } else if (busyNextDay[0].start.getHours() <= EARLY_CLASS_HOUR) {
    const hour = busyNextDay[0].start.getHours();
    const display = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour >= 12 ? ' PM' : ' AM'}`;
    noticings.push({
      icon: '⚠',
      text: `${display} class ${nextDayName}`,
      tone: 'heads-up',
    });
  }

  // 4. Back-to-back / transition buffer — detect nearby busy slots.
  //    ≤15 min gap = back-to-back. 16–45 min gap = transition buffer (breathing room).
  const startMs = start.getTime();
  const endMs = end.getTime();
  const backToBackMs = BACK_TO_BACK_WINDOW_MIN * 60 * 1000;
  const bufferMs = BUFFER_WINDOW_MIN * 60 * 1000;

  let closestNeighbor: { slot: typeof context.demoCalendar[number]; gapMin: number } | null = null;

  for (const slot of context.demoCalendar) {
    const slotStartMs = slot.start.getTime();
    const slotEndMs = slot.end.getTime();
    // Skip overlaps — that's a conflict, not a neighbor.
    if (slotEndMs > startMs && slotStartMs < endMs) continue;
    const gapBefore = startMs - slotEndMs;
    const gapAfter = slotStartMs - endMs;
    const gap = gapBefore >= 0 ? gapBefore : gapAfter >= 0 ? gapAfter : -1;
    if (gap < 0 || gap > bufferMs) continue;
    const gapMin = Math.round(gap / 60_000);
    if (!closestNeighbor || gapMin < closestNeighbor.gapMin) {
      closestNeighbor = { slot, gapMin };
    }
  }

  if (closestNeighbor) {
    if (closestNeighbor.gapMin <= BACK_TO_BACK_WINDOW_MIN) {
      noticings.push({
        icon: '🔁',
        text: `back-to-back with ${closestNeighbor.slot.title}`,
        tone: 'info',
      });
    } else {
      noticings.push({
        icon: '🫧',
        text: `${closestNeighbor.gapMin}-min buffer before ${closestNeighbor.slot.title}`,
        tone: 'delight',
      });
    }
  }

  // 5. Recorded class — only if this event OVERLAPS a recorded class.
  const overlapped = context.demoCalendar.find((slot) => {
    const slotStart = slot.start.getTime();
    const slotEnd = slot.end.getTime();
    return endMs > slotStart && startMs < slotEnd;
  });

  if (overlapped && RECORDED_CLASS_PATTERNS.some((p) => p.test(overlapped.title))) {
    noticings.push({
      icon: '🎥',
      text: `${overlapped.title.split(/\s+/).slice(0, 3).join(' ')} usually recorded`,
      tone: 'delight',
    });
  }

  // 6. Energy cost preview — heuristic observations about the commitment.
  const durationHours = (endMs - startMs) / (1000 * 60 * 60);
  const startHour = start.getHours();
  const isEvening = startHour >= 18;
  const isWeekend = start.getDay() === 0 || start.getDay() === 6;
  const SOCIAL_CATEGORIES = new Set(['networking', 'career']);

  if (durationHours >= 2.5 && isEvening) {
    noticings.push({
      icon: '🔋',
      text: 'long evening commitment',
      tone: 'info',
    });
  } else if (durationHours >= 3) {
    const hrs = Math.round(durationHours * 10) / 10;
    noticings.push({
      icon: '🔋',
      text: `~${hrs}-hr commitment`,
      tone: 'info',
    });
  }

  if (SOCIAL_CATEGORIES.has(event.category)) {
    noticings.push({
      icon: '💬',
      text: 'social-energy event',
      tone: 'info',
    });
  }

  if (isWeekend) {
    noticings.push({
      icon: '📅',
      text: 'weekend time',
      tone: 'info',
    });
  }

  return noticings;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Invariant enforced by test: no noticing text ever directly tells the user
// what to do. These phrases are banned.
export const FORBIDDEN_PHRASES: string[] = [
  "don't go",
  'do not go',
  'skip this',
  'not recommended',
  'we recommend',
  'you should',
  'you should not',
];
