import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ProfileSchema, type Profile } from '@/lib/profile';
import { RelevanceBatchSchema } from '@/lib/relevance';
import { EventSchema, type Event } from '@/lib/schema';
import { relevanceLimiter, extractClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

const MODEL_ID = 'claude-haiku-4-5-20251001';
const MAX_EVENTS = 8;

const RelevanceRequestSchema = z.object({
  events: z.array(EventSchema).min(1).max(MAX_EVENTS),
  profile: ProfileSchema,
});

const SCORING_SYSTEM_PROMPT = `You score how well a list of campus events matches a student's profile. Return one score per event in the same order.

SCORE
- 0 to 100 integer. 100 = this is exactly what they care about. 50 = ambient interest. 0 = zero fit.
- Bias toward honest middles. Use the 60-85 range for "this fits" and reserve 90+ for "perfect match."
- Use low scores (under 30) when the category or vibe clearly doesn't match. Don't be polite.

REASON
- One short sentence per event, written to the student. Max 120 chars.
- Point to the concrete thing that matched (or didn't match) — an interest, their stage, their major, their vibe.
- Never say "recommend" or "should." Use "fits", "matches", "overlaps", "aligns with", or "notice".
- Don't repeat the event title back. Assume they can see it.`;

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'missing api key' }, { status: 500 });
  }

  const clientIp = extractClientIp(req.headers);
  const limit = relevanceLimiter.check(clientIp);
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate limited, try again in a moment' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  const parsed = RelevanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid request shape' }, { status: 400 });
  }

  const { events, profile } = parsed.data;

  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: RelevanceBatchSchema,
      system: SCORING_SYSTEM_PROMPT,
      prompt: buildScoringPrompt(events, profile),
    });

    // Align with input length defensively — if Claude returns fewer, pad with
    // neutral middling scores so the UI can still render.
    const aligned = alignScores(result.object.scores, events.length);
    return Response.json({ scores: aligned });
  } catch (error) {
    console.error('[relevance] generateObject failed', error);
    return Response.json({ error: 'relevance scoring failed' }, { status: 500 });
  }
}

function buildScoringPrompt(events: Event[], profile: Profile): string {
  const profileBlob = [
    profile.major && `major: ${profile.major}`,
    profile.stage && `stage: ${profile.stage}`,
    profile.interests.length > 0 && `interests: ${profile.interests.join(', ')}`,
    profile.vibe && `vibe: ${profile.vibe}`,
    `prefers tradeoff language: ${profile.preferences.showTradeoffs}`,
    `wants ambient noticings: ${profile.preferences.surfaceNoticings}`,
  ]
    .filter(Boolean)
    .join('\n');

  const eventsBlob = events
    .map((e, i) => {
      const parts = [
        `${i + 1}. ${e.title}`,
        `   category: ${e.category}`,
        e.location ? `   where: ${e.location}` : null,
        e.description ? `   about: ${e.description}` : null,
        e.hasFreeFood ? '   has free food' : null,
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');

  return `PROFILE:\n${profileBlob}\n\nEVENTS:\n${eventsBlob}\n\nReturn one score object per event in the same order.`;
}

function alignScores(
  scores: Array<{ score: number; reason: string }>,
  expectedLength: number,
) {
  if (scores.length === expectedLength) return scores;
  const padded = scores.slice(0, expectedLength);
  while (padded.length < expectedLength) {
    padded.push({ score: 50, reason: 'no strong signal either way' });
  }
  return padded;
}
