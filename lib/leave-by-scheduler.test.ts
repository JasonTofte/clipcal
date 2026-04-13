import { describe, it, expect } from 'vitest';
import { scheduleLeaveByNotifications } from './leave-by-scheduler';
import type { Event } from './schema';

function makeEvent(start: string, location: string | null = 'Walter Library'): Event {
  return {
    title: 'Demo Event',
    start,
    end: null,
    location,
    description: null,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

describe('scheduleLeaveByNotifications', () => {
  const now = new Date('2026-04-13T12:00:00-05:00');

  it('schedules a notification 10 min before leave-by for upcoming events', () => {
    // Event at 2 PM; leave-by is earlier (walk time). Notification fires
    // 10 min before that.
    const events = [makeEvent('2026-04-13T14:00:00-05:00')];
    const out = scheduleLeaveByNotifications(events, now);
    expect(out).toHaveLength(1);
    expect(out[0].fireAt.getTime()).toBeLessThan(
      new Date('2026-04-13T14:00:00-05:00').getTime(),
    );
    expect(out[0].title).toContain('Leave in 10 min');
  });

  it('skips events whose leave-by - 10min has already passed', () => {
    const events = [makeEvent('2026-04-13T12:05:00-05:00')];
    expect(scheduleLeaveByNotifications(events, now)).toHaveLength(0);
  });

  it('skips events more than 24h out', () => {
    const events = [makeEvent('2026-04-15T14:00:00-05:00')];
    expect(scheduleLeaveByNotifications(events, now)).toHaveLength(0);
  });

  it('skips events without a computable leave-by (no location)', () => {
    const events = [makeEvent('2026-04-13T14:00:00-05:00', null)];
    expect(scheduleLeaveByNotifications(events, now)).toHaveLength(0);
  });

  it('deterministic key per event', () => {
    const events = [makeEvent('2026-04-13T14:00:00-05:00')];
    const a = scheduleLeaveByNotifications(events, now);
    const b = scheduleLeaveByNotifications(events, now);
    expect(a[0].key).toBe(b[0].key);
  });
});
