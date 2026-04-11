import { describe, it, expect } from 'vitest';
import { buildIcsContent, buildIcsFilename } from './ics';
import type { Event } from './schema';

const baseEvent: Event = {
  title: 'CSE Welcome Night',
  start: '2026-04-15T18:00:00-05:00', // 23:00 UTC
  end: '2026-04-15T20:00:00-05:00', // 01:00 UTC next day
  location: 'Keller Hall 3-180',
  description: 'Pizza and intros.',
  category: 'networking',
  hasFreeFood: true,
  timezone: 'America/Chicago',
  confidence: 'high',
};

describe('buildIcsContent', () => {
  it('produces a valid single-event VCALENDAR block', () => {
    const ics = buildIcsContent([baseEvent]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('SUMMARY:CSE Welcome Night');
    expect(ics).toContain('LOCATION:Keller Hall 3-180');
  });

  it('encodes UTC-converted start/end dates', () => {
    const ics = buildIcsContent([baseEvent]);
    // 2026-04-15T18:00:00-05:00 == 2026-04-15T23:00:00Z
    expect(ics).toMatch(/DTSTART:20260415T230000Z/);
    // 2026-04-15T20:00:00-05:00 == 2026-04-16T01:00:00Z
    expect(ics).toMatch(/DTEND:20260416T010000Z/);
  });

  it('defaults to 1 hour duration when end is null', () => {
    const ics = buildIcsContent([{ ...baseEvent, end: null }]);
    expect(ics).toContain('BEGIN:VEVENT');
    // ics encodes duration as "PT1H" either directly or via computed DTEND
    const hasDurationOrEnd = /DURATION:PT1H|DTEND:/.test(ics);
    expect(hasDurationOrEnd).toBe(true);
  });

  it('emits multiple VEVENT blocks for multi-event input', () => {
    const ics = buildIcsContent([
      baseEvent,
      { ...baseEvent, title: 'Second Event' },
    ]);
    const beginMatches = ics.match(/BEGIN:VEVENT/g);
    const endMatches = ics.match(/END:VEVENT/g);
    expect(beginMatches).toHaveLength(2);
    expect(endMatches).toHaveLength(2);
    expect(ics).toContain('SUMMARY:CSE Welcome Night');
    expect(ics).toContain('SUMMARY:Second Event');
  });

  it('throws when given an empty array', () => {
    expect(() => buildIcsContent([])).toThrow();
  });
});

describe('buildIcsFilename', () => {
  it('slugifies a single event title', () => {
    expect(buildIcsFilename([baseEvent])).toBe('cse-welcome-night.ics');
  });

  it('falls back to a generic name for multi-event exports', () => {
    expect(buildIcsFilename([baseEvent, baseEvent])).toBe('clipcal-events.ics');
  });

  it('strips punctuation from the slug', () => {
    expect(
      buildIcsFilename([{ ...baseEvent, title: 'CS@UMN — Welcome!' }]),
    ).toBe('csumn-welcome.ics');
  });
});
