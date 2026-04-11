import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';

export type ConflictResult =
  | { status: 'free' }
  | { status: 'overlaps'; conflictTitle: string };

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export function checkConflict(event: Event, busy: BusySlot[]): ConflictResult {
  const start = new Date(event.start).getTime();
  if (Number.isNaN(start)) return { status: 'free' };

  const end = event.end ? new Date(event.end).getTime() : start + DEFAULT_DURATION_MS;

  for (const slot of busy) {
    const slotStart = slot.start.getTime();
    const slotEnd = slot.end.getTime();
    // Overlap: event's interval and slot's interval share at least one instant.
    // Edge-touching (end === slotStart or start === slotEnd) is NOT a conflict.
    if (end > slotStart && start < slotEnd) {
      return { status: 'overlaps', conflictTitle: slot.title };
    }
  }

  return { status: 'free' };
}
