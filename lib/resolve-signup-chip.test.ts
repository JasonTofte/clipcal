import { describe, it, expect } from 'vitest';
import { resolveSignupChip } from '@/lib/resolve-signup-chip';

describe('resolveSignupChip', () => {
  // T-12 (AC-4) — link chip when signupUrl is present (link wins over hasQR)
  it('T-12: returns {kind: "link"} when signupUrl is present (AC-4)', () => {
    expect(
      resolveSignupChip({ signupUrl: 'https://example.com', hasQR: true }),
    ).toEqual({ kind: 'link', href: 'https://example.com' });
  });

  // T-13 (AC-5) — fallback chip when hasQR is true but no signupUrl
  it('T-13: returns {kind: "fallback"} when hasQR is true and signupUrl is absent (AC-5)', () => {
    expect(
      resolveSignupChip({ signupUrl: undefined, hasQR: true }),
    ).toEqual({ kind: 'fallback' });
  });

  // T-14 (AC-6) — no chip when neither signupUrl nor hasQR
  it('T-14: returns {kind: "none"} when signupUrl and hasQR are both absent (AC-6)', () => {
    expect(
      resolveSignupChip({ signupUrl: undefined, hasQR: undefined }),
    ).toEqual({ kind: 'none' });
  });

  // T-15 (AC-6 boundary) — no chip when hasQR is explicitly false
  it('T-15: returns {kind: "none"} when hasQR is false and signupUrl is absent (AC-6)', () => {
    expect(
      resolveSignupChip({ signupUrl: undefined, hasQR: false }),
    ).toEqual({ kind: 'none' });
  });

  // T-16 (AC-7) — same inputs as T-13 on purpose: documents that card and
  // row share a single gate, so a regression in one variant cannot drift
  // out of the other. Duplication is intentional.
  it('T-16: returns {kind: "fallback"} for row variant input (AC-7)', () => {
    expect(
      resolveSignupChip({ signupUrl: undefined, hasQR: true }),
    ).toEqual({ kind: 'fallback' });
  });

  // T-17 (AC-7 boundary) — row variant: link wins even when hasQR is false
  it('T-17: returns {kind: "link"} when signupUrl is present regardless of hasQR (AC-7)', () => {
    expect(
      resolveSignupChip({ signupUrl: 'https://x.example', hasQR: false }),
    ).toEqual({ kind: 'link', href: 'https://x.example' });
  });

  // Negative sample from Oracle Strategy: null signupUrl with hasQR false → none
  it('returns {kind: "none"} when signupUrl is null and hasQR is false', () => {
    expect(
      resolveSignupChip({ signupUrl: null, hasQR: false }),
    ).toEqual({ kind: 'none' });
  });
});
