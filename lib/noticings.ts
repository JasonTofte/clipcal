import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';

export type NoticingTone = 'info' | 'heads-up' | 'delight';

export type Noticing = {
  icon: string;
  text: string;
  tone: NoticingTone;
};

export type NoticingContext = {
  demoCalendar: BusySlot[];
  now?: Date;
  hardcodedWalkMinutes?: number;
};

const DEFAULT_WALK_MINUTES = 12;
const BACK_TO_BACK_WINDOW_MIN = 15;
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

  // 1. Walk time — only when location is non-null.
  if (event.location) {
    const walkMin = context.hardcodedWalkMinutes ?? DEFAULT_WALK_MINUTES;
    noticings.push({
      icon: '🚶',
      text: `${walkMin}-min walk to ${event.location}`,
      tone: 'info',
    });
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

  // 4. Back-to-back — any busy slot whose end is within BACK_TO_BACK_WINDOW_MIN
  //    before event.start, or whose start is within the window after event.end.
  const startMs = start.getTime();
  const endMs = end.getTime();
  const windowMs = BACK_TO_BACK_WINDOW_MIN * 60 * 1000;

  const neighbor = context.demoCalendar.find((slot) => {
    const slotStartMs = slot.start.getTime();
    const slotEndMs = slot.end.getTime();
    // Skip anything that actually overlaps — that's a conflict, not a
    // back-to-back.
    if (slotEndMs > startMs && slotStartMs < endMs) return false;
    const gapBefore = startMs - slotEndMs;
    const gapAfter = slotStartMs - endMs;
    return (
      (gapBefore >= 0 && gapBefore <= windowMs) ||
      (gapAfter >= 0 && gapAfter <= windowMs)
    );
  });

  if (neighbor) {
    noticings.push({
      icon: '🔁',
      text: `back-to-back with ${neighbor.title}`,
      tone: 'info',
    });
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
