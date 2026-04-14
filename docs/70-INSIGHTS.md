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
