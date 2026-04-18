// Safe-by-construction URL linkifier for Haiku-generated text.
//
// Returns a discriminated-union segment array — never HTML. The thin
// `<Linkified>` component maps each segment to a React node, so JSX's
// automatic escaping guarantees no injected markup can ever reach the DOM.
//
// Defense layers (same pattern as lib/qr-decode.ts and lib/schema.ts):
//   1. Regex pre-filter accepts only `https?://` candidates — every other
//      scheme (javascript:/data:/file:/ftp:) is never a match.
//   2. `new URL()` parse validates host presence and re-confirms the
//      protocol — catches malformed `https://` inputs that pass the prefix.
//   3. Trailing punctuation is peeled off the match tail so sentence-final
//      characters don't become part of the href.

export type LinkifySegment =
  | { type: 'text'; value: string }
  | { type: 'link'; href: string; value: string };

// No /g flag is intentional: this regex only inspects the tail of a
// matched string via .exec(). Adding /g would make lastIndex advance
// across calls and silently break tail-strip on alternating iterations.
const TAIL_PUNCT_RX = /[.,;:!?)\]}]+$/;

// Upper bound on an emitted href. Keeps `schema.ts` signupUrl parity
// (2048) and prevents an abusive flyer from producing a multi-KB anchor
// that damages layout or slows the render path. Over-length candidates
// fall through to plain text.
const MAX_URL_LENGTH = 2048;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function linkifySafe(input: string): LinkifySegment[] {
  if (!input) return [];
  // Fresh regex per call — module-level /g regex leaks `lastIndex` across
  // calls if a throw or early-return leaves it mid-iteration.
  const candidateRx = /https?:\/\/[^\s]+/gi;
  const segments: LinkifySegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = candidateRx.exec(input)) !== null) {
    const rawMatch = match[0];
    const matchStart = match.index;
    const tailHit = TAIL_PUNCT_RX.exec(rawMatch);
    const tail = tailHit ? tailHit[0] : '';
    const core = tail ? rawMatch.slice(0, rawMatch.length - tail.length) : rawMatch;

    if (core.length <= MAX_URL_LENGTH && isHttpUrl(core)) {
      if (matchStart > lastIndex) {
        segments.push({ type: 'text', value: input.slice(lastIndex, matchStart) });
      }
      segments.push({ type: 'link', href: core, value: core });
      lastIndex = matchStart + core.length;
      // Rewind so the peeled tail char joins the next text segment.
      candidateRx.lastIndex = lastIndex;
    }
    // If validation fails, we leave lastIndex unchanged — the raw match
    // stays in the text stream and is emitted by the tail-flush below
    // or the next pre-text slice.
  }
  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return segments;
}
