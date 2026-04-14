import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Event } from '@/lib/schema';

const MODEL_ID = 'claude-haiku-4-5-20251001';

// 20 chars for title, 14 for location — fits the e-ink column widths
const AbbreviatedEventSchema = z.object({
  events: z.array(
    z.object({
      shortTitle: z.string().transform((s) => (s.length > 20 ? s.slice(0, 19) + '…' : s)),
      shortLoc: z.string().transform((s) => (s.length > 14 ? s.slice(0, 13) + '…' : s)).nullable(),
    }),
  ),
});

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'missing api key' }, { status: 500 });
  }

  let events: Event[];
  try {
    const body = await req.json();
    if (!Array.isArray(body.events)) throw new Error('bad shape');
    events = body.events;
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (events.length === 0) {
    return Response.json({ events: [] });
  }

  const list = events
    .map((e, i) => `${i + 1}. title="${e.title}" location="${e.location ?? ''}"`)
    .join('\n');

  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: AbbreviatedEventSchema,
      system: `You shorten event titles and locations for a 250×122px black-and-white e-ink display worn on a phone case.
Rules:
- shortTitle: ≤20 chars, drop filler words (Free, Annual, Workshop, Event, Meeting), keep the distinctive noun/verb
- shortLoc: ≤14 chars, building name or room only, drop street/city/state. null if no location.
- Keep acronyms (CSCI, CSE, UMN). Abbreviate common words: Library→Lib, Building→Bldg, University→U.
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
    console.error('[abbreviate] generateObject failed', error);
    return Response.json({ error: 'abbreviation failed' }, { status: 500 });
  }
}
