import { describe, it, expect } from 'vitest';
import {
  RelevanceScoreSchema,
  RelevanceBatchSchema,
  formatScoreBadge,
  scoreTone,
  matchesInterests,
} from './relevance';

describe('RelevanceScoreSchema', () => {
  it('parses a valid score', () => {
    expect(() =>
      RelevanceScoreSchema.parse({ score: 82, reason: 'matches your AI interests' }),
    ).not.toThrow();
  });

  it('rejects negative or >100 scores', () => {
    expect(() =>
      RelevanceScoreSchema.parse({ score: -1, reason: 'x' }),
    ).toThrow();
    expect(() =>
      RelevanceScoreSchema.parse({ score: 101, reason: 'x' }),
    ).toThrow();
  });

  it('rejects non-integer scores', () => {
    expect(() =>
      RelevanceScoreSchema.parse({ score: 82.5, reason: 'x' }),
    ).toThrow();
  });

  it('rejects empty reason strings', () => {
    expect(() =>
      RelevanceScoreSchema.parse({ score: 50, reason: '' }),
    ).toThrow();
  });
});

describe('RelevanceBatchSchema', () => {
  it('parses a batch with multiple scores', () => {
    expect(() =>
      RelevanceBatchSchema.parse({
        scores: [
          { score: 82, reason: 'matches AI' },
          { score: 30, reason: 'no strong signal' },
        ],
      }),
    ).not.toThrow();
  });

  it('allows an empty scores array', () => {
    expect(() => RelevanceBatchSchema.parse({ scores: [] })).not.toThrow();
  });

  it('rejects non-array scores field', () => {
    expect(() => RelevanceBatchSchema.parse({ scores: 'none' })).toThrow();
  });
});

describe('formatScoreBadge', () => {
  it('returns a percentage string', () => {
    expect(formatScoreBadge(85)).toBe('85%');
    expect(formatScoreBadge(0)).toBe('0%');
    expect(formatScoreBadge(100)).toBe('100%');
  });
});

describe('scoreTone', () => {
  it('maps score ranges to tones', () => {
    expect(scoreTone(95)).toBe('high');
    expect(scoreTone(70)).toBe('high');
    expect(scoreTone(69)).toBe('medium');
    expect(scoreTone(40)).toBe('medium');
    expect(scoreTone(39)).toBe('low');
    expect(scoreTone(0)).toBe('low');
  });
});

// AC-3: matchesInterests — keyword filter for browse feature
describe('matchesInterests', () => {
  it('AC-3: returns true when an interest substring matches the event title (case-insensitive)', () => {
    const event = { title: 'Machine Learning Workshop', group_title: null, event_types: [] };
    expect(matchesInterests(event, ['machine learning'])).toBe(true);
  });

  it('AC-3: matches are case-insensitive', () => {
    const event = { title: 'AI Ethics Panel', group_title: null, event_types: [] };
    expect(matchesInterests(event, ['ai ethics'])).toBe(true);
    expect(matchesInterests(event, ['AI ETHICS'])).toBe(true);
    expect(matchesInterests(event, ['Ai EtHiCs'])).toBe(true);
  });

  it('AC-3: returns true when an interest matches group_title', () => {
    const event = { title: 'Weekly Meetup', group_title: 'Data Science Club', event_types: [] };
    expect(matchesInterests(event, ['data science'])).toBe(true);
  });

  it('AC-3: returns true when an interest matches an entry in event_types', () => {
    const event = { title: 'Campus Fest', group_title: null, event_types: ['Workshop', 'Networking'] };
    expect(matchesInterests(event, ['networking'])).toBe(true);
  });

  it('AC-3: returns false when interests array is empty', () => {
    const event = { title: 'AI Summit', group_title: 'Tech Club', event_types: ['Workshop'] };
    expect(matchesInterests(event, [])).toBe(false);
  });

  it('AC-3: returns false when no field contains any interest token', () => {
    const event = { title: 'Campus Pottery Class', group_title: 'Arts Group', event_types: ['Arts'] };
    expect(matchesInterests(event, ['machine learning', 'robotics'])).toBe(false);
  });

  it('AC-3: handles null group_title without throwing', () => {
    const event = { title: 'Open Lecture', group_title: null, event_types: [] };
    expect(() => matchesInterests(event, ['lecture'])).not.toThrow();
    expect(matchesInterests(event, ['lecture'])).toBe(true);
  });

  it('AC-3: whitespace-only interest strings do not match everything', () => {
    const event = { title: 'Random Talk', group_title: null, event_types: [] };
    expect(matchesInterests(event, ['   '])).toBe(false);
    expect(matchesInterests(event, ['\t'])).toBe(false);
  });

  it('AC-3: returns true on partial substring match within a field', () => {
    const event = { title: 'Introduction to Robotics Engineering', group_title: null, event_types: [] };
    expect(matchesInterests(event, ['robot'])).toBe(true);
  });

  it('AC-3: a single matching interest among multiple is sufficient', () => {
    const event = { title: 'Career Fair', group_title: null, event_types: ['Networking'] };
    expect(matchesInterests(event, ['robotics', 'networking', 'sailing'])).toBe(true);
  });
});
