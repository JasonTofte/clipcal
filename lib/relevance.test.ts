import { describe, it, expect } from 'vitest';
import {
  RelevanceScoreSchema,
  RelevanceBatchSchema,
  formatScoreBadge,
  scoreTone,
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
