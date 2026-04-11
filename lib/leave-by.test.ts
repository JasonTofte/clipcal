import { describe, it, expect } from 'vitest';
import { computeLeaveBy } from './leave-by';
import type { Event } from './schema';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    title: 'Test Event',
    start: '2026-04-18T23:00:00Z', // 18:00 Central
    end: '2026-04-19T00:00:00Z',
    location: 'Keller Hall 3-180',
    description: null,
    category: 'networking',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
    ...overrides,
  };
}

describe('computeLeaveBy', () => {
  it('defaults to a 12 minute walk', () => {
    const result = computeLeaveBy(makeEvent());
    expect(result).not.toBeNull();
    expect(result!.walkMinutes).toBe(12);
    const expectedLeaveMs = new Date('2026-04-18T23:00:00Z').getTime() - 12 * 60 * 1000;
    expect(result!.leaveByDate.getTime()).toBe(expectedLeaveMs);
  });

  it('accepts a custom walk duration', () => {
    const result = computeLeaveBy(makeEvent(), 20);
    expect(result!.walkMinutes).toBe(20);
    const expectedLeaveMs = new Date('2026-04-18T23:00:00Z').getTime() - 20 * 60 * 1000;
    expect(result!.leaveByDate.getTime()).toBe(expectedLeaveMs);
  });

  it('returns null when the event has no location', () => {
    expect(computeLeaveBy(makeEvent({ location: null }))).toBeNull();
  });

  it('returns null when the start date is invalid', () => {
    expect(computeLeaveBy(makeEvent({ start: 'not a date' }))).toBeNull();
  });

  it('formats displayText as a clock string', () => {
    const result = computeLeaveBy(makeEvent());
    expect(result!.displayText).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
  });
});
