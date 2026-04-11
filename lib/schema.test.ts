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
