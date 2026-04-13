import type { Event } from '@/lib/schema';
import { computeLeaveBy, type LeaveByInfo } from '@/lib/leave-by';

// How far ahead we look for "your next thing." Events further than this
// shouldn't crowd the top of the feed.
export const DAY_OF_WINDOW_MS = 6 * 60 * 60 * 1000;

// When the leave-by timestamp is within this window, Goldy's tone shifts
// from informational (gold bubble, "heads-up") to directive (maroon
// bubble, "time to move"). 30 min gives enough lead to actually act.
export const URGENT_WINDOW_MS = 30 * 60 * 1000;

export type DayOfPhase =
  | 'heads-up'    // ≤6h away, not yet urgent
  | 'urgent'      // within 30 min of leave-by
  | 'leaving-now' // past leave-by, not past start
  | 'in-progress' // start has passed
  | 'none';       // nothing to show

export type DayOfState = {
  phase: DayOfPhase;
  event: Event;
  leaveBy: LeaveByInfo | null;
  // Whole-minute countdown, always ≥ 0. For display like "12 min".
  minutesToLeaveBy: number;
  minutesToStart: number;
};

// Find the next event that starts in the future within DAY_OF_WINDOW_MS.
// `events` does not need to be sorted; this handles that.
export function findNextUpcomingEvent(
  events: Event[],
  now: Date = new Date(),
): Event | null {
  const nowMs = now.getTime();
  const horizon = nowMs + DAY_OF_WINDOW_MS;
  let best: { event: Event; startMs: number } | null = null;
  for (const event of events) {
    const startMs = new Date(event.start).getTime();
    if (Number.isNaN(startMs)) continue;
    if (startMs < nowMs) continue; // already started — not "upcoming"
    if (startMs > horizon) continue;
    if (!best || startMs < best.startMs) best = { event, startMs };
  }
  return best?.event ?? null;
}

// Build the full day-of state for the feed's top banner. Returns null
// when there's nothing in the window.
export function computeDayOfState(
  events: Event[],
  now: Date = new Date(),
): DayOfState | null {
  const event = findNextUpcomingEvent(events, now);
  if (!event) return null;

  const leaveBy = computeLeaveBy(event);
  const startMs = new Date(event.start).getTime();
  const nowMs = now.getTime();

  // Events without a location have no leave-by. Fall back to using
  // start-time - 15min as a soft leave threshold so we can still
  // surface them.
  const leaveByMs = leaveBy
    ? leaveBy.leaveByDate.getTime()
    : startMs - 15 * 60 * 1000;

  const msToLeaveBy = leaveByMs - nowMs;
  const msToStart = startMs - nowMs;

  let phase: DayOfPhase;
  if (msToStart <= 0) phase = 'in-progress';
  else if (msToLeaveBy <= 0) phase = 'leaving-now';
  else if (msToLeaveBy <= URGENT_WINDOW_MS) phase = 'urgent';
  else phase = 'heads-up';

  return {
    phase,
    event,
    leaveBy,
    minutesToLeaveBy: Math.max(0, Math.round(msToLeaveBy / (60 * 1000))),
    minutesToStart: Math.max(0, Math.round(msToStart / (60 * 1000))),
  };
}

// Demo / testing override: `?now=2026-04-18T19:47:00Z` on the URL lets
// a presenter freeze "now" to a specific moment so the banner shows a
// deterministic state. Returns null (meaning "use real clock") when the
// param is absent, empty, or unparseable.
export function parseNowOverride(search: string | null | undefined): Date | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = params.get('now');
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
