type Bucket = {
  count: number;
  windowStart: number;
};

export type RateLimitConfig = {
  perKeyLimit: number;
  globalLimit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; reason: 'per-key' | 'global' };

const DEFAULT_CONFIG: RateLimitConfig = {
  perKeyLimit: 5,
  globalLimit: 30,
  windowMs: 60_000,
};

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const cfg: RateLimitConfig = { ...DEFAULT_CONFIG, ...config };
  const perKey = new Map<string, Bucket>();
  let global: Bucket = { count: 0, windowStart: 0 };

  function rollWindow(bucket: Bucket, now: number): Bucket {
    if (now - bucket.windowStart >= cfg.windowMs) {
      return { count: 0, windowStart: now };
    }
    return bucket;
  }

  function check(key: string, now: number = Date.now()): RateLimitResult {
    global = rollWindow(global, now);
    if (global.count >= cfg.globalLimit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((global.windowStart + cfg.windowMs - now) / 1000),
      );
      return { allowed: false, retryAfterSec, reason: 'global' };
    }

    const existing = perKey.get(key) ?? { count: 0, windowStart: now };
    const rolled = rollWindow(existing, now);
    if (rolled.count >= cfg.perKeyLimit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rolled.windowStart + cfg.windowMs - now) / 1000),
      );
      perKey.set(key, rolled);
      return { allowed: false, retryAfterSec, reason: 'per-key' };
    }

    rolled.count += 1;
    perKey.set(key, rolled);
    global.count += 1;
    return { allowed: true };
  }

  return { check, _config: cfg };
}

// Singleton for the /api/extract route. Cold starts reset state, which is
// acceptable — per-instance limits still bound blast radius.
export const extractLimiter = createRateLimiter();

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; the first entry
    // is the original client per the de-facto convention Vercel follows.
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
