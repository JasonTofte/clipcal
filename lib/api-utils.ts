import { extractClientIp } from '@/lib/rate-limit';

type Limiter = {
  check: (key: string) => { allowed: true } | { allowed: false; retryAfterSec: number };
};

export type PreambleOk = { ok: true; clientIp: string };
export type PreambleDenied = { ok: false; response: Response };

/**
 * Shared API route entry checks: API key present + rate-limit allowed.
 * Returns the client IP on success for any follow-up limiter checks.
 */
export function requireAnthropic(req: Request, limiter: Limiter): PreambleOk | PreambleDenied {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      response: Response.json({ error: 'missing api key' }, { status: 500 }),
    };
  }

  const clientIp = extractClientIp(req.headers);
  const limit = limiter.check(clientIp);
  if (!limit.allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: 'rate limited, try again in a moment' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSec) },
        },
      ),
    };
  }

  return { ok: true, clientIp };
}

/** Compact error logger — never log full Error objects (may echo prompts). */
export function logError(tag: string, error: unknown): void {
  const e = error as { name?: string; message?: string };
  console.error(`[${tag}]`, e?.name ?? 'Error', e?.message ?? 'unknown');
}
