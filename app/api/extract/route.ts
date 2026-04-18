import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ExtractionSchema } from '@/lib/schema';
import { extractLimiter, sonnetLimiter } from '@/lib/rate-limit';
import { MODEL_HAIKU, MODEL_SONNET } from '@/lib/models';
import { requireAnthropic, logError } from '@/lib/api-utils';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

// Magic-byte signatures for the allowlisted formats. Client-provided MIME
// alone is not trusted (Security Rule 7 — file upload). A mismatch between
// the claimed type and the actual bytes is a hard 400.
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // WEBP: 'RIFF' .... 'WEBP'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

function todayInChicago(): string {
  // en-CA yields YYYY-MM-DD; time zone pins it to the flyer audience clock,
  // not the serverless region's UTC.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function buildSystemPrompt(): string {
  const today = todayInChicago();
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
- dressCode: short phrase from the flyer if stated (e.g. "business casual", "cocktail attire", "costume encouraged"), or null. Do NOT infer — only include if printed.
- room: specific room or floor hint beyond the venue building (e.g. "Room 3-180, 2nd floor", "Basement ballroom"), or null. Only include if the flyer states it.
- signupUrl: if the flyer prints a URL (usually near or below a QR code), extract it here. Must start with http:// or https:// — if the flyer shows a short form like "z.umn.edu/cs2026", prepend "https://" so the value is "https://z.umn.edu/cs2026". Prefer the shortest visible form over long tracking URLs. Must be clearly readable — do NOT guess or invent a URL. null if no URL is printed or not readable.
- hasQR: true if a QR code is visible anywhere on the flyer, false otherwise. Set the same value for every event from a given flyer.

If multiple events appear on the flyer, return ALL of them. Never skip an event.
Set sourceNotes to anything noteworthy about the flyer itself (hard to read, unusual format, multiple dates listed) or null.`;
}

export async function POST(req: Request): Promise<Response> {
  const gate = requireAnthropic(req, extractLimiter);
  if (!gate.ok) return gate.response;
  const { clientIp } = gate;

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

  const sniffedType = sniffImageType(bytes);
  if (!sniffedType) {
    return Response.json(
      { error: 'image content does not match any supported format' },
      { status: 400 },
    );
  }
  // image/jpg is a common client alias for image/jpeg — treat as equivalent.
  const claimedType = imageEntry.type === 'image/jpg' ? 'image/jpeg' : imageEntry.type;
  if (sniffedType !== claimedType) {
    return Response.json(
      { error: 'image content does not match declared type' },
      { status: 400 },
    );
  }

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
              mediaType: sniffedType,
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
    logError('extract', error);
    return Response.json({ error: 'extraction failed' }, { status: 500 });
  }
}
