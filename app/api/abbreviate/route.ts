import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Event } from '@/lib/schema';
import { logError, requireAnthropic } from '@/lib/api-utils';
import { abbreviateLimiter } from '@/lib/rate-limit';
import {
  fenceField,
  fenceTitle,
  UNTRUSTED_PREAMBLE,
} from '@/lib/prompt-safety';

const MODEL_ID = 'claude-haiku-4-5-20251001';

// Bounds on caller payload — every event carries title (≤200) + location
// (≤500) after sanitization, so 50 events is a safe ceiling for Claude
// Haiku context. 10KB body cap stops a malicious caller from bursting the
// LLM with garbage (matches the convention in other API routes).
const MAX_EVENTS = 50;
const MAX_BODY_BYTES = 10_000;

// 20 chars for title, 14 for location — fits the e-ink display column widths
const AbbreviatedEventSchema = z.object({
  events: z.array(
    z.object({
      shortTitle: z.string().max(20),
      shortLoc: z.string().max(14).nullable(),
    }),
  ),
});

export async function POST(req: Request): Promise<Response> {
  const guard = requireAnthropic(req, abbreviateLimiter);
  if (!guard.ok) return guard.response;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'body too large' }, { status: 413 });
  }

  let events: Event[];
  try {
    const body = JSON.parse(raw);
    if (!Array.isArray(body.events)) throw new Error('bad shape');
    events = body.events;
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (events.length === 0) {
    return Response.json({ events: [] });
  }
  if (events.length > MAX_EVENTS) {
    return Response.json(
      { error: `too many events (max ${MAX_EVENTS})` },
      { status: 413 },
    );
  }

  // Fence each untrusted field so a malicious title can't slip a fresh
  // instruction into the prompt body.
  const list = events
    .map(
      (e, i) =>
        `${i + 1}. ${fenceTitle(e.title)} ${fenceField('location', e.location ?? '')}`,
    )
    .join('\n');

  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: AbbreviatedEventSchema,
      system: `${UNTRUSTED_PREAMBLE}\n\nYou shorten event titles and locations for a 250\u00d7122px black-and-white e-ink display worn on a phone case.
Rules:
- shortTitle: \u226420 chars, drop filler words (Free, Annual, Workshop, Event, Meeting), keep the distinctive noun/verb
- shortLoc: \u226414 chars, building name or room only, drop street/city/state. null if no location.
- Keep acronyms (CSCI, CSE, UMN). Abbreviate common words: Library\u2192Lib, Building\u2192Bldg, University\u2192U.
- Output one object per input, in the same order.`,
      messages: [
        {
          role: 'user',
          content: `Abbreviate these ${events.length} events:\n${list}`,
        },
      ],
    });
    return Response.json(result.object);
  } catch (error) {
    logError('abbreviate', error);
    return Response.json({ error: 'abbreviation failed' }, { status: 500 });
  }
}
