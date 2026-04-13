import { describe, it, expect } from 'vitest';
import { parseIcs } from './ics-parse';

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:evt-1@example.com
SUMMARY:CS Club Tuesday Meetup
DTSTART;TZID=America/Chicago:20260414T180000
DTEND;TZID=America/Chicago:20260414T200000
LOCATION:Walter Library 101
DESCRIPTION:Weekly meetup for CS enthusiasts.
ORGANIZER;CN="CS Club":mailto:csclub@umn.edu
CATEGORIES:academic,social
URL:https://gopherlink.umn.edu/events/evt-1
END:VEVENT
BEGIN:VEVENT
UID:evt-2@example.com
SUMMARY:Improv Night
DTSTART:20260415T193000Z
END:VEVENT
END:VCALENDAR`;

describe('parseIcs', () => {
  it('parses a standard VEVENT with timezone-prefixed DTSTART', () => {
    const events = parseIcs(SAMPLE);
    expect(events).toHaveLength(2);

    const cs = events[0];
    expect(cs.summary).toBe('CS Club Tuesday Meetup');
    expect(cs.location).toBe('Walter Library 101');
    expect(cs.organizer).toBe('CS Club');
    expect(cs.categories).toEqual(['academic', 'social']);
    expect(cs.url).toBe('https://gopherlink.umn.edu/events/evt-1');
    // DTSTART with TZID should resolve to a valid ISO string
    expect(cs.dtstart).toMatch(/^2026-04-14T\d{2}:00:00/);
  });

  it('parses a UTC DTSTART without TZID', () => {
    const events = parseIcs(SAMPLE);
    const improv = events[1];
    expect(improv.summary).toBe('Improv Night');
    expect(improv.dtstart).toBe('2026-04-15T19:30:00.000Z');
  });

  it('skips events without a summary', () => {
    const noSummary = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:empty
DTSTART:20260420T120000Z
END:VEVENT
END:VCALENDAR`;
    expect(parseIcs(noSummary)).toHaveLength(0);
  });

  it('returns empty array for non-ICS input', () => {
    expect(parseIcs('not ics')).toEqual([]);
  });
});
