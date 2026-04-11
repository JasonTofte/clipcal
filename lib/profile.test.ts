import { describe, it, expect } from 'vitest';
import { ProfileSchema } from './profile';

const validProfile = {
  major: 'Computer Science',
  stage: 'junior' as const,
  interests: ['AI research', 'climbing', 'improv comedy'],
  preferences: {
    showTradeoffs: true,
    surfaceNoticings: true,
  },
  vibe: 'deep in finals mode, protecting time',
};

describe('ProfileSchema', () => {
  it('parses a valid profile', () => {
    expect(() => ProfileSchema.parse(validProfile)).not.toThrow();
  });

  it('allows null for major/stage/vibe', () => {
    expect(() =>
      ProfileSchema.parse({
        ...validProfile,
        major: null,
        stage: null,
        vibe: null,
      }),
    ).not.toThrow();
  });

  it('requires interests to be an array (empty is allowed)', () => {
    expect(() =>
      ProfileSchema.parse({ ...validProfile, interests: [] }),
    ).not.toThrow();

    expect(() =>
      ProfileSchema.parse({ ...validProfile, interests: 'a,b,c' }),
    ).toThrow();
  });

  it('rejects an invalid stage enum value', () => {
    expect(() =>
      ProfileSchema.parse({ ...validProfile, stage: 'phd' }),
    ).toThrow();
  });

  it('requires preferences to be an object with both booleans', () => {
    expect(() =>
      ProfileSchema.parse({
        ...validProfile,
        preferences: { showTradeoffs: true },
      }),
    ).toThrow();

    expect(() =>
      ProfileSchema.parse({
        ...validProfile,
        preferences: { showTradeoffs: true, surfaceNoticings: 'yes' },
      }),
    ).toThrow();
  });
});
