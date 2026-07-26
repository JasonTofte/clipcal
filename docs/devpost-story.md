# Inspiration

Campus flyers pile up in camera rolls. For students with ADHD, the bottleneck isn't finding events — it's deciding if one is worth the switching cost. We wanted a tool that respects that cognitive load instead of papering over it with another "let AI plan your week" pitch.

Grounded in the [Ottawa Decision Support Framework](https://pubmed.ncbi.nlm.nih.gov/32428429/) (decisional conflict drops when users get information *and* agency) and [cognitive offloading theory](https://www.cell.com/trends/cognitive-sciences/abstract/S1364-6613(16)30098-5) (externalizing time lowers working-memory load). Our mantra: **inform, don't decide.**

# What it does

Snap a flyer → Claude extracts the event → conflict-checks your Google Calendar → surfaces trade-offs as "worth noticing" chips (*12-min walk · conflicts with your 3pm*) → one tap to `.ics` or Google/Outlook. A UMN Goldy Gopher mascot reacts to your schedule with hand-authored commentary.

# How we built it

**Stack:** Next.js 16 · TypeScript · Tailwind 4 · Claude Haiku 4.5 via Vercel AI SDK · Zod 4 · `localStorage` only.

- **Extraction:** `generateObject` with a Zod schema — the schema is the contract; Sonnet fallback on validation failure.
- **Goldy:** 120 hand-authored lines across 8 context buckets, picked deterministically by event-ID hash. Zero runtime LLM, fully offline, calendar data never leaves the browser.
- **166 Vitest tests** covering schema, conflict math, UTC-safe calendar grids, and the leave-by clock.

# Challenges

- **DST / timezone math** broke the month grid until we moved to UTC internally.
- **Multi-event flyers** (club semester schedules) collapsed into one event until the schema forced an array.
- **Resisting scope creep** — auto-decline and streaks were tempting and wrong.
- **Writing 120 mascot lines** that don't read like LinkedIn posts took longer than the AI pipeline.

# What we learned

- Structured output (Zod + `generateObject`) beats prompt engineering for reliability.
- Deterministic banks beat LLMs for character voice — cheaper, faster, more coherent.
- Cognitive offloading is a UX discipline, not a feature: the hard part is *not* adding helpful-seeming auto-decisions.

# What's next

Co-design sessions with ADHD/autistic students before any accessibility claims, Outlook + Apple Calendar parity, and expanding beyond UMN.
