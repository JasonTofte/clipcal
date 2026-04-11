# ClipCal — Full Build Plan

> **Hackathon:** Fri Apr 10 (today) → Mon Apr 13, 2026 · 5:45 PM deadline
> **Current state:** scaffolded + researched, zero app code yet
> **Repo:** https://github.com/JasonTofte/clipcal (public, framework-IP-excluded)

---

## Quick Reference

| Thing | Value |
|---|---|
| **Stack** | Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui · Vercel AI SDK · Anthropic (`@ai-sdk/anthropic`) |
| **Vision model** | Claude Haiku 4.5 (primary, ~$0.002/image) · Claude Sonnet 4.5 (fallback button) |
| **Calendar out** | `ics` npm package (.ics download) + Google/Outlook render-URL deeplinks |
| **Calendar in** | Google Calendar `freebusy.query` (scope: `calendar.readonly`) + demo-mode fake calendar |
| **Persistence** | `localStorage` only · NO auth · NO database |
| **Deploy** | Vercel (free tier) |
| **Mobile UX** | `<input type="file" capture="environment" multiple>` + `ClipboardEvent` paste + react-dropzone |
| **Language constraint** | "Inform, don't decide" — no auto-decline, no streak shame, no "we recommend" |
| **Session command** | `claude-clip [branch-name]` (worktree-isolated) |

---

## The 4 moats (what makes us win)

1. **Conflict detection on ingest** (freebusy) — zero competitors have it
2. **Multi-event extraction** from one flyer (club semester schedules) — Apple/Google are 1/image
3. **Mobile web** — zero competitors (all iOS)
4. **ADHD "inform don't decide" layer** — week density + noticings + leave-by clock (unique positioning)

---

## Session 1 — Fri Eve (TONIGHT) · The Feasibility Gate

**Goal:** Prove Claude vision + structured output correctly extracts events from a real flyer. If this works, everything else is UI. If it doesn't, we pivot before 10 PM.

**Time budget:** 2–3 hours
**Session start:** `claude-clip feature/scaffold`

### Steps

1. **Sherlock Step 0 classification** — this is Sherlock Lite (3–5 files, 0 risk multipliers). Present all three options and wait for user pick.
2. **Scaffold Next.js 15 app** in the worktree:
   ```bash
   npx create-next-app@latest . --ts --tailwind --app --no-src-dir --no-eslint --no-import-alias
   ```
   Then `npx shadcn@latest init` and add: `button card input textarea badge`.
3. **Install AI SDK**:
   ```bash
   npm install ai @ai-sdk/anthropic zod
   ```
4. **Create `/lib/schema.ts`** — Zod schema for extracted events (array, since multi-event is a moat):
   ```ts
   export const EventSchema = z.object({
     title: z.string(),
     start: z.string(),        // ISO 8601 with TZ
     end: z.string().nullable(),
     location: z.string().nullable(),
     description: z.string().nullable(),
     category: z.enum(['workshop','networking','social','cs','career','culture','sports','hackathon','other']),
     hasFreeFood: z.boolean(),
     timezone: z.string(),     // IANA
     confidence: z.enum(['high','medium','low']),
   })
   export const ExtractionSchema = z.object({
     events: z.array(EventSchema).min(1),
     sourceNotes: z.string().nullable(),  // anything noteworthy about the flyer itself
   })
   ```
5. **Create `/app/api/extract/route.ts`** — POST endpoint that accepts an image (base64 or FormData), calls Claude Haiku 4.5 via `generateObject`, returns typed JSON. System prompt includes `"Today is 2026-04-10, TZ America/Chicago"` so relative dates resolve.
6. **Create `/app/page.tsx`** — bare minimum: file input, button to POST, `<pre>` to render returned JSON. No styling yet.
7. **TEST ON A REAL FLYER** — download any UMN event flyer from Instagram / Google Images. POST it. Inspect the JSON. **This is the gate.**
8. **Commit only if it works.** Branch: `feature/scaffold`. Commit message: "scaffold: next.js + claude vision extraction working on test flyer".

### Definition of Done (Session 1) — ✅ COMPLETE

- [x] Next.js runs on `npm run dev` with no errors *(Next 16.2.3 + Turbopack ready in 275ms; `npm run build` clean, TypeScript passes in ~1s)*
- [x] One real flyer returns a valid `ExtractionSchema` JSON *(2 real flyers POSTed to `/api/extract` via curl; both HTTP 200 with valid schema; browser UI also verifiable on the running dev server)*
- [x] JSON has sensible title, ISO-formatted `start`, correct `hasFreeFood` *(flyer 1: "Ryan Meetup" → social/low confidence; flyer 2: "Grand Opening - We Are Hiring" → career/medium confidence; both `hasFreeFood: false` matching the flyers)*
- [x] `ANTHROPIC_API_KEY` in `.env.local` (gitignored) *(verified via `git check-ignore -v .env.local` matching `.gitignore:67`)*
- [x] Committed to `feature/scaffold`, NOT merged to main yet

**Stack upgrade flagged during build:** `create-next-app@latest` pulled Next.js **16.2.3** (not 15) + **Tailwind 4** (not 3) + **Zod 4** + **AI SDK v6**. All post-training-cutoff. Verified the `generateObject` + `ImagePart` API shape by reading `node_modules/ai/dist/index.d.ts` directly before writing the route — zero rework on first run.

**Session 1 latency baseline:** Claude Haiku 4.5 vision: 3.5–7.9 s per flyer depending on output token count. Session 2 loading-state copy should target ~5 s with a 15 s hard timeout as the ceiling.

**Known Session 2 cleanup items (not blockers):**
1. Model occasionally emits stray `\n` prefix on `start` field → add `z.string().transform(s => s.trim())` to schema
2. 400 error body in `/api/extract` echoes `imageEntry.type` unsanitized (low risk, cosmetic — `.slice(0, 64)` or omit)
3. AC-2 schema test asserts `.toThrow()` without checking error path points at `category` (tighten to `toThrowError(/category/)`)

### Kill-switch decisions

- If extraction is garbage on 3 different flyers → try Claude Sonnet 4.5, not Haiku
- If still garbage → pivot to simpler scope (single-event extraction, ditch multi-event moat)
- If Sonnet hits rate limits → fall back to Haiku with bigger examples in the prompt

### Files created this session

```
app/
  page.tsx                 (dropzone + results display)
  api/extract/route.ts     (POST image → JSON)
  layout.tsx               (Tailwind root)
lib/
  schema.ts                (Zod schemas)
.env.local                 (ANTHROPIC_API_KEY — gitignored)
```

---

## Session 2 — Sat AM · Upload UX + Editable Card

**Goal:** Make the flyer→event flow feel polished and mobile-ready.
**Time budget:** 3–4 hours
**Session start:** `claude-clip feature/upload-ux`

### Steps

1. **Dropzone component** (`components/dropzone.tsx`) — react-dropzone, accepts multiple images, drag + click + paste.
2. **Clipboard paste listener** (`useEffect` on window) — `navigator.clipboard` + `ClipboardEvent`, calls same handler as drop.
3. **Mobile camera capture** — `<input type="file" accept="image/*" capture="environment" multiple>` inside the dropzone.
4. **Loading states** — spinner + "Claude is reading your flyer…" copy. Stream a "worth noticing: {field}" ticker if possible (visual delight).
5. **Editable event card** (`components/event-card.tsx`) — every field is `contenteditable` with a subtle hover style. User can fix anything before committing.
6. **Multi-event handling** — if `events.length > 1`, show as stacked cards with a "+ add all" button.
7. **Confidence badges** — color-coded pill (emerald/amber/rose) on each card.
8. **Test on real iPhone + Android** — use the Vercel preview deploy URL, not localhost.

### Definition of Done (Session 2)

- [ ] Drag, drop, paste, click, mobile camera all work
- [ ] Multi-event flyer renders as multiple cards
- [ ] Every field is inline-editable
- [ ] Loading state is non-ugly
- [ ] Tested on a real phone via Vercel preview

---

## Session 3 — Sat PM · Calendar Export + Conflict Detection

**Goal:** Close the loop — users can actually save events, and see conflicts before committing.
**Time budget:** 3–4 hours
**Session start:** `claude-clip feature/calendar-export`

### Steps

1. **Install `ics`**: `npm install ics`
2. **`lib/ics.ts`** — takes an `EventSchema` object, returns a Blob URL for download. Handle single + multi-event .ics files.
3. **Google render-URL deeplink** — `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&location=...` (no OAuth).
4. **Outlook render-URL deeplink** — `https://outlook.live.com/calendar/0/deeplink/compose?...`.
5. **Three buttons in the event card**: `Add to Calendar` (.ics), `Google`, `Outlook`.
6. **Google Calendar `freebusy.query` integration**:
   - `/app/api/freebusy/route.ts` — accepts event timewindow, calls Google API with OAuth access token
   - **OAuth flow**: use `google-auth-library`, scope `https://www.googleapis.com/auth/calendar.readonly`, redirect → `/auth/callback` → store token in `localStorage`
   - **OR** build it dead simple: no OAuth, just a single "Connect Google" button that opens the consent screen
7. **⚠ CRITICAL: Demo mode fallback** — a toggle in the footer that swaps `freebusy` for a hardcoded fake calendar with 3 events (lecture Tue 6–7:15 PM, gym Thu 5–6 PM, dinner Fri 7 PM). **This is what you demo to judges** — don't risk live OAuth on stage.
8. **Conflict badge on event cards** — green "✓ you're free" / red "⚠ overlaps {title}" based on freebusy result.

### Definition of Done (Session 3)

- [ ] `.ics` downloads work on iOS, Android, Chrome desktop
- [ ] Google deeplink opens Google Calendar with event pre-populated
- [ ] Freebusy integration OR demo-mode toggle shows real conflict badges
- [ ] Demo-mode toggle works and is visible in the UI

---

## Session 4 — Sun AM · AI Chat Interviewer + Relevance Scoring

**Goal:** Ship the personalization layer that turns ClipCal from utility → story.
**Time budget:** 4–5 hours
**Session start:** `claude-clip feature/chat-interviewer`

### Steps

1. **`/app/interview/page.tsx`** — the chat UI (borrow visual language from mockup 02).
2. **`/app/api/chat/route.ts`** — Vercel AI SDK `useChat` transport, streams Claude Haiku responses.
3. **System prompt** — explicit ADHD-friendly framing: *"You are a noticer, not a warden. You will never auto-decline events. You ask 4–5 short questions about the user's studies, interests, and how they want info surfaced, then you stop."*
4. **Profile extraction** — after chat completes, call `generateObject` with `ProfileSchema`:
   ```ts
   z.object({
     major: z.string().optional(),
     stage: z.enum(['freshman','sophomore','junior','senior','grad']).optional(),
     interests: z.array(z.string()),
     preferences: z.object({
       showTradeoffs: z.boolean(),
       surfaceNoticings: z.boolean(),
     }),
     vibe: z.string().optional(),
   })
   ```
5. **Store profile in `localStorage.clipcal_profile`**.
6. **Live profile panel** (from mockup 02) — right sidebar that patches in live as the user types. Use `generateObject` with the partial transcript every 2 user messages.
7. **Relevance scoring** on event cards — when an event is extracted, also pass the profile to Claude to get a `{score: number, reason: string}`. Show as match percentage + tag highlights.
8. **"Skip to form" fallback** — a checkbox grid of 20 interests as the safety net if chat breaks.

### Definition of Done (Session 4)

- [ ] Chat streams, completes in ~90 seconds
- [ ] Profile JSON appears in localStorage
- [ ] Live profile panel updates as user types
- [ ] Event cards show match score + reason
- [ ] Fallback form works if chat is broken

---

## Session 5 — Sun PM · ADHD Layer + Feed + Polish

**Goal:** Ship the differentiating ADHD-support layer and the feed.
**Time budget:** 4–5 hours
**Session start:** `claude-clip feature/adhd-layer`

### Steps

1. **`lib/noticings.ts`** — deterministic generator (NOT LLM) that produces noticings from an event + calendar state:
   - `🚶 N-min walk` (if we can estimate from location string vs. a hardcoded "home" location)
   - `✨ first open {day}` (check density)
   - `😴 no early class {next day}` or `⚠ 8 AM class next day`
   - `🔁 back-to-back with {neighbor event}`
   - `🎥 {conflicting class} usually recorded` (hardcoded mapping for demo — UMN CSCI 5801 is recorded)
   - **Rule**: no noticing ever says "don't go". Language is neutral + informative.
2. **`components/week-density.tsx`** — 7-day strip (port from mockup 03) showing existing calendar blocks. Bottom insight line: "First open Saturday this week. Tue is back-to-back."
3. **`components/leave-by.tsx`** — deterministic "leave by" clock. Estimate walk time (or hardcode 12 min for demo); subtract from start time.
4. **`/app/feed/page.tsx`** — the "forgotten events" feed. Shows events from `localStorage.clipcal_parsed_events`, sorted by match score. Filter pills: all / free food / no conflicts / this week.
5. **Free food filter** — already a boolean on the schema; just filter.
6. **Forgotten events section** — events added to localStorage >7 days ago but not yet calendar-committed. Nostalgia copy: "You screenshotted this 14 days ago, the event is tomorrow."
7. **PWA manifest** — `public/manifest.json` so users can add to home screen.
8. **Deploy to Vercel** — push to main, connect repo, get a memorable URL.

### Definition of Done (Session 5)

- [ ] Noticings chips render on every event card (never a "don't go" message)
- [ ] Leave-by clock shows a concrete time
- [ ] Week density strip shows real calendar state (or demo mode)
- [ ] Feed shows multiple events sorted by match
- [ ] Forgotten events section works
- [ ] Deployed to Vercel with a memorable URL

---

## Session 6 — Mon AM · Demo Prep + Final Polish

**Goal:** Demo that doesn't break. Deck that closes the deal.
**Time budget:** 4–5 hours
**Session start:** `claude-clip feature/demo-prep`

### Steps

1. **5 guaranteed-to-work test flyers** — curate, save to `/public/demo-flyers/`. Pre-validate extraction on each.
2. **Demo script** (`docs/demo-script.md`) — 3-minute walkthrough:
   - *"60% of college students never attend a campus event. Not because they don't want to — because the flyer dies in their camera roll."* (cite Inside Higher Ed)
   - *"I'm Jason. I built ClipCal — the only mobile web flyer scanner with a conflict-aware, ADHD-supportive design."*
   - Live demo: paste flyer → see match score + noticings + leave-by
   - Show the "forgotten events" feed
   - Close with the design principle: *"inform, don't decide"*
3. **Pitch deck** (Google Slides or `docs/pitch.md` → pandoc) — use quotes from Inside Higher Ed + Corq 1★ reviews + the Tiimo design principle.
4. **Grab r/uofmn quotes** — manually browse for 10 min and find a real UMN student complaint about events.
5. **Mobile-device sanity test** — final round on iPhone + Android + laptop.
6. **Vercel URL** — memorable, maybe `clipcal.vercel.app` if available.
7. **Open tabs for the demo** — browser pre-positioned, terminal closed, Spotify paused.

### Definition of Done (Session 6)

- [ ] 5 demo flyers load in < 3 seconds each
- [ ] Demo script ≤ 3 minutes, practiced 5 times
- [ ] Pitch deck has the 3 key quotes + 1 competitive table
- [ ] Final mobile test passes
- [ ] Memorable Vercel URL live

---

## Demo Script (draft — refine in Session 6)

> **Hook (15 sec):** *"60% of college students never attend a campus event. Not because they don't want to. Because the flyer they screenshotted dies in their camera roll. One of our users said 'I take screenshots and forget about them.'"*
>
> **Show (60 sec):** *"ClipCal runs on any phone's browser — no install. Watch."* → paste flyer → JSON extracts in 3 seconds → show match score + noticings chips + leave-by clock. *"Green badge: I'm free. Red chip: I have CSCI 5801 at the same time — but the noticing below tells me that class is usually recorded. ClipCal doesn't decide for me. It just shows me what my brain needs."*
>
> **Differentiator (45 sec):** *"Apple's iOS 26 feature extracts one event per image. Google Lens is one-shot. Photo2Calendar is iOS only. None of them know your campus, none of them check your calendar for conflicts, and none of them are built for ADHD brains. We do all four."*
>
> **Close (30 sec):** *"Our design principle is inform, don't decide. Grounded in cognitive offloading research and the Ottawa Decision Support Framework. No auto-decline, no streak shame, no 'we recommend.' We surface the trade-offs. You make the call. ClipCal is live at clipcal.vercel.app — try it with any flyer."*

Total: ~2:30.

---

## Kill List (do NOT build)

- ❌ Instagram URL scraping (Meta oEmbed gutted Nov 2025, ToS-hostile)
- ❌ Auth system / user accounts (stateless IS the pitch)
- ❌ Database (localStorage only)
- ❌ Shared social event wall (network effects can't demo)
- ❌ Chrome extension (Screenshot2Calendar owns it, mobile is the play)
- ❌ Tesseract.js (embarrasses on stylized flyers)
- ❌ "Siri Suggestions"-style auto-adds (violates inform-don't-decide)
- ❌ Streak counters, red-badge nagging, infantilizing copy
- ❌ Tinder-swipe onboarding UX (finicky on projector)
- ❌ Backwards-compat / error-handling scaffolding beyond what demo needs
- ❌ "Resolve conflict" button — replaced with "Add anyway · you decide"

---

## Risks (ranked by severity)

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | **Claude extraction fails on stylized flyers** | Medium | Sonnet fallback button + editable card. Validate on 5 real flyers Session 1. |
| 2 | **Google OAuth consent friction mid-demo** | High | Demo-mode toggle with fake calendar. Build Session 3. |
| 3 | **Venue WiFi blocks streaming** | Medium | Pre-cache demo responses; have screen recording as last resort |
| 4 | **Mobile Safari paste doesn't work** | Low | Test on real iPhone Session 2. Fallback: file input. |
| 5 | **AI SDK `generateObject` has breaking change** | Low | Pin versions in package.json |
| 6 | **Run out of time on Session 5 features** | High | Ship ADHD layer BEFORE the feed — it's the moat. Feed is secondary. |
| 7 | **Rate limits on Haiku** | Low | Parallelize sparingly; Sonnet in reserve |

---

## Daily Scope Guardrails

**If you're ahead of schedule, do these in order:**
1. Free food radar filter (viral appeal)
2. Campus ICS enrichment (if CampusGroups feeds are CORS-accessible)
3. PWA share target (accept shared images from iOS/Android share sheet)
4. "Show your work" expand on every noticing chip

**If you're behind schedule, cut these in order:**
1. Campus ICS enrichment
2. Multi-event extraction (fall back to single)
3. Live profile panel updates (just do it at chat end)
4. Forgotten events section (keep the feed, drop nostalgia framing)
5. Outlook deeplink (Google is enough)

**NEVER cut:**
- Conflict badge (the moat)
- Noticings chips (the differentiator)
- Leave-by clock (the ADHD moment)
- Chat interviewer (the narrative)
- Editable card (the trust layer)
- Mobile testing (the promise)

---

## Framework Hygiene (applies to every session)

1. **Sherlock Step 0** first — classify every task before writing code
2. **Worktree per feature** — `claude-clip feature/<topic>` isolates work
3. **Branch → PR → review → merge** — don't commit straight to main
4. **Never commit the framework** — the gitignore is set, but double-check `git status` before every commit
5. **`.env.local` is sacred** — never commit, never echo, never screenshot during demo
6. **Prettier on markdown** before commits (pre-commit hook per user's past feedback)
7. **No scope creep** — if you discover a new feature mid-session, add it to this plan, don't build it

---

## First-Session Kickoff Prompt

Paste this into the next Claude session to start fast:

```
I'm starting Session 1 of the ClipCal hackathon. Read docs/plan.md in full,
then classify via Sherlock Step 0 and present all three workflow options with
your recommendation. Goal: scaffold Next.js + prove Claude vision extraction
works on a real flyer. This is the feasibility gate. Use Claude Haiku 4.5 via
@ai-sdk/anthropic + generateObject + the Zod schema defined in the plan.
Target: 2-3 hours. Do NOT commit anything until the test flyer returns valid
JSON. My API key is in ~/.anthropic or I'll add it to .env.local when asked.
```

---

## Success Criteria for the Whole Hackathon

By Mon Apr 13, 5:45 PM the judges should be able to:

1. Visit `clipcal.vercel.app` on their phone
2. Paste/drop/snap any campus flyer
3. See the event extract in <5 seconds
4. See a match score, noticings chips, leave-by clock, and conflict badge
5. One-tap add to their calendar (.ics or Google deeplink)
6. Optionally go through the chat interviewer and see the feed

If all 6 work on two judges' phones, we've won the demo.

---

*Last updated: 2026-04-10 (post-scaffold, pre-Session-1)*
