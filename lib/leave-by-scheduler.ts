import type { Event } from '@/lib/schema';
import { computeLeaveBy } from '@/lib/leave-by';

export type ScheduledNotification = {
  key: string;
  fireAt: Date;
  title: string;
  body: string;
};

const LEAD_MINUTES = 10;
const LEAD_MS = LEAD_MINUTES * 60 * 1000;
const LOOK_AHEAD_MS = 24 * 60 * 60 * 1000;

// Pure: returns notifications to schedule for events whose leave-by is
// between `now` and `now + 24h`, firing LEAD_MINUTES before leave-by.
// Events without a computable leave-by (missing location/start) are skipped.
export function scheduleLeaveByNotifications(
  events: Event[],
  now: Date = new Date(),
): ScheduledNotification[] {
  const out: ScheduledNotification[] = [];
  for (const event of events) {
    const leaveBy = computeLeaveBy(event);
    if (!leaveBy) continue;
    const leaveByMs = leaveBy.leaveByDate.getTime();
    const fireMs = leaveByMs - LEAD_MS;
    const nowMs = now.getTime();
    if (fireMs <= nowMs) continue;
    if (fireMs > nowMs + LOOK_AHEAD_MS) continue;
    out.push({
      key: `${event.start}__${event.title}`,
      fireAt: new Date(fireMs),
      title: `Leave in ${LEAD_MINUTES} min — ${event.title}`,
      body: event.location
        ? `${leaveBy.walkMinutes}-min walk to ${event.location.split(',')[0]}`
        : `${leaveBy.walkMinutes}-min walk`,
    });
  }
  return out;
}
