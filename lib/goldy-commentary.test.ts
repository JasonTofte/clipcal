import { describe, it, expect } from 'vitest';
import { buildContext, pickGoldyLine } from '@/lib/goldy-commentary';
import type { GoldyBucket, GoldyContext } from '@/lib/goldy-commentary';
import type { Event } from '@/lib/schema';
import type { BusySlot } from '@/lib/demo-calendar';

// ---------------------------------------------------------------------------
// Shared factory helpers
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<Event> & { start: string },
): Event {
  return {
    title: 'Test Event',
    end: null,
    location: null,
    description: null,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
    ...overrides,
  };
}

function makeSlot(title: string, startIso: string, endIso: string): BusySlot {
  return { title, start: new Date(startIso), end: new Date(endIso) };
}

// A weekday midday event with no special signals — reliably lands in 'default'
const PLAIN_WEEKDAY_EVENT = makeEvent({
  title: 'Boring Seminar',
  start: '2026-04-14T15:00:00Z', // Tuesday 10 AM Central — weekday, midday
  end: '2026-04-14T16:00:00Z',
  hasFreeFood: false,
  category: 'other',
});

// ---------------------------------------------------------------------------
// buildContext
// ---------------------------------------------------------------------------

describe('buildContext', () => {
  describe('AC-1: conflict bucket (happy path)', () => {
    it('AC-1: returns conflict bucket when event overlaps a busy slot', () => {
      // Arrange
      const lecture = makeSlot(
        'CSCI 5801',
        '2026-04-14T23:00:00Z',
        '2026-04-15T00:15:00Z',
      );
      const event = makeEvent({
        start: '2026-04-14T23:30:00Z',
        end: '2026-04-15T00:30:00Z',
      });

      // Act
      const ctx = buildContext(event, [lecture], [event]);

      // Assert
      expect(ctx.bucket).toBe('conflict');
    });

    it('AC-1: slots.conflictTitle equals the overlapping slot title', () => {
      // Arrange
      const lecture = makeSlot(
        'CSCI 5801',
        '2026-04-14T23:00:00Z',
        '2026-04-15T00:15:00Z',
      );
      const event = makeEvent({
        start: '2026-04-14T23:30:00Z',
        end: '2026-04-15T00:30:00Z',
      });

      // Act
      const ctx = buildContext(event, [lecture], [event]);

      // Assert
      expect(ctx.slots.conflictTitle).toBe('CSCI 5801');
    });

    it('AC-1: picks the first conflicting slot when multiple overlap', () => {
      // Arrange
      const first = makeSlot('First Class', '2026-04-14T23:00:00Z', '2026-04-15T00:15:00Z');
      const second = makeSlot('Second Class', '2026-04-14T23:00:00Z', '2026-04-15T00:15:00Z');
      const event = makeEvent({
        start: '2026-04-14T23:30:00Z',
        end: '2026-04-15T00:30:00Z',
      });

      // Act
      const ctx = buildContext(event, [first, second], [event]);

      // Assert
      expect(ctx.bucket).toBe('conflict');
      expect(ctx.slots.conflictTitle).toBe('First Class');
    });
  });

  describe('free-food bucket', () => {
    it('returns free-food bucket when hasFreeFood is true and no conflict', () => {
      // Arrange
      const event = makeEvent({
        title: 'Pizza Social Hour',
        start: '2026-04-14T19:00:00Z',
        end: '2026-04-14T20:00:00Z',
        hasFreeFood: true,
        category: 'social',
      });

      // Act
      const ctx = buildContext(event, [], [event]);

      // Assert
      expect(ctx.bucket).toBe('free-food');
    });

    it('free-food: slots.foodHint is a non-empty string', () => {
      // Arrange
      const event = makeEvent({
        title: 'Taco Tuesday Networking',
        start: '2026-04-14T19:00:00Z',
        end: '2026-04-14T20:00:00Z',
        hasFreeFood: true,
        category: 'networking',
      });

      // Act
      const ctx = buildContext(event, [], [event]);

      // Assert
      expect(typeof ctx.slots.foodHint).toBe('string');
      expect(ctx.slots.foodHint!.length).toBeGreaterThan(0);
    });

    it('conflict beats free-food in priority order', () => {
      // Arrange
      const lecture = makeSlot(
        'CSCI 5801',
        '2026-04-14T23:00:00Z',
        '2026-04-15T00:15:00Z',
      );
      const event = makeEvent({
        title: 'Free Pizza Night',
        start: '2026-04-14T23:30:00Z',
        end: '2026-04-15T00:30:00Z',
        hasFreeFood: true,
      });

      // Act
      const ctx = buildContext(event, [lecture], [event]);

      // Assert — conflict should win
      expect(ctx.bucket).toBe('conflict');
    });
  });

  describe('interest-match bucket', () => {
    it('returns interest-match when event category matches a user interest and no conflict/gameday', () => {
      // Arrange
      const event = makeEvent({
        title: 'Hackathon Kickoff',
        start: '2026-04-14T15:00:00Z',
        end: '2026-04-14T18:00:00Z',
        category: 'hackathon',
        hasFreeFood: false,
      });

      // Act
      const ctx = buildContext(event, [], [event], ['hackathon']);

      // Assert
      expect(ctx.bucket).toBe('interest-match');
    });

    it('interest-match: slots.interestHit contains the matched interest', () => {
      // Arrange
      const event = makeEvent({
        title: 'Hackathon Kickoff',
        start: '2026-04-14T15:00:00Z',
        end: '2026-04-14T18:00:00Z',
        category: 'hackathon',
      });

      // Act
      const ctx = buildContext(event, [], [event], ['hackathon']);

      // Assert
      expect(ctx.slots.interestHit).toContain('hackathon');
    });

    it('interest-match: matches when "hack" appears in the event title and interest is hackathon', () => {
      // Arrange
      const event = makeEvent({
        title: 'Hack for Good — spring edition',
        start: '2026-04-14T15:00:00Z',
        end: '2026-04-14T18:00:00Z',
        category: 'other',
      });

      // Act
      const ctx = buildContext(event, [], [event], ['hackathon']);

      // Assert
      expect(ctx.bucket).toBe('interest-match');
    });

    it('no interest-match when interests array is empty', () => {
      // Arrange
      const event = makeEvent({
        title: 'Hackathon Kickoff',
        start: '2026-04-14T15:00:00Z',
        end: '2026-04-14T18:00:00Z',
        category: 'hackathon',
      });

      // Act — no interests passed
      const ctx = buildContext(event, [], [event], []);

      // Assert — should NOT be interest-match
      expect(ctx.bucket).not.toBe('interest-match');
    });
  });

  describe('AC-5: default bucket', () => {
    it('AC-5: returns default when no special signal applies', () => {
      // Arrange — plain weekday event, no conflict, no food, no interests
      const ctx = buildContext(PLAIN_WEEKDAY_EVENT, [], [PLAIN_WEEKDAY_EVENT]);

      // Assert
      expect(ctx.bucket).toBe('default');
    });

    it('AC-5: returns default when hasFreeFood is explicitly false with no other signals', () => {
      // Arrange
      const event = makeEvent({
        title: 'Dry Lecture',
        start: '2026-04-14T15:00:00Z',
        end: '2026-04-14T16:00:00Z',
        hasFreeFood: false,
        category: 'cs',
      });

      // Act
      const ctx = buildContext(event, [], [event]);

      // Assert
      expect(ctx.bucket).toBe('default');
    });
  });
});

// ---------------------------------------------------------------------------
// pickGoldyLine
// ---------------------------------------------------------------------------

describe('pickGoldyLine', () => {
  describe('AC-4: determinism', () => {
    it('AC-4: calling pickGoldyLine twice with the same inputs returns the identical string', () => {
      // Arrange
      const event = PLAIN_WEEKDAY_EVENT;
      const ctx = buildContext(event, [], [event]);

      // Act
      const first = pickGoldyLine(event, ctx);
      const second = pickGoldyLine(event, ctx);

      // Assert
      expect(first).toBe(second);
    });

    it('AC-4: per-event variety — at least one pair of distinct events with identical contexts yields a different line', () => {
      // Arrange — 5+ events with different start/title combos but same bucket (default)
      const variants = [
        makeEvent({ title: 'Alpha Talk',   start: '2026-04-14T13:00:00Z', end: '2026-04-14T14:00:00Z' }),
        makeEvent({ title: 'Beta Session', start: '2026-04-14T14:00:00Z', end: '2026-04-14T15:00:00Z' }),
        makeEvent({ title: 'Gamma Panel',  start: '2026-04-14T15:00:00Z', end: '2026-04-14T16:00:00Z' }),
        makeEvent({ title: 'Delta Forum',  start: '2026-04-14T16:00:00Z', end: '2026-04-14T17:00:00Z' }),
        makeEvent({ title: 'Epsilon Expo', start: '2026-04-14T17:00:00Z', end: '2026-04-14T18:00:00Z' }),
        makeEvent({ title: 'Zeta Seminar', start: '2026-04-14T18:00:00Z', end: '2026-04-14T19:00:00Z' }),
      ];

      // Build a shared default context — all events have no special signals
      const sharedCtx: GoldyContext = { bucket: 'default', slots: {} };

      // Act — collect all lines
      const lines = variants.map((ev) => pickGoldyLine(ev, sharedCtx));

      // Assert — not ALL lines are identical (proving per-event hash varies output)
      const unique = new Set(lines);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('AC-5: no placeholder leakage in default bucket output', () => {
    it('AC-5: pickGoldyLine returns a non-empty string for a default-bucket context', () => {
      // Arrange
      const ctx = buildContext(PLAIN_WEEKDAY_EVENT, [], [PLAIN_WEEKDAY_EVENT]);

      // Act
      const line = pickGoldyLine(PLAIN_WEEKDAY_EVENT, ctx);

      // Assert
      expect(line.length).toBeGreaterThan(0);
    });

    it('AC-5: output contains no unsubstituted {{...}} placeholders', () => {
      // Arrange
      const ctx = buildContext(PLAIN_WEEKDAY_EVENT, [], [PLAIN_WEEKDAY_EVENT]);

      // Act
      const line = pickGoldyLine(PLAIN_WEEKDAY_EVENT, ctx);

      // Assert
      expect(line).not.toContain('{{');
    });
  });

  describe('AC-6: unknown bucket falls back to default without throwing', () => {
    it('AC-6: does not throw when bucket is an unrecognized string', () => {
      // Arrange
      const ctx: GoldyContext = {
        // @ts-expect-error — intentionally passing an invalid bucket to test fallback
        bucket: 'totally-made-up-bucket',
        slots: {},
      };

      // Act + Assert — must not throw
      expect(() => pickGoldyLine(PLAIN_WEEKDAY_EVENT, ctx)).not.toThrow();
    });

    it('AC-6: returns a non-empty string for an unrecognized bucket', () => {
      // Arrange
      const ctx: GoldyContext = {
        // @ts-expect-error — intentionally passing an invalid bucket to test fallback
        bucket: 'totally-made-up-bucket',
        slots: {},
      };

      // Act
      const line = pickGoldyLine(PLAIN_WEEKDAY_EVENT, ctx);

      // Assert
      expect(line.length).toBeGreaterThan(0);
    });
  });

  describe('slot substitution — conflict title in output', () => {
    it('returned line contains the literal conflict title when bucket is conflict', () => {
      // Arrange
      const lecture = makeSlot(
        'CSCI 5801',
        '2026-04-14T23:00:00Z',
        '2026-04-15T00:15:00Z',
      );
      const event = makeEvent({
        title: 'Hack Night',
        start: '2026-04-14T23:30:00Z',
        end: '2026-04-15T00:30:00Z',
      });
      const ctx = buildContext(event, [lecture], [event]);

      // Sanity: confirm we're in the right bucket
      expect(ctx.bucket).toBe('conflict');

      // Act
      const line = pickGoldyLine(event, ctx);

      // Assert — the slot must have been substituted, not left as {{conflictTitle}}
      expect(line).toContain('CSCI 5801');
      expect(line).not.toContain('{{conflictTitle}}');
    });
  });
});

// ---------------------------------------------------------------------------
// Follow-up coverage — remaining buckets + slot substitution in output
// ---------------------------------------------------------------------------

describe('buildContext — remaining bucket paths', () => {
  it('top-pick-gameday: sports category triggers bucket', () => {
    const event = makeEvent({
      start: '2026-04-18T19:30:00Z',
      title: 'Gophers vs Badgers',
      category: 'sports',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).toBe('top-pick-gameday');
  });

  it('top-pick-gameday: title keyword ("stadium") triggers bucket', () => {
    const event = makeEvent({
      start: '2026-04-18T19:30:00Z',
      title: 'Huntington Bank Stadium tour',
      category: 'other',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).toBe('top-pick-gameday');
  });

  it('back-to-back: adjacent event within 90 min selects bucket and populates nextEventTitle', () => {
    const target = makeEvent({
      start: '2026-04-14T15:00:00Z',
      end: '2026-04-14T16:00:00Z',
      title: 'Target',
      location: 'Keller Hall',
    });
    const next = makeEvent({
      start: '2026-04-14T17:00:00Z',
      end: '2026-04-14T18:00:00Z',
      title: 'Next Thing',
      location: 'Walter Library',
    });
    const ctx = buildContext(target, [], [target, next]);
    expect(ctx.bucket).toBe('back-to-back');
    expect(ctx.slots.nextEventTitle).toBe('Next Thing');
    expect(ctx.slots.walkMinutes).toBeGreaterThan(0);
  });

  it('back-to-back: same-venue adjacent events leave walkMinutes undefined', () => {
    const target = makeEvent({
      start: '2026-04-14T15:00:00Z',
      end: '2026-04-14T16:00:00Z',
      title: 'Target',
      location: 'Walter Library',
    });
    const next = makeEvent({
      start: '2026-04-14T17:00:00Z',
      end: '2026-04-14T18:00:00Z',
      title: 'Next',
      location: 'Walter Library',
    });
    const ctx = buildContext(target, [], [target, next]);
    expect(ctx.bucket).toBe('back-to-back');
    expect(ctx.slots.walkMinutes).toBeUndefined();
  });

  it('late-night: event at 10pm America/Chicago lands in late-night bucket', () => {
    const event = makeEvent({
      start: '2026-04-16T03:00:00Z', // Wed 22:00 CT
      title: 'Evening thing',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).toBe('late-night');
  });

  it('late-night: a 3pm America/Chicago event does NOT fall in late-night (regression: UTC bug)', () => {
    const event = makeEvent({
      start: '2026-04-15T20:00:00Z', // Wed 15:00 CT — would have been flagged late-night under the old UTC-hour check
      title: 'Afternoon thing',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).not.toBe('late-night');
  });

  it('weekend-open: Saturday event with no conflict lands in weekend-open', () => {
    const event = makeEvent({
      start: '2026-04-18T18:00:00Z', // Saturday 13:00 CT
      title: 'Saturday afternoon thing',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).toBe('weekend-open');
  });

  it('allEvents=[self] does not trigger back-to-back', () => {
    const event = makeEvent({
      start: '2026-04-14T15:00:00Z',
      end: '2026-04-14T16:00:00Z',
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).not.toBe('back-to-back');
  });

  it('event.end = null is handled without throwing', () => {
    const target = makeEvent({
      start: '2026-04-14T15:00:00Z',
      end: null,
      title: 'Open-ended',
      location: 'A',
    });
    const adjacent = makeEvent({
      start: '2026-04-14T16:30:00Z',
      end: '2026-04-14T17:30:00Z',
      title: 'After',
      location: 'B',
    });
    expect(() => buildContext(target, [], [target, adjacent])).not.toThrow();
  });
});

describe('pickGoldyLine — slot substitution across buckets', () => {
  it('free-food: foodHint appears in output string', () => {
    const event = makeEvent({
      start: '2026-04-14T15:00:00Z',
      title: 'Free Pizza + Linux',
      hasFreeFood: true,
    });
    const ctx = buildContext(event, [], [event]);
    expect(ctx.bucket).toBe('free-food');
    const line = pickGoldyLine(event, ctx);
    expect(line).toContain('pizza');
    expect(line).not.toContain('{{');
  });

  it('interest-match: interestHit appears in output string', () => {
    const event = makeEvent({
      start: '2026-04-14T15:00:00Z',
      title: 'Gopher Hack 26',
      category: 'hackathon',
    });
    const ctx = buildContext(event, [], [event], ['hackathon']);
    expect(ctx.bucket).toBe('interest-match');
    const line = pickGoldyLine(event, ctx);
    expect(line).toContain('hackathon');
    expect(line).not.toContain('{{');
  });

  it('back-to-back: nextEventTitle appears in output (every template references it)', () => {
    const target = makeEvent({
      start: '2026-04-14T15:00:00Z',
      end: '2026-04-14T16:00:00Z',
      location: 'Keller Hall',
    });
    const next = makeEvent({
      start: '2026-04-14T17:00:00Z',
      end: '2026-04-14T18:00:00Z',
      title: 'Pizza Party',
      location: 'Walter Library',
    });
    const ctx = buildContext(target, [], [target, next]);
    expect(ctx.bucket).toBe('back-to-back');
    const line = pickGoldyLine(target, ctx);
    expect(line).toContain('Pizza Party');
    expect(line).not.toContain('{{');
  });

  it('no placeholders leak in any bucket (output never contains {{)', () => {
    const cases: Array<[string, GoldyContext]> = [
      ['2026-04-14T15:00:00Z', { bucket: 'conflict', slots: { conflictTitle: 'CSCI 5801' } }],
      ['2026-04-18T19:30:00Z', { bucket: 'top-pick-gameday', slots: {} }],
      ['2026-04-14T15:00:00Z', { bucket: 'interest-match', slots: { interestHit: 'hackathon' } }],
      ['2026-04-14T15:00:00Z', { bucket: 'free-food', slots: { foodHint: 'pizza' } }],
      [
        '2026-04-14T15:00:00Z',
        { bucket: 'back-to-back', slots: { nextEventTitle: 'Next Thing', walkMinutes: 12 } },
      ],
      ['2026-04-15T22:30:00Z', { bucket: 'late-night', slots: {} }],
      ['2026-04-18T18:00:00Z', { bucket: 'weekend-open', slots: {} }],
      ['2026-04-14T15:00:00Z', { bucket: 'default', slots: {} }],
    ];

    for (const [start, ctx] of cases) {
      const event = makeEvent({ start, title: `Event ${start}` });
      const line = pickGoldyLine(event, ctx);
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain('{{');
    }
  });
});

describe('urgent bucket — wins over everything when within 30 min of leave-by', () => {
  // Event in 20 min at a location with default 12-min walk → leave-by ~8 min away.
  const urgentNow = new Date('2026-04-14T14:40:00Z');
  const urgentEvent = makeEvent({
    start: '2026-04-14T15:00:00Z',
    location: 'Walter Library',
    title: 'About to happen',
    hasFreeFood: true, // would normally be free-food
  });

  it('returns urgent bucket with minutesToLeaveBy populated', () => {
    const ctx = buildContext(urgentEvent, [], [urgentEvent], [], urgentNow);
    expect(ctx.bucket).toBe('urgent');
    expect(ctx.slots.minutesToLeaveBy).toBeGreaterThanOrEqual(0);
    expect(ctx.slots.minutesToLeaveBy).toBeLessThanOrEqual(30);
  });

  it('urgent wins over conflict', () => {
    const busy = makeSlot(
      'CSCI 5801',
      '2026-04-14T14:55:00Z',
      '2026-04-14T15:30:00Z',
    );
    const ctx = buildContext(urgentEvent, [busy], [urgentEvent], [], urgentNow);
    expect(ctx.bucket).toBe('urgent');
  });

  it('urgent does NOT fire without a now argument', () => {
    const ctx = buildContext(urgentEvent, [], [urgentEvent], []);
    expect(ctx.bucket).not.toBe('urgent');
  });

  it('urgent does NOT fire when leave-by is more than 30 min away', () => {
    const earlyNow = new Date('2026-04-14T13:00:00Z'); // 2h before start
    const ctx = buildContext(urgentEvent, [], [urgentEvent], [], earlyNow);
    expect(ctx.bucket).not.toBe('urgent');
  });

  it('urgent does NOT fire once the event has started', () => {
    const afterStart = new Date('2026-04-14T15:05:00Z');
    const ctx = buildContext(urgentEvent, [], [urgentEvent], [], afterStart);
    expect(ctx.bucket).not.toBe('urgent');
  });

  it('urgent does NOT fire for events with no location (no leave-by computable)', () => {
    const noLoc = makeEvent({
      start: '2026-04-14T15:00:00Z',
      location: null,
      title: 'Mystery',
    });
    const ctx = buildContext(noLoc, [], [noLoc], [], urgentNow);
    expect(ctx.bucket).not.toBe('urgent');
  });

  it('pickGoldyLine returns a valid urgent line (no placeholder leakage)', () => {
    const ctx = buildContext(urgentEvent, [], [urgentEvent], [], urgentNow);
    const line = pickGoldyLine(urgentEvent, ctx);
    expect(line.length).toBeGreaterThan(0);
    expect(line).not.toContain('{{');
  });
});

describe('matchesAnyInterest — no spurious short-prefix hits', () => {
  it('short interest "art" does not match "Update your resume" (no 4-char false positive)', () => {
    const event = makeEvent({
      start: '2026-04-14T15:00:00Z',
      title: 'Update your resume workshop',
      category: 'career',
    });
    const ctx = buildContext(event, [], [event], ['art']);
    expect(ctx.bucket).not.toBe('interest-match');
  });
});
