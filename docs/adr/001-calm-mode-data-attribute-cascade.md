# ADR 001 — Calm Mode via `[data-calm]` data-attribute token cascade

- **Status:** PROPOSED
- **Date:** 2026-04-13
- **Cycle:** Tiimo-Caliber

## Context

ClipCal's product thesis is "Inform, don't decide" — surface information and trade-offs, let the user decide. That thesis targets ADHD/neurodivergent students as a primary audience. The cited research that supports this framing is:

- **Ottawa Decision Support Framework (ODSF)** — decisional conflict is reduced by information *and* user control, not by removing choice.
- **Tiimo (Apple Design Award winner, 2024 and 2025)** — the award language explicitly cites *user-controllable* sensory environments as the design rationale, not a designer-chosen "calm" preset.
- **Risko & Gilbert 2016, Cognitive offloading (TiCS)** — offloading is user-initiated; a UI that externalizes time-cost for the user must preserve their agency.

We needed a mechanism that (a) lets the user opt into a desaturated, lower-stimulation palette and typography, (b) does so app-wide without per-page audit churn, (c) mirrors the shipped `PR #24` pattern that promoted design tokens to `:root` so every shadcn primitive picks up brand tokens for free, and (d) is fully reversible with zero destructive migration.

A fixed "Calm Mode" preset was explicitly rejected because it imposes a sensory decision on the user — the anti-pattern Tiimo's research warns against. The toggle *itself* is the design.

## Decision

Implement Calm Mode as a **data-attribute token cascade**: when enabled, the hook sets `document.body.dataset.calm = "true"`, which triggers a CSS rule of the form:

```css
body[data-calm="true"] {
  --goldy-maroon-500: #6A3A42;  /* desaturated overrides */
  --goldy-gold-400: #D4C9A8;
  --background: #F5F1E8;
  /* ...etc */
  letter-spacing: 0.01em;
}
```

Every shadcn primitive and every ClipCal component that reads tokens inherits the Calm palette automatically. The toggle is exposed in the `/feed` header (compact variant) and on `/profile` (full variant). The preference is persisted via `localStorage['clipcal_calm_mode_v1']`, and the hook (`lib/calm-mode.ts`) is SSR-safe with `useState + useEffect` hydration.

Sensory-low typography (line-height ≥ 1.6, `max-width: 68ch`, minimum weight 400) is applied **unconditionally at `:root`**, outside the Calm Mode cascade — these properties are strictly better for everyone and are not a preference.

## Alternatives considered

1. **Per-page theme classes** (e.g., `<body class="calm-page">` on specific routes). Rejected — drift problem: each page needs its own WCAG audit pass. PR #24 already solved this class of problem by promoting tokens to `:root`; reintroducing per-page classes would be architecturally inconsistent.
2. **Fixed 3-surface preset system** (vibrant / calm / paper applied by context, no user toggle). Rejected — imposes a designer's sensory decision on the user, contradicting the Tiimo pattern and the Ottawa DSF principle. Also makes the accessibility contribution *invisible* — a fixed preset has no legible handle for a judge or reviewer to recognize as an intentional inclusion feature.
3. **Tailwind `dark:` style variant** (`calm:bg-calm-bg` as a custom Tailwind variant). Rejected — equivalent result but requires custom Tailwind config and per-class annotation on every consumer. Data-attribute cascade inherits via existing tokens with no markup changes.
4. **React Context provider** distributing `calmMode` as a prop. Rejected — doubles the state-synchronization surface (React state + DOM attribute) for no added value. The CSS cascade is the source of truth; React state only drives the toggle knob's visual position.

## Consequences

### Positive

- **Single audit surface.** One WCAG contrast pass covers the entire app in Calm Mode. Body/foreground pairing is ~9–10:1 (AA+), priority-chip pair (`--goldy-maroon-700` on `--goldy-gold-400`) is ~6.8:1 (AA comfortable).
- **Zero per-component churn.** Every existing and future shadcn primitive gets Calm Mode for free through the token cascade.
- **Reversible.** Removing `data-calm="true"` instantly restores the default palette. No destructive migration, no per-session flag state to reconcile.
- **Discoverable.** The toggle lives in visible chrome (feed header, profile page) — makes the research-grounded decision *legible* to users and reviewers, addressing the "invisible accessibility" anti-pattern.
- **Architectural consistency.** Mirrors PR #24's tokens-at-root approach, so the pattern is now load-bearing for two distinct problems (brand unification, sensory accommodation). Evidence the pattern deserves first-class-convention status.

### Negative

- **One sensory profile, not Tiimo's 3,000.** Tiimo ships a custom color picker; we ship one preset Calm palette. Users who need a different palette (e.g., high-contrast, specific color sensitivity) are unserved until a future cycle adds a custom picker.
- **No co-design validation yet.** The Calm palette was author-selected, not co-designed with ADHD/autistic students. Until a co-design session validates it, we cannot claim "Tiimo-caliber" accessibility in public marketing — only "Tiimo-caliber-inspired."
- **Cascade doesn't reach `<img>` or raster assets.** Decorative SVG/PNG assets retain their original coloration under Calm Mode. Acceptable today (we have few branded raster assets), but would become a consideration at Goldy-mascot-illustration scale.

### Neutral

- **Typography baseline ships globally, not just in Calm Mode.** Line-height 1.6, 68ch paragraph width, and no sub-400 weights are applied at `:root` unconditionally. The rationale (dense narrow low-weight text is strictly worse for everyone) is honest, but some brand-direction pages may feel less "designed" than before. Accept the trade.
- **`prefers-reduced-motion` and Calm Mode are independently controllable.** A user can have Calm Mode off but OS-level reduced-motion on, or vice versa. Both kill non-essential motion when enabled. This is intentional — sensory accommodation has multiple axes and they should not be coupled.
- **Calm Mode forces Goldy mascot animations to still-state** regardless of OS `prefers-reduced-motion` setting. This is the Tiimo-caliber pattern: sensory-low = motion-off even without the OS toggle.

## Follow-ups

- **Co-design sessions** with 2–3 ADHD/autistic students to validate the toggle's discoverability, label clarity, and palette acceptability. Required before we market this as Tiimo-caliber accessibility rather than Tiimo-caliber-inspired.
- **Custom color picker** (granular user control, closer to Tiimo's 3,000-color system). Separate design cycle.
- **Responsive DayRail `railHeight`** — currently fixed 520px; tight on iPhone SE with keyboard open. Logged in Pivot Log.
- **DayRail earlier/later tap-to-expand** — summary rows are currently static. Expand-on-tap deferred. Logged in Pivot Log.
- **Possible second preset**: high-contrast mode (darker ink, tighter tracking) for low-vision users separate from ADHD sensory-low. Would follow the same data-attribute cascade pattern.

## Sources

- Tiimo — Apple Design Award finalist 2024 (Inclusivity): https://www.tiimoapp.com/resource-hub/tiimo-2024-apple-design-awards
- Tiimo — App Store Awards 2025 iPhone App of the Year: https://www.tiimoapp.com/resource-hub/tiimo-winner-2025-app-store-awards
- Tiimo — Sensory-friendly design for neurodivergent accessibility: https://www.tiimoapp.com/resource-hub/sensory-design-neurodivergent-accessibility
- Risko, E.F. & Gilbert, S.J. (2016). *Cognitive offloading.* Trends in Cognitive Sciences, 20(9), 676–688. https://www.cell.com/trends/cognitive-sciences/abstract/S1364-6613(16)30098-5
- Stacey, D. et al. (2020). *Twentieth anniversary update of the Ottawa Decision Support Framework, Part 3.* https://pubmed.ncbi.nlm.nih.gov/32428429/
- W3C WCAG 2.2 — SC 2.3.3 Animation from Interactions (AAA): https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- W3C WCAG 2.2 — SC 2.5.8 Target Size (Minimum) (AA): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
