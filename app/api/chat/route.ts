import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { INTERVIEWER_SYSTEM_PROMPT } from '@/lib/chat-prompt';
import { chatLimiter } from '@/lib/rate-limit';
import { MODEL_HAIKU } from '@/lib/models';
import { requireAnthropic, logError } from '@/lib/api-utils';

const MAX_TOTAL_CHARS = 20_000;

export async function POST(req: Request): Promise<Response> {
  const gate = requireAnthropic(req, chatLimiter);
  if (!gate.ok) return gate.response;

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
    logError('chat', error);
    return Response.json({ error: 'chat failed' }, { status: 500 });
  }
}
