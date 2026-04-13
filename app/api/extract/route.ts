import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ExtractionSchema } from '@/lib/schema';
import { extractLimiter, sonnetLimiter, extractClientIp } from '@/lib/rate-limit';
import { MODEL_HAIKU, MODEL_SONNET } from '@/lib/models';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are extracting structured event information from a flyer image.

Today is ${today}, timezone America/Chicago.

For every event shown on the flyer, extract:
- title: the primary event name
- start: ISO 8601 with timezone offset (e.g. 2026-04-15T18:00:00-05:00). If the year is omitted, assume 2026. If only a weekday and time are given, use the next occurrence of that weekday.
- end: ISO 8601 or null if not stated
- location: as printed on the flyer, or null
- description: a 1-2 sentence summary, or null
- category: pick the best fit from workshop, networking, social, cs, career, culture, sports, hackathon, other
- hasFreeFood: true only if the flyer explicitly mentions free food, snacks, pizza, refreshments, or similar
- timezone: the IANA timezone (default "America/Chicago" for UMN flyers unless the flyer states otherwise)
- confidence: "high" if everything is clearly legible, "medium" if some fields required inference, "low" if the flyer is ambiguous
- venueSetting: "indoor", "outdoor", "hybrid", or null if unknown — infer from venue name, photos, or event type
- crowdSize: "small" (< 30), "medium" (30-100), "large" (100+), or null — infer from venue, event type, or any capacity hints

If multiple events appear on the flyer, return ALL of them. Never skip an event.
Set sourceNotes to anything noteworthy about the flyer itself (hard to read, unusual format, multiple dates listed) or null.`;
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'missing api key' }, { status: 500 });
  }

  const clientIp = extractClientIp(req.headers);
  const limit = extractLimiter.check(clientIp);
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate limited, try again in a moment' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSec) },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'invalid form data' }, { status: 400 });
  }

  const imageEntry = formData.get('image');
  if (!(imageEntry instanceof File)) {
    return Response.json({ error: 'no image provided' }, { status: 400 });
  }

  if (!ALLOWED_MEDIA_TYPES.has(imageEntry.type)) {
    return Response.json(
      { error: `invalid image type: ${imageEntry.type || 'unknown'}` },
      { status: 400 },
    );
  }

  if (imageEntry.size === 0) {
    return Response.json({ error: 'empty image' }, { status: 400 });
  }

  if (imageEntry.size > MAX_IMAGE_BYTES) {
    return Response.json({ error: 'image too large' }, { status: 400 });
  }

  const useFallback = formData.get('model') === 'sonnet';
  if (useFallback) {
    const sonnetLimit = sonnetLimiter.check(clientIp);
    if (!sonnetLimit.allowed) {
      return Response.json(
        { error: 'sonnet fallback rate limited, try again shortly' },
        {
          status: 429,
          headers: { 'Retry-After': String(sonnetLimit.retryAfterSec) },
        },
      );
    }
  }
  const modelId = useFallback ? MODEL_SONNET : MODEL_HAIKU;

  const bytes = new Uint8Array(await imageEntry.arrayBuffer());

  try {
    const result = await generateObject({
      model: anthropic(modelId),
      schema: ExtractionSchema,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: bytes,
              mediaType: imageEntry.type,
            },
            {
              type: 'text',
              text: 'Extract every event from this flyer into the ExtractionSchema format. Return only the structured object.',
            },
          ],
        },
      ],
    });

    return Response.json(result.object);
  } catch (error) {
    const e = error as { name?: string; message?: string };
    console.error('[extract]', e?.name ?? 'Error', e?.message ?? 'unknown');
    return Response.json({ error: 'extraction failed' }, { status: 500 });
  }
}
