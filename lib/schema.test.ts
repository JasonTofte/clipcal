import { describe, it, expect } from 'vitest';
import { EventSchema, ExtractionSchema } from './schema';

const validEvent = {
  title: 'CSE Student Board Welcome Night',
  start: '2026-04-15T18:00:00-05:00',
  end: '2026-04-15T20:00:00-05:00',
  location: 'Keller Hall 3-180',
  description: 'Pizza and intros for new members.',
  category: 'networking' as const,
  hasFreeFood: true,
  timezone: 'America/Chicago',
  confidence: 'high' as const,
};

describe('EventSchema', () => {
  it('parses a valid event (AC-1)', () => {
    expect(() => EventSchema.parse(validEvent)).not.toThrow();
  });

  it('allows nullable location/description/end (AC-1 variant)', () => {
    expect(() =>
      EventSchema.parse({
        ...validEvent,
        end: null,
        location: null,
        description: null,
      }),
    ).not.toThrow();
  });

  it('rejects an invalid category enum value (AC-2)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, category: 'food-truck' }),
    ).toThrow();
  });

  it('rejects an event missing the timezone field (AC-4)', () => {
    const { timezone, ...withoutTz } = validEvent;
    expect(() => EventSchema.parse(withoutTz)).toThrow();
  });

  it('rejects an event with a non-boolean hasFreeFood', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, hasFreeFood: 'yes' }),
    ).toThrow();
  });
});

describe('EventSchema hasQR + signupUrl', () => {
  // T-1 (AC-1) — hasQR: true is accepted
  it('T-1: accepts hasQR: true (AC-1)', () => {
    expect(() => EventSchema.parse({ ...validEvent, hasQR: true })).not.toThrow();
  });

  // T-2 (AC-1) — hasQR: false is accepted
  it('T-2: accepts hasQR: false (AC-1)', () => {
    expect(() => EventSchema.parse({ ...validEvent, hasQR: false })).not.toThrow();
  });

  // T-3 (AC-1) — event without hasQR key is accepted (optional field).
  // Start from an event that explicitly has hasQR, then strip the key, so
  // the assertion actually exercises absence rather than just re-running
  // the base fixture (which never had hasQR to begin with).
  it('T-3: accepts event without hasQR key (AC-1)', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hasQR: _removed, ...eventWithoutHasQR } = { ...validEvent, hasQR: true };
    expect(() => EventSchema.parse(eventWithoutHasQR)).not.toThrow();
  });

  // T-4 (AC-1) — hasQR: "yes" is rejected (must be boolean)
  it('T-4: rejects hasQR: "yes" — must be boolean (AC-1)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, hasQR: 'yes' }),
    ).toThrow();
  });

  // T-5 (AC-2) — javascript: signupUrl is rejected
  it('T-5: rejects signupUrl with javascript: protocol (AC-2)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, signupUrl: 'javascript:alert(1)' }),
    ).toThrow();
  });

  // T-6 (AC-2) — https signupUrl is accepted
  it('T-6: accepts signupUrl with https:// (AC-2)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, signupUrl: 'https://example.com/signup' }),
    ).not.toThrow();
  });

  // T-7 (AC-2 boundary) — http signupUrl is accepted (http allowed per existing refine)
  it('T-7: accepts signupUrl with http:// (AC-2 boundary)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, signupUrl: 'http://example.com' }),
    ).not.toThrow();
  });

  // T-8 (AC-2 boundary) — null signupUrl is accepted (field is nullable)
  it('T-8: accepts signupUrl: null (AC-2 boundary)', () => {
    expect(() =>
      EventSchema.parse({ ...validEvent, signupUrl: null }),
    ).not.toThrow();
  });
});

describe('ExtractionSchema', () => {
  it('parses a valid extraction (AC-1)', () => {
    expect(() =>
      ExtractionSchema.parse({
        events: [validEvent],
        sourceNotes: 'Two events on this flyer, both in Keller.',
      }),
    ).not.toThrow();
  });

  it('allows null sourceNotes', () => {
    expect(() =>
      ExtractionSchema.parse({ events: [validEvent], sourceNotes: null }),
    ).not.toThrow();
  });

  it('rejects an empty events array (AC-3)', () => {
    expect(() =>
      ExtractionSchema.parse({ events: [], sourceNotes: null }),
    ).toThrow();
  });

  it('supports multi-event extraction', () => {
    expect(() =>
      ExtractionSchema.parse({
        events: [validEvent, { ...validEvent, title: 'Second Event' }],
        sourceNotes: null,
      }),
    ).not.toThrow();
  });
});
