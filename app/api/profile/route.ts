import { anthropic } from '@ai-sdk/anthropic';
import { generateObject, type UIMessage } from 'ai';
import { ProfileSchema } from '@/lib/profile';
import { chatLimiter, extractClientIp } from '@/lib/rate-limit';

const MODEL_ID = 'claude-haiku-4-5-20251001';

const EXTRACTION_SYSTEM_PROMPT = `You read a short chat transcript between a campus events app and a student, then you extract a structured profile that the app can use to rank events.

FIELDS
- major: the student's field of study as a short string (e.g. "Computer Science", "Psychology"). Null if they didn't say.
- stage: one of freshman, sophomore, junior, senior, grad. Null if not stated or inferable.
- interests: an array of short phrases (2-6 items). Prefer concrete nouns like "AI research", "climbing", "improv comedy" over vague ones like "cool stuff". If the transcript has no signal at all, return an empty array.
- preferences.showTradeoffs: true if the student seems to want honest pros/cons; false if they want things filtered for them. When in doubt, true (the app's default posture).
- preferences.surfaceNoticings: true if the student seems to want ambient observations like "this is the first open Saturday" or "your 8am class is the next day"; false if that would feel like noise. When in doubt, true.
- vibe: one short phrase (3-6 words) capturing the student's current mode in their own words when possible. Null if no signal.

RULES
- Do not hallucinate. If a field is not supported by the transcript, null or empty.
- Do not moralize, summarize, or explain. Return the object only.
- Short interests. "AI research" not "I am really into AI research and want to attend workshops about it".`;

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'missing api key' }, { status: 500 });
  }

  const clientIp = extractClientIp(req.headers);
  const limit = chatLimiter.check(clientIp);
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate limited, try again in a moment' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

  let body: { messages?: UIMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages required' }, { status: 400 });
  }

  // Flatten the transcript to plain text for the extractor.
  const transcript = messages
    .map((msg) => {
      const text = msg.parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('');
      return `${msg.role.toUpperCase()}: ${text}`;
    })
    .join('\n\n');

  try {
    const result = await generateObject({
      model: anthropic(MODEL_ID),
      schema: ProfileSchema,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: `Extract the profile from this transcript:\n\n${transcript}`,
    });
    return Response.json(result.object);
  } catch (error) {
    console.error('[profile] generateObject failed', error);
    return Response.json({ error: 'profile extraction failed' }, { status: 500 });
  }
}
