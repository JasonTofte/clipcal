// Precedence for the signupUrl attached to each extracted event.
// On-device QR decode wins when it succeeds — it reads the authoritative
// payload of the QR itself, not a pixel-OCR guess. The LLM-extracted URL
// (visible text printed on the flyer near the QR) is the fallback.
export function mergeSignupUrl(
  qrUrl: string | null,
  llmUrl: string | null | undefined,
): string | null {
  return qrUrl ?? llmUrl ?? null;
}

// Type note: qrUrl is narrowed to `string | null` matching decodeQRFromFile's
// return type; llmUrl accepts `undefined` because Zod-optional fields arrive
// missing rather than null on round-trips. Return is always `string | null`,
// which is safe for <a href={...}> (falsy renders no element via
// resolveSignupChip).
