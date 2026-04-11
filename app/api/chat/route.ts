import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { INTERVIEWER_SYSTEM_PROMPT } from '@/lib/chat-prompt';
import { chatLimiter, extractClientIp } from '@/lib/rate-limit';

const MODEL_ID = 'claude-haiku-4-5-20251001';

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
  if (!Array.isArray(messages)) {
    return Response.json({ error: 'messages must be an array' }, { status: 400 });
  }

  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: anthropic(MODEL_ID),
      system: INTERVIEWER_SYSTEM_PROMPT,
      messages: modelMessages,
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[chat] streamText failed', error);
    return Response.json({ error: 'chat failed' }, { status: 500 });
  }
}
