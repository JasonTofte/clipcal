import { describe, it, expect } from 'vitest';
import { checkConflict } from './conflict';
import type { BusySlot } from './demo-calendar';
import type { Event } from './schema';

function makeEvent(start: string, end: string | null): Event {
  return {
    title: 'Test Event',
    start,
    end,
    location: null,
    description: null,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

function makeSlot(title: string, startIso: string, endIso: string): BusySlot {
  return { title, start: new Date(startIso), end: new Date(endIso) };
}

describe('checkConflict', () => {
  const lecture = makeSlot(
    'CSCI 5801',
    '2026-04-14T23:00:00Z', // 18:00 Central
    '2026-04-15T00:15:00Z', // 19:15 Central
  );

  it('returns free when no slots overlap', () => {
    const event = makeEvent('2026-04-15T01:00:00Z', '2026-04-15T02:00:00Z');
    expect(checkConflict(event, [lecture])).toEqual({ status: 'free' });
  });

  it('detects event starting during a busy slot', () => {
    const event = makeEvent('2026-04-14T23:30:00Z', '2026-04-15T00:30:00Z');
    expect(checkConflict(event, [lecture])).toEqual({
      status: 'overlaps',
      conflictTitle: 'CSCI 5801',
    });
  });

  it('detects event ending during a busy slot', () => {
    const event = makeEvent('2026-04-14T22:00:00Z', '2026-04-14T23:30:00Z');
    expect(checkConflict(event, [lecture])).toEqual({
      status: 'overlaps',
      conflictTitle: 'CSCI 5801',
    });
  });

  it('detects busy slot fully inside event', () => {
    const event = makeEvent('2026-04-14T22:00:00Z', '2026-04-15T01:00:00Z');
    expect(checkConflict(event, [lecture]).status).toBe('overlaps');
  });

  it('detects event fully inside busy slot', () => {
    const event = makeEvent('2026-04-14T23:15:00Z', '2026-04-14T23:45:00Z');
    expect(checkConflict(event, [lecture]).status).toBe('overlaps');
  });

  it('treats edge-touching (end === slotStart) as free', () => {
    const event = makeEvent('2026-04-14T22:00:00Z', '2026-04-14T23:00:00Z');
    expect(checkConflict(event, [lecture])).toEqual({ status: 'free' });
  });

  it('treats edge-touching (start === slotEnd) as free', () => {
    const event = makeEvent('2026-04-15T00:15:00Z', '2026-04-15T01:00:00Z');
    expect(checkConflict(event, [lecture])).toEqual({ status: 'free' });
  });

  it('defaults null end to 1 hour duration', () => {
    const event = makeEvent('2026-04-14T22:30:00Z', null);
    // 22:30 + 1h = 23:30, which overlaps lecture [23:00, 00:15]
    expect(checkConflict(event, [lecture]).status).toBe('overlaps');
  });

  it('reports the first matching slot title', () => {
    const event = makeEvent('2026-04-14T23:30:00Z', '2026-04-15T00:30:00Z');
    const slots = [lecture, makeSlot('Other', '2026-04-14T23:00:00Z', '2026-04-15T00:00:00Z')];
    expect(checkConflict(event, slots)).toEqual({
      status: 'overlaps',
      conflictTitle: 'CSCI 5801',
    });
  });

  it('returns free when busy list is empty', () => {
    const event = makeEvent('2026-04-14T23:30:00Z', '2026-04-15T00:30:00Z');
    expect(checkConflict(event, [])).toEqual({ status: 'free' });
  });
});
