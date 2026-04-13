import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { INTERVIEWER_SYSTEM_PROMPT } from '@/lib/chat-prompt';
import { chatLimiter, extractClientIp } from '@/lib/rate-limit';
import { MODEL_HAIKU } from '@/lib/models';

const MAX_TOTAL_CHARS = 20_000;

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

  const totalChars = messages.reduce((sum, m) => {
    const parts = Array.isArray(m.parts) ? m.parts : [];
    return sum + parts.reduce((s, p) => s + (p.type === 'text' ? p.text.length : 0), 0);
  }, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return Response.json({ error: 'transcript too long' }, { status: 413 });
  }

  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: anthropic(MODEL_HAIKU),
      system: INTERVIEWER_SYSTEM_PROMPT,
      messages: modelMessages,
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    const e = error as { name?: string; message?: string };
    console.error('[chat]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({ error: 'chat failed' }, { status: 500 });
  }
}
