import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ProfileSchema, type Profile } from '@/lib/profile';
import { RelevanceBatchSchema } from '@/lib/relevance';
import { EventSchema, type Event } from '@/lib/schema';
import { relevanceLimiter } from '@/lib/rate-limit';
import { MODEL_HAIKU } from '@/lib/models';
import { sanitizeField, UNTRUSTED_PREAMBLE } from '@/lib/prompt-safety';
import { requireAnthropic, logError } from '@/lib/api-utils';
import { z } from 'zod';

const MAX_EVENTS = 8;

const RelevanceRequestSchema = z.object({
  events: z.array(EventSchema).min(1).max(MAX_EVENTS),
  profile: ProfileSchema,
});

const SCORING_SYSTEM_PROMPT = `You score how well a list of campus events matches a student's profile. Return one score per event in the same order.

${UNTRUSTED_PREAMBLE}

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
  const gate = requireAnthropic(req, relevanceLimiter);
  if (!gate.ok) return gate.response;

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
      model: anthropic(MODEL_HAIKU),
      schema: RelevanceBatchSchema,
      system: SCORING_SYSTEM_PROMPT,
      prompt: buildScoringPrompt(events, profile),
    });

    const aligned = alignScores(result.object.scores, events.length);
    return Response.json({ scores: aligned });
  } catch (error) {
    logError('relevance', error);
    return Response.json({ error: 'relevance scoring failed' }, { status: 500 });
  }
}

function buildScoringPrompt(events: Event[], profile: Profile): string {
  // Profile fields are user-authored; event fields may be LLM-extracted from
  // flyers OR sourced from external feeds (LiveWhale). Fence all untrusted
  // strings so content can't inject instructions into the scoring prompt.
  const profileBlob = [
    profile.major && `major: ${sanitizeField(profile.major, 100)}`,
    profile.stage && `stage: ${profile.stage}`,
    profile.interests.length > 0 &&
      `interests: ${profile.interests.map((i) => sanitizeField(i, 80)).join(', ')}`,
    profile.vibe && `vibe: ${sanitizeField(profile.vibe, 100)}`,
    `prefers tradeoff language: ${profile.preferences.showTradeoffs}`,
    `wants ambient noticings: ${profile.preferences.surfaceNoticings}`,
  ]
    .filter(Boolean)
    .join('\n');

  const eventsBlob = events
    .map((e, i) => {
      const parts = [
        `${i + 1}. <event_title>${sanitizeField(e.title, 200)}</event_title>`,
        `   <event_category>${sanitizeField(e.category, 40)}</event_category>`,
        e.location ? `   <event_location>${sanitizeField(e.location, 200)}</event_location>` : null,
        e.description ? `   <event_description>${sanitizeField(e.description, 500)}</event_description>` : null,
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
  console.warn(
    `[relevance] model returned ${scores.length} scores for ${expectedLength} events — padding`,
  );
  const padded = scores.slice(0, expectedLength);
  while (padded.length < expectedLength) {
    padded.push({ score: 50, reason: 'no strong signal either way' });
  }
  return padded;
}
