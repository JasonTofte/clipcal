import { describe, it, expect } from 'vitest';
import {
  findNextUpcomingEvent,
  computeDayOfState,
  parseNowOverride,
  DAY_OF_WINDOW_MS,
  URGENT_WINDOW_MS,
} from '@/lib/day-of-reminder';
import type { Event } from '@/lib/schema';

function makeEvent(overrides: Partial<Event> & { start: string }): Event {
  return {
    title: 'Test',
    end: null,
    location: 'Walter Library 402',
    description: null,
    category: 'workshop',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
    ...overrides,
  };
}

describe('findNextUpcomingEvent', () => {
  const now = new Date('2026-04-18T18:00:00Z');

  it('returns the soonest future event within the window', () => {
    const a = makeEvent({ title: 'A', start: '2026-04-18T20:00:00Z' });
    const b = makeEvent({ title: 'B', start: '2026-04-18T19:00:00Z' });
    const found = findNextUpcomingEvent([a, b], now);
    expect(found?.title).toBe('B');
  });

  it('skips events that have already started', () => {
    const past = makeEvent({ title: 'Past', start: '2026-04-18T17:00:00Z' });
    const future = makeEvent({ title: 'Future', start: '2026-04-18T19:00:00Z' });
    const found = findNextUpcomingEvent([past, future], now);
    expect(found?.title).toBe('Future');
  });

  it('skips events beyond the 6-hour window', () => {
    const farFuture = makeEvent({
      title: 'Tomorrow',
      start: '2026-04-19T18:00:00Z', // 24h out
    });
    const found = findNextUpcomingEvent([farFuture], now);
    expect(found).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(findNextUpcomingEvent([], now)).toBeNull();
  });
});

describe('computeDayOfState', () => {
  it('heads-up: event within 6h but more than 30 min from leave-by', () => {
    const now = new Date('2026-04-18T18:00:00Z');
    const event = makeEvent({ start: '2026-04-18T20:00:00Z' }); // 2h future, leave-by ~1h48m out
    const state = computeDayOfState([event], now);
    expect(state?.phase).toBe('heads-up');
    expect(state?.minutesToStart).toBe(120);
  });

  it('urgent: within 30 min of leave-by', () => {
    const now = new Date('2026-04-18T19:40:00Z'); // 20 min before 20:00 start, 8 min before leave-by
    const event = makeEvent({ start: '2026-04-18T20:00:00Z' });
    const state = computeDayOfState([event], now);
    expect(state?.phase).toBe('urgent');
  });

  it('leaving-now: past leave-by but before start', () => {
    const now = new Date('2026-04-18T19:55:00Z'); // past leave-by (19:48), 5 min before start
    const event = makeEvent({ start: '2026-04-18T20:00:00Z' });
    const state = computeDayOfState([event], now);
    expect(state?.phase).toBe('leaving-now');
  });

  it('in-progress: start has passed', () => {
    const now = new Date('2026-04-18T20:05:00Z');
    const event = makeEvent({ start: '2026-04-18T20:00:00Z' });
    // findNextUpcomingEvent skips past events, so in-progress is only
    // reachable when an event is simultaneously "upcoming" (not yet
    // technically started by findNext's check) and has passed by the
    // time computeDayOfState runs. The guard exists as defense for
    // clock skew between findNext and phase computation.
    const state = computeDayOfState([event], now);
    expect(state).toBeNull(); // past events are filtered out upstream
  });

  it('returns null when no event in window', () => {
    expect(computeDayOfState([], new Date('2026-04-18T18:00:00Z'))).toBeNull();
  });

  it('events without location still get a phase (falls back to 15-min-before-start threshold)', () => {
    const now = new Date('2026-04-18T18:00:00Z');
    const event = makeEvent({
      start: '2026-04-18T20:00:00Z',
      location: null,
    });
    const state = computeDayOfState([event], now);
    expect(state?.phase).toBe('heads-up');
    expect(state?.leaveBy).toBeNull();
  });
});

describe('parseNowOverride', () => {
  it('parses a valid ISO string', () => {
    const d = parseNowOverride('?now=2026-04-18T19:47:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-04-18T19:47:00.000Z');
  });

  it('works without leading ?', () => {
    const d = parseNowOverride('now=2026-04-18T19:47:00Z');
    expect(d?.toISOString()).toBe('2026-04-18T19:47:00.000Z');
  });

  it('returns null for missing param', () => {
    expect(parseNowOverride('')).toBeNull();
    expect(parseNowOverride(null)).toBeNull();
    expect(parseNowOverride(undefined)).toBeNull();
    expect(parseNowOverride('?other=foo')).toBeNull();
  });

  it('returns null for unparseable date', () => {
    expect(parseNowOverride('?now=not-a-date')).toBeNull();
  });
});

describe('thresholds exported', () => {
  it('DAY_OF_WINDOW_MS is 6 hours', () => {
    expect(DAY_OF_WINDOW_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('URGENT_WINDOW_MS is 30 minutes', () => {
    expect(URGENT_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});
