import { describe, it, expect } from 'vitest';
import { createRateLimiter, extractClientIp } from './rate-limit';

describe('createRateLimiter', () => {
  it('allows requests under the per-key limit', () => {
    const limiter = createRateLimiter({ perKeyLimit: 3, globalLimit: 100, windowMs: 60_000 });
    expect(limiter.check('a', 0)).toEqual({ allowed: true });
    expect(limiter.check('a', 0)).toEqual({ allowed: true });
    expect(limiter.check('a', 0)).toEqual({ allowed: true });
  });

  it('blocks the request that exceeds the per-key limit', () => {
    const limiter = createRateLimiter({ perKeyLimit: 2, globalLimit: 100, windowMs: 60_000 });
    limiter.check('a', 0);
    limiter.check('a', 0);
    const result = limiter.check('a', 100);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('per-key');
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it('isolates keys from each other', () => {
    const limiter = createRateLimiter({ perKeyLimit: 1, globalLimit: 100, windowMs: 60_000 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    expect(limiter.check('a', 0).allowed).toBe(false);
  });

  it('resets the per-key window after windowMs', () => {
    const limiter = createRateLimiter({ perKeyLimit: 1, globalLimit: 100, windowMs: 60_000 });
    limiter.check('a', 0);
    expect(limiter.check('a', 10_000).allowed).toBe(false);
    expect(limiter.check('a', 60_001).allowed).toBe(true);
  });

  it('blocks when global limit is hit even if key is fine', () => {
    const limiter = createRateLimiter({ perKeyLimit: 10, globalLimit: 2, windowMs: 60_000 });
    expect(limiter.check('a', 0).allowed).toBe(true);
    expect(limiter.check('b', 0).allowed).toBe(true);
    const result = limiter.check('c', 0);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('global');
    }
  });

  it('resets the global window after windowMs', () => {
    const limiter = createRateLimiter({ perKeyLimit: 10, globalLimit: 1, windowMs: 60_000 });
    limiter.check('a', 0);
    expect(limiter.check('b', 30_000).allowed).toBe(false);
    expect(limiter.check('c', 60_001).allowed).toBe(true);
  });

  it('blocked requests do not consume quota', () => {
    const limiter = createRateLimiter({ perKeyLimit: 1, globalLimit: 10, windowMs: 60_000 });
    limiter.check('a', 0);
    limiter.check('a', 0); // blocked
    limiter.check('a', 0); // blocked
    // window rollover — should get exactly 1 fresh allow, not get penalized for the blocks
    expect(limiter.check('a', 60_001).allowed).toBe(true);
    expect(limiter.check('a', 60_001).allowed).toBe(false);
  });
});

describe('extractClientIp', () => {
  it('parses the first entry from x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('trims whitespace', () => {
    const h = new Headers({ 'x-forwarded-for': '   203.0.113.5   ' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is missing', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.7' });
    expect(extractClientIp(h)).toBe('198.51.100.7');
  });

  it('returns a per-request anon token when no client IP headers are present', () => {
    // Unique tokens per call so unknown-IP clients don't share one rate-limit
    // bucket — prevents a header-stripping actor from blocking all anons.
    const h = new Headers();
    const a = extractClientIp(h);
    const b = extractClientIp(h);
    expect(a).toMatch(/^anon-/);
    expect(b).toMatch(/^anon-/);
    expect(a).not.toBe(b);
  });
});
