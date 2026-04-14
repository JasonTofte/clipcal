import { describe, it, expect } from 'vitest';
import { generateNoticings, FORBIDDEN_PHRASES, type Noticing } from './noticings';
import type { BusySlot } from './demo-calendar';
import type { Event } from './schema';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    title: 'Test Event',
    start: '2026-04-18T20:00:00Z', // Sat 20:00 UTC
    end: '2026-04-18T21:00:00Z',
    location: 'Keller Hall 3-180',
    description: null,
    category: 'networking',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
    ...overrides,
  };
}

function makeSlot(title: string, startIso: string, endIso: string): BusySlot {
  return { title, start: new Date(startIso), end: new Date(endIso) };
}

const EMPTY_CONTEXT = { demoCalendar: [] as BusySlot[] };

describe('generateNoticings', () => {
  it('returns the walk noticing when destinationCoords is provided', () => {
    const result = generateNoticings(makeEvent(), {
      demoCalendar: [],
      destinationCoords: { lat: 44.9740, lng: -93.2353 }, // near Coffman
    });
    expect(result.some((n) => n.icon === '🚶' && /walk/i.test(n.text))).toBe(true);
  });

  it('omits the walk noticing when location is null', () => {
    const result = generateNoticings(makeEvent({ location: null }), EMPTY_CONTEXT);
    expect(result.some((n) => n.icon === '🚶')).toBe(false);
  });

  it('omits the walk noticing when destinationCoords is not yet resolved (no fabrication)', () => {
    // Event has a location string but geocode hasn't resolved yet.
    const result = generateNoticings(makeEvent(), EMPTY_CONTEXT);
    expect(result.some((n) => n.icon === '🚶')).toBe(false);
  });

  it('respects a custom hardcodedWalkMinutes value (test-only override)', () => {
    const result = generateNoticings(makeEvent(), {
      demoCalendar: [],
      hardcodedWalkMinutes: 7,
    });
    const walk = result.find((n) => n.icon === '🚶');
    expect(walk?.text).toContain('7-min');
  });

  it('labels walk as "from campus" when originCoords is absent (UMN fallback)', () => {
    const result = generateNoticings(makeEvent(), {
      demoCalendar: [],
      destinationCoords: { lat: 44.9720, lng: -93.2353 },
    });
    const walk = result.find((n) => n.icon === '🚶');
    expect(walk?.text).toMatch(/from campus/);
  });

  it('labels walk as "to {location}" when originCoords is set (home address)', () => {
    const result = generateNoticings(makeEvent(), {
      demoCalendar: [],
      originCoords: { lat: 44.96, lng: -93.25 },
      destinationCoords: { lat: 44.9720, lng: -93.2353 },
    });
    const walk = result.find((n) => n.icon === '🚶');
    expect(walk?.text).toMatch(/walk to/);
  });

  it('flags "first open {day}" when nothing is busy on that day', () => {
    const result = generateNoticings(makeEvent(), EMPTY_CONTEXT);
    const first = result.find((n) => n.icon === '✨');
    expect(first).toBeDefined();
    expect(first?.text).toContain('Saturday');
  });

  it('does not flag "first open" when a busy slot exists that day', () => {
    const busy = [
      makeSlot('Gym', '2026-04-18T10:00:00Z', '2026-04-18T11:00:00Z'),
    ];
    const result = generateNoticings(makeEvent(), { demoCalendar: busy });
    expect(result.some((n) => n.icon === '✨')).toBe(false);
  });

  it('emits 🔁 back-to-back when a busy slot ends within 15 minutes of the event start', () => {
    const busy = [
      makeSlot('Lecture', '2026-04-18T19:00:00Z', '2026-04-18T19:50:00Z'),
    ];
    const result = generateNoticings(makeEvent(), { demoCalendar: busy });
    expect(result.some((n) => n.icon === '🔁' && n.text.includes('Lecture'))).toBe(true);
  });

  it('does not emit back-to-back when the gap is > 15 minutes', () => {
    const busy = [
      makeSlot('Lecture', '2026-04-18T17:00:00Z', '2026-04-18T17:30:00Z'),
    ];
    const result = generateNoticings(makeEvent(), { demoCalendar: busy });
    expect(result.some((n) => n.icon === '🔁')).toBe(false);
  });

  it('emits 🎥 recorded-class noticing when the event overlaps CSCI 5801', () => {
    const busy = [
      makeSlot('CSCI 5801 Software Engineering I', '2026-04-18T19:30:00Z', '2026-04-18T20:30:00Z'),
    ];
    const result = generateNoticings(makeEvent(), { demoCalendar: busy });
    expect(result.some((n) => n.icon === '🎥' && /recorded/i.test(n.text))).toBe(true);
  });

  it('does NOT emit recorded-class noticing without an overlap', () => {
    // Adjacent slot, not overlapping
    const busy = [
      makeSlot('CSCI 5801 Software Engineering I', '2026-04-18T21:00:00Z', '2026-04-18T22:00:00Z'),
    ];
    const result = generateNoticings(makeEvent(), { demoCalendar: busy });
    expect(result.some((n) => n.icon === '🎥')).toBe(false);
  });

  it('handles null end by defaulting to 1 hour duration', () => {
    const result = generateNoticings(makeEvent({ end: null }), EMPTY_CONTEXT);
    // Should still produce noticings without crashing
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns an empty array for invalid start date', () => {
    const result = generateNoticings(makeEvent({ start: 'not a date' }), EMPTY_CONTEXT);
    expect(result).toEqual([]);
  });

  describe('invariant: never tells the user what to do', () => {
    // Run a fuzz-ish test against a range of synthetic scenarios, then
    // assert no forbidden phrase appears in any noticing text.
    const scenarios: { event: Event; calendar: BusySlot[] }[] = [
      { event: makeEvent(), calendar: [] },
      {
        event: makeEvent(),
        calendar: [
          makeSlot('CSCI 5801', '2026-04-18T19:30:00Z', '2026-04-18T20:30:00Z'),
        ],
      },
      {
        event: makeEvent({ location: null }),
        calendar: [
          makeSlot('Gym', '2026-04-18T18:00:00Z', '2026-04-18T19:00:00Z'),
        ],
      },
      {
        event: makeEvent({ title: 'All-nighter', end: null }),
        calendar: [
          makeSlot('Early lecture', '2026-04-19T08:00:00Z', '2026-04-19T09:00:00Z'),
        ],
      },
    ];

    for (const { event, calendar } of scenarios) {
      it(`has no forbidden phrase for "${event.title}" with ${calendar.length} busy slot(s)`, () => {
        const result = generateNoticings(event, { demoCalendar: calendar });
        const allText = result.map((n) => n.text.toLowerCase()).join(' | ');
        for (const phrase of FORBIDDEN_PHRASES) {
          expect(allText).not.toContain(phrase.toLowerCase());
        }
      });
    }
  });
});
