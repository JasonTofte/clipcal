# ShowUp — Engineering & Design Insights

Non-obvious decisions, hard-won lessons, and design rationale that would otherwise live only in commit messages or be lost. Each entry uses the template below.

**Template:**
```
## [YYYY-MM-DD] Title

**Context:** What situation prompted this decision?
**Decision:** What did we do, and what did we reject?
**Why it matters:** Why is the chosen approach better than the obvious alternative?
**Sources / citations:** (if applicable)
**Follow-up:** Open questions or next steps this insight generates.
```

---

## [2026-04-17] Three-tier QR fallback: decode → LLM URL → hint chip

**Context:**

The on-device QR decoder (`BarcodeDetector` native, `qr-scanner` fallback) silently returns `null` on any decode failure — small QR, blurry photo, bad angle, partial occlusion, non-http(s) payload filtered out. Before this change, a `null` decode meant the flyer produced no signup affordance at all, even though the vision model (Claude Haiku) could clearly see the QR was there and often mentioned it in the extraction's `sourceNotes`. Users reported "the app knows there's a QR but doesn't do anything about it" — a silent-failure UX gap.

The naive fix is to surface the raw decode failure ("QR detected but unreadable"). But that punishes the user for a photo-quality problem they've already made, and offers nothing actionable.

**Decision:**

Layer two additional fallbacks in front of the existing decode, without removing it:

1. **Tier 1 (authoritative):** On-device decode of the QR payload. Wins whenever it succeeds — the decoder reads the actual QR, not a pixel guess.
2. **Tier 2 (vision guess):** Haiku now pulls any *printed* URL from the flyer text (commonly shown below the QR for accessibility) into `signupUrl`. This catches the case where the QR itself is too small/blurry to decode but the URL text is legible. Goes through the same `z.url() + refine(^https?://)` validator that blocks `javascript:`/`data:`/`file:` XSS payloads.
3. **Tier 3 (hint-only):** Haiku also reports `hasQR: true | false`. When neither decode nor visible-URL extraction produced a URL but `hasQR` is true, the event card shows a muted, deliberately-non-tappable "QR on flyer — scan original" chip. Dashed border + `cursor: default` + `select-none` + transparent background signals "this is a note, not a button."

Precedence is strict: Tier 1 > Tier 2 > Tier 3 > nothing. Pure `mergeSignupUrl(qrUrl, llmUrl)` helper and discriminated-union `resolveSignupChip` keep the logic trivially testable without a React render harness.

**Why it matters:**

- **Graceful degradation beats silent failure.** Each tier increases the chance the user gets an actionable path (working link > scannable flyer prompt > nothing) without promising more than we can deliver.
- **The non-link chip is a design decision, not laziness.** Making the Tier 3 chip look like a link would trick mobile users into tapping something that does nothing — trust-eroding. The dashed border + `cursor-default` treatment borrows the visual language of disabled/notice states across design systems.
- **`currentColor` for the chip border** means dark-mode contrast is automatic — the border follows the `--muted-foreground` text color through any theme cascade, so we don't need a dark-mode-specific token.
- **Prompt injection surface is narrow.** The `signupUrl` field passes through Zod before it ever touches `<a href>`, and we added a `.max(2048)` cap as defense-in-depth against a malformed flyer producing a multi-KB URL string.
- **Cognitive-isolated spec-to-test pipeline paid off.** Because the chip gate was extracted into a pure function, the RED phase wrote 17 tests against a discriminated union before any React code existed. No JSDOM, no Testing Library, no test-harness scope creep. The shipped tests ARE the record of coverage.

**Follow-up:**

- Watch `/api/extract` 500-rate post-deploy: the `.max(2048)` cap could theoretically trigger a schema validation failure if Haiku hallucinates a very long URL. The prompt says "prefer shortest visible form" to mitigate, but if we see 500s we'll add a `z.preprocess` step that coerces over-long URLs to `null` instead of throwing.
- Consider deriving Tier 3 *without* the LLM — look for a QR pattern in the `BarcodeDetector` output (the API returns position data even when the payload is undecodable). That would let us drop the `hasQR` prompt bullet entirely.

---

## [2026-04-13] Calm Mode: user-controllable toggle, not a fixed sensory preset

**Context:**

Early design directions for ShowUp's "ADHD-friendly" layer treated sensory accommodation as a fixed system: one set of surfaces would be "calm" (low-contrast, muted palette) and another "vibrant" (full UMN maroon/gold). The intent was good, but the implementation pattern is wrong — and Tiimo's Apple Design Award citations explain exactly why.

Tiimo won the Apple Design Award in both 2024 and 2025. The award language in both years explicitly cited *user-controllable* sensory environments as the design rationale. Not a designer-chosen "calm mode" that the system imposes. The control itself is the design.

This aligns with Risko & Gilbert (2016), which frames cognitive offloading as a *user-initiated* behavior: individuals with executive function differences need to externalize cognitive load on their own terms, not have the environment decide for them. Imposing a sensory preset removes the locus of control, which is precisely the thing the research says ADHD users need to retain.

The Ottawa Decision Support Framework (ODSF) adds a third angle: decisional conflict is increased when users feel they lack the information or control to make a choice. A fixed "calm" UI is a choice made for the user. A toggle is information plus control.

**Decision:**

We rejected a fixed 3-surface Calm Mode in favor of a single user-controllable toggle that:
1. Defaults OFF (full UMN maroon/gold warmth — the designed experience)
2. Persists the user's preference across sessions
3. Cascades via `[data-calm="true"]` on `<body>` — the entire app shifts in one frame, without per-component patching

Rejected alternatives (all documented in ADR `docs/adr/NNN-calm-mode-data-attribute-cascade.md`):
- Per-page calm/vibrant surface classes — drift problem, each page needs its own WCAG audit
- Fixed preset without toggle — rejects the Tiimo research pattern; imposes rather than empowers
- Tailwind `class="calm"` variant — equivalent but requires custom Tailwind config; data-attribute is simpler

**Why it matters:**

The distinction between "calm preset baked by designer" and "calm toggle owned by user" sounds subtle but has real product consequences:

1. **Trust.** If the app imposes a desaturated palette on ADHD users without their input, it signals "we know what's better for you." That's the streak-shame / infantilizing anti-pattern we explicitly reject in the design language.
2. **Demo clarity.** The toggle is a visible, tangible feature. A fixed preset is invisible; judges at a hackathon cannot see that we made intentional sensory choices. The toggle makes the research-grounded decision *legible*.
3. **Code maintainability.** Token cascade means every shadcn primitive (Button, Card, Badge, Input) picks up Calm Mode for free. A fixed preset would require per-surface audits every time a new component is added.
4. **WCAG audit surface.** With a single token override set at `[data-calm="true"]`, one contrast audit pass covers the entire app in Calm Mode. Per-surface presets require N audit passes.

**Sources / citations:**

- Tiimo, Apple Design Award 2024 — "user-controllable sensory environments" cited in award rationale
- Tiimo, Apple Design Award 2025 — second consecutive win, same rationale (user control, not designer-preset)
- Risko, E.F. & Gilbert, S.J. (2016). "Cognitive offloading." *Trends in Cognitive Sciences*, 20(9), 676–688. — frames offloading as user-initiated; relevant to why imposed environments miss the point
- O'Connor, A.M. et al. — Ottawa Decision Support Framework (ODSF) — decisional conflict is reduced by information + control, not by removal of choice

**Follow-up:**

- The strongest version of this insight requires co-design sessions with ADHD students to validate that the toggle is discoverable, labeled in language that resonates, and actually used. That falsifiable step is explicitly deferred from this cycle and logged as a required follow-up before ShowUp can claim "Tiimo-caliber" accessibility in public marketing.
- Future: custom color picker (Tiimo's 3,000-color system) would extend the toggle pattern into granular user control. Deferred; requires its own design cycle.
- Insight for ADR extraction: the `[data-calm="true"]` cascade pattern is the same architecture as PR #24's `.goldy-theme` token promotion. When the same architectural pattern solves two distinct problems (brand unification, sensory accommodation), it is evidence the pattern is load-bearing for this codebase and should be treated as a first-class convention.
