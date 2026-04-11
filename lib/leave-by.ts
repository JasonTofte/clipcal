import type { Event } from '@/lib/schema';

export type LeaveByInfo = {
  leaveByDate: Date;
  walkMinutes: number;
  displayText: string;
};

const DEFAULT_WALK_MINUTES = 12;

export function computeLeaveBy(
  event: Event,
  walkMinutes: number = DEFAULT_WALK_MINUTES,
): LeaveByInfo | null {
  // "Leave by" without knowing where you're going is meaningless.
  if (!event.location) return null;

  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return null;

  const leaveByDate = new Date(start.getTime() - walkMinutes * 60 * 1000);
  return {
    leaveByDate,
    walkMinutes,
    displayText: formatClockTime(leaveByDate),
  };
}

function formatClockTime(date: Date): string {
  // Display in the user's local TZ — matches how they'd read any other
  // clock on their phone.
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${hours12}:${paddedMinutes} ${period}`;
}
