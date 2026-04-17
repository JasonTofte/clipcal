import { describe, it, expect } from 'vitest';
import { mergeSignupUrl } from '@/lib/merge-signup-url';

describe('mergeSignupUrl', () => {
  // T-9 (AC-3) — on-device QR decode wins over LLM-extracted URL
  it('T-9: returns qrUrl when both qrUrl and llmUrl are present (AC-3)', () => {
    expect(
      mergeSignupUrl('https://decoded.example/a', 'https://llm.example/b'),
    ).toBe('https://decoded.example/a');
  });

  // T-10 (AC-3) — LLM URL survives when on-device decode returns null
  it('T-10: returns llmUrl when qrUrl is null (AC-3)', () => {
    expect(mergeSignupUrl(null, 'https://llm.example/b')).toBe(
      'https://llm.example/b',
    );
  });

  // T-11 (AC-3) — returns null when both are null
  it('T-11: returns null when both qrUrl and llmUrl are null (AC-3)', () => {
    expect(mergeSignupUrl(null, null)).toBe(null);
  });

  // Negative sample from matrix Oracle Strategy: (null, undefined) → null
  it('returns null when qrUrl is null and llmUrl is undefined', () => {
    expect(mergeSignupUrl(null, undefined)).toBe(null);
  });

  // Negative sample from matrix Oracle Strategy: non-null qrUrl with null llmUrl → qrUrl
  it('returns qrUrl when qrUrl is present and llmUrl is null', () => {
    expect(mergeSignupUrl('https://a.example', null)).toBe('https://a.example');
  });
});
