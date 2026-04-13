import { describe, it, expect } from 'vitest';
import { extractKeywords, dateWindow } from './livewhale';

describe('extractKeywords', () => {
  it('strips stopwords and returns top N tokens joined by +', () => {
    expect(extractKeywords('The Data Science Workshop for Beginners', 3))
      .toBe('data+science+workshop');
  });

  it('drops words shorter than 3 chars', () => {
    expect(extractKeywords('CS Club Tuesday Meetup', 3))
      .toBe('club+tuesday+meetup');
  });

  it('returns empty string when all tokens are stopwords', () => {
    expect(extractKeywords('the and of for', 3)).toBe('');
  });

  it('lowercases and strips non-alphanumeric', () => {
    expect(extractKeywords('AI/ML Research Lab!', 3)).toBe('aiml+research+lab');
  });
});

describe('dateWindow', () => {
  it('returns ±N day window as YYYY-MM-DD', () => {
    const w = dateWindow('2026-04-15T18:00:00Z', 3);
    expect(w).toEqual({ startDate: '2026-04-12', endDate: '2026-04-18' });
  });

  it('returns null for unparseable input', () => {
    expect(dateWindow('not a date', 3)).toBeNull();
  });
});
