# ADR 002 — Safe URL linkifier via segment-array discriminated union

- **Status:** PROPOSED
- **Date:** 2026-04-17
- **Cycle:** Tiimo-Caliber (post-PR-#82 follow-up)

## Context

Claude Haiku's flyer-extraction pipeline produces two streams of free-text output that can reach the DOM:

1. `signupUrl` — already constrained via `lib/schema.ts` (Zod `.url() + refine(^https?://) + .max(2048)`), rendered as `<a href>` in card chips.
2. `sourceNotes` — free-form prose ("Flyer mentions z.umn.edu/beltsander for more info", "QR reference at bottom…"). Until this cycle, rendered as a plain text node.

A real user upload surfaced the UX gap: `sourceNotes` often contains a URL that the user would reasonably expect to tap, but rendering it as plain text means they can't. We needed to linkify URLs inside `sourceNotes` without creating a new XSS surface. The flyer text is untrusted (a flyer photograph can contain any characters) and the model output path passes through a vision model, so adversarial injection is a real concern — not a hypothetical.

The narrow design question: how do we turn `"See https://example.com/page. More info below."` into a DOM tree containing a real `<a href="https://example.com/page">` without ever constructing an HTML string?

## Decision

Implement linkification as a **pure function returning a discriminated-union segment array**, rendered by a trivial React shim:

```ts
// lib/linkify.ts
export type LinkifySegment =
  | { type: 'text'; value: string }
  | { type: 'link'; href: string; value: string };

export function linkifySafe(input: string): LinkifySegment[];
```

```tsx
// components/linkified.tsx
export function Linkified({ text }: { text: string }) {
  return <>{linkifySafe(text).map((seg, i) =>
    seg.type === 'link'
      ? <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer">{seg.value}</a>
      : <Fragment key={i}>{seg.value}</Fragment>
  )}</>;
}
```

Three defense layers inside `linkifySafe`:

1. **Regex pre-filter** `/https?:\/\/[^\s]+/gi` — only http(s) candidates ever reach validation. `javascript:`, `data:`, `file:`, `ftp:` never match.
2. **`new URL()` parse** — rejects malformed authority (`https://` with no host, `https:// example.com` with a space) and re-confirms `u.protocol === 'http:' || 'https:'` in case URL normalization did something unexpected.
3. **Length cap** — `MAX_URL_LENGTH = 2048` matches the existing `signupUrl` schema limit so an abusive flyer can't produce a multi-KB anchor that damages layout or slows the render path.

Trailing sentence punctuation (`.,;:!?)]}`) is peeled off the regex match tail so a period at end of sentence becomes its own text segment, not part of the href.

## Alternatives considered

1. **Regex-replace + `dangerouslySetInnerHTML`.** The obvious pattern: escape the input's HTML, regex-replace URL matches with `<a>` tags, dump into `dangerouslySetInnerHTML`. Rejected — two error-prone passes (escape first, then insert anchors). Any future regression (a forgotten escape) becomes a live XSS. The segment array makes unsafe output *structurally impossible* because React escapes `{value}` in JSX text nodes automatically; there is no code path that constructs an HTML string from untrusted input.
2. **A library (`linkify-it`, `linkifyjs`, `react-linkify`).** Rejected — ~30-50 KB bundle cost for a feature that needs ~60 LOC, broader URL grammar than required (email, IP, IDN, etc.), and harder to audit at the defense-layer level. Our http(s)-only strict filter is auditable in its entirety in one reading.
3. **Extend `lib/resolve-signup-chip.ts` to emit anchor elements.** Rejected — that helper is a state gate for the three-branch signup chip. Linkification is a text-rendering concern. Conflating them makes both harder to test and harder to reason about (a single function would couple "is there a sign-up link" with "does this arbitrary string contain URLs").
4. **Run linkification server-side and cache the segment array on the event.** Rejected — `sourceNotes` is consumed exactly once per render, the input is small (≤500 chars typical), and server-side escape adds a network round-trip to the source of truth. Client-side linkification is cheaper and keeps the anchor structure under React's escaping guarantees rather than trusting a round-trip.
5. **Render the URL as plain text in `sourceNotes`.** Rejected — this is literally the status quo that prompted the user complaint. The affordance gap is real.

## Consequences

### Positive

- **Structural XSS safety.** The only code path from untrusted text to `<a href>` passes through `isHttpUrl()` + `MAX_URL_LENGTH` + `new URL()` parse. No HTML string is ever constructed from untrusted input. No `dangerouslySetInnerHTML` exists in the consuming component. Even a future bug in the regex pre-filter cannot produce an unsafe href — the `new URL()` parse + protocol check is the authoritative guard.
- **Trivially testable.** The pure function has 20 unit tests locking every AC (split, tail-strip, rejection, bare-domain preservation, length cap). The render shim is a 5-line map with nothing to test — any bug would surface via the integration test on `HomeSuccessView`.
- **Reusable.** Any future surface that renders Haiku free text can wrap it in `<Linkified>` with zero changes. `description` fields, Goldy commentary, extraction notes — all safe-by-construction once they adopt the component.
- **Defense pattern consistency.** Mirrors `lib/qr-decode.ts:13-24` and `lib/schema.ts:37-45` — regex prefix + `new URL()` parse + strict protocol equality. One pattern, three call sites. The code explicitly documents this lineage at `lib/linkify.ts:7-13`.

### Negative

- **Bare domains stay text.** `z.umn.edu/beltsander` (no scheme) never linkifies. This is intentional — inferring scheme on untrusted text is how phishers slip `javascript:` past filters — but it means UMN-style short URLs in flyer notes won't become links unless Haiku prepends `https://`. We mitigated with a one-line prompt nudge, but the linkifier itself refuses to guess.
- **Two URL-validation helpers in the codebase.** `lib/qr-decode.ts` has `isSafeUrl`; `lib/linkify.ts` has `isHttpUrl`. Both do `new URL()` + protocol check. Deliberately not extracted into a shared `lib/url-safe.ts` yet — YAGNI at 2 call sites, especially for security-critical code where each call site benefits from an in-file test suite and reviewer co-location. Revisit if a third consumer appears.
- **Render shim is tightly coupled to the linkify shape.** `<Linkified>` imports `linkifySafe` directly. Harmless today (they're a matched pair), but a future generalization (e.g., pluggable segment renderers for mentions, hashtags) would require breaking the direct import.

### Neutral

- **Trailing-punct strip is implementation-defined at one edge.** `linkifySafe("https://example.com/foo(bar)")` strips the closing paren even though it's arguably part of the path. The alternative — balanced-paren tracking — adds real complexity for a rare case in flyer text. Test T-13 documents the current choice so regressions surface.
- **Prompt nudge changes Haiku behavior.** The one-line addition to the extraction system prompt ("When mentioning a URL in sourceNotes, include the full https:// prefix") slightly increases the probability that other notes also receive schema prefixes when mentioning URL-adjacent strings. Observed impact negligible; flag for monitoring.

## References

- `lib/linkify.ts` — implementation
- `lib/linkify.test.ts` — 20 P0 tests
- `components/linkified.tsx` — render shim
- `components/home-success-view.tsx:90-93` — call site
- `lib/qr-decode.ts:13-24` — precedent URL-validation pattern
- `lib/schema.ts:37-45` — schema-level URL validation (signupUrl)
- WCAG 2.1 Success Criterion 2.5.3 (Label in Name) — https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html (applies to the co-landed signup-chip aria-label fix, not linkify directly)
