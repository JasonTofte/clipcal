# ClipCal — Hackathon Team Brief

**Hackathon:** 2026-04-10 → 2026-04-13 5:45 PM (3.5 days)
**Format:** Responsive web app (mobile-first PWA)
**Tagline:** *Your campus copilot. Snap a flyer, know if you should go.*

---

## TL;DR

1. **The generic "screenshot → calendar" space is saturated** (Photo2Calendar, Nori, Apple iOS 26, Google Lens, 6+ App Store apps). A pure OCR pitch loses.
2. **Every competitor is iOS-only, single-event, and campus-blind.** There is **no mobile web competitor**. Apple requires iPhone 15 Pro+, handles 1 event per image, and doesn't work on shared/DM'd flyers.
3. **Our moat = 4 things nobody combines:** conflict-aware ingest + multi-event extraction + campus ICS enrichment + AI interest profiling via chat interviewer.

---

## The Pitch (60 seconds)

> Students screenshot event flyers and forget them. 60% of college students never attend a campus event — not because they don't want to, but because the flyer lives on an Instagram story, gets screenshotted, and dies in the camera roll.
>
> ClipCal is a mobile web app. You paste, drop, or snap any flyer. Claude extracts the event (even 8 events from a club semester schedule), checks your Google Calendar for conflicts, cross-references GopherLink to enrich with RSVP links, and scores it against your interests — which we learned in a 90-second AI chat interview.
>
> Green badge = free. Red badge = conflict. "3/5 match — networking event with free food." One tap → `.ics` download.

---

## Why This Wins (Defensible Gaps)

| Gap | Who has it | Why it matters |
|---|---|---|
| **Conflict detection on ingest** (Google `freebusy.query`) | Nobody | 2-hour build, instant "wow" moment |
| **Multi-event from one flyer** | Nobody (Apple/Google = 1/image) | Club semester schedules are THE student pain point |
| **Mobile web / PWA** | Nobody (all iOS) | Android = 50% of US students; no install |
| **Campus ICS enrichment** | Nobody | CampusGroups (GopherLink backend) exposes public ICS feeds per org |
| **AI interest interviewer** | Nobody in this space | Noom/Finch pattern, converts utility → story |
| **Works on shared/DM'd images** | Nobody (Apple only on just-taken screenshots) | Students share flyers in group chats |

**Sources:** [Photo2Calendar](https://photo2calendar.com/) · [Nori](https://heynori.com/screenshot-to-calendar) · [iOS 26 limits (gHacks)](https://www.ghacks.net/2026/03/06/ios-26-lets-you-instantly-add-calendar-events-from-screenshots/) · [CampusGroups API](https://www.campusgroups.com/api?public=1) · [Inside Higher Ed on campus event gap](https://www.insidehighered.com/news/student-success/college-experience/2023/10/13/why-so-many-students-want-campus-events-calendar)

---

## Validated Demand

- **60%** of 4-yr college students never attend a campus event
- **33%** feel disconnected from campus due to *awareness*, not interest
- **#1** most-requested campus-app feature is an events calendar
- **$10–12** = documented student-app price ceiling → **$1 is trivially acceptable**
- Student quote: *"Half the events that go on around campus aren't advertised very well."* — [Inside Higher Ed 2023](https://www.insidehighered.com/news/student-success/college-experience/2023/10/13/why-so-many-students-want-campus-events-calendar)

---

## Feature Set

### MVP (must ship by Mon 5 PM)

1. **Upload / paste / camera capture** — drag-drop, Ctrl+V paste, mobile camera via `<input capture="environment" multiple>`
2. **Claude vision extraction** — returns **array** of events with ISO 8601 timestamps, `hasFreeFood: bool`, categories, confidence
3. **Editable event card** — user can fix any field before committing
4. **`.ics` download** (universal) + Google/Outlook render-URL deeplinks (no OAuth)
5. **Conflict badge** — Google Calendar `freebusy.query` with demo-mode fallback (pre-populated fake calendar) so it demos even without OAuth
6. **AI chat interviewer** (~90 sec) → extracts `{interests[], major, stage, freeText}` to localStorage. Live profile panel fills in as judges watch
7. **Relevance score** on every uploaded flyer using the profile
8. **"Forgotten events" retroactive feed** — batch upload a folder of screenshots, see a nostalgic "you screenshotted this 14 days ago" view
9. **Skip-chat fallback** — checkbox grid of 20 interests if chat breaks on venue wifi

### Stretch (Sun evening only)

- **Free-Food Radar filter** — filter the feed by `hasFreeFood: true`. Viral campus appeal, comedic demo beat.
- **Campus ICS dedup** — fetch CampusGroups public ICS, fuzzy-match, enrich with RSVP links. *Requires 30-min spike Fri evening to confirm GopherLink feeds are accessible CORS-free.*
- **Claude Sonnet fallback button** — re-run stubborn flyers with the bigger model
- **PWA share target** — register as share destination so iOS/Android share sheet can send images directly

### Killed (do NOT build)

- ❌ Instagram URL scraping (oEmbed gutted Nov 2025, ToS-hostile)
- ❌ Auth + database (hackathon killer, stateless is the pitch)
- ❌ Shared social event wall (network effects can't demo)
- ❌ Tinder-swipe onboarding (finicky on projector)
- ❌ Tesseract.js (embarrasses on stylized fonts)

---

## Stack

**Frontend:** Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui + react-dropzone
**Deploy:** Vercel (free tier, `git push` → live in 60s)
**AI:** **Claude Haiku 4.5** (primary, $1/$5 per MTok, ~$0.002/image) via `@ai-sdk/anthropic` with Vercel AI SDK's `generateObject` + Zod schemas. **Claude Sonnet 4.5** as re-run fallback button.
**Chat:** Vercel AI SDK `useChat` hook streaming to Claude
**Calendar out:** `ics` npm package → `.ics` blob download + Google/Outlook render-URL deeplinks
**Calendar in:** Google Calendar `freebusy.query` (only OAuth scope: `calendar.readonly`) + demo-mode fallback
**Persistence:** localStorage only. No DB. No auth.
**Cost for 100 demo images:** ~$0.20 with Haiku. Negligible.

**Why Claude over GPT-4o-mini:** Your API key, strongest at reading decorative/stylized typography (common on club flyers), native structured output via tool-use, same Vercel AI SDK integration.

**Docs:** [Claude pricing](https://docs.claude.com/en/docs/about-claude/pricing) · [AI SDK `generateObject`](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) · [AI SDK `useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) · [ics npm](https://www.npmjs.com/package/ics) · [Google freebusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

---

## Schedule

| When | Owner | Goal |
|---|---|---|
| **Fri eve (tonight)** | — | Next.js scaffold. Claude vision call with Zod schema. One test flyer → JSON. 30-min CampusGroups ICS spike. **Go/no-go on campus enrichment.** |
| **Sat AM** | — | Dropzone + paste + mobile camera. Multi-event extraction. Editable event card. |
| **Sat PM** | — | `.ics` generation. Google `freebusy` integration + demo-mode toggle. Conflict badge. |
| **Sun AM** | — | AI chat interviewer w/ live profile panel. Relevance scoring on uploads. |
| **Sun PM** | — | "Forgotten events" feed. Free-food filter. Claude Sonnet fallback. Polish. **Test on real iPhone + Android + laptop.** |
| **Mon AM** | — | Demo script. 5 guaranteed-to-work flyers. Deploy to memorable vercel.app URL. Grab r/uofmn quotes for deck. Practice pitch 5x. |
| **Mon 12–5:45** | — | Buffer. Fix the one thing that always breaks. |

---

## Risks

1. **Google OAuth friction on demo stage** — judges may not grant calendar scope. **Mitigation:** demo-mode toggle with 3 pre-populated fake events. Build this Saturday.
2. **CampusGroups ICS may need auth or be CORS-blocked** — **Mitigation:** 30-min spike Friday night; if it fails, drop campus enrichment to stretch and lean harder on conflict + chat interview.
3. **Claude fails on stylized typography** — **Mitigation:** editable card + Sonnet fallback button.
4. **Chat interviewer eats demo time** — **Mitigation:** cap chat explanation at 45 sec; hero moment stays "flyer in → ranked event out."
5. **Apple will ship conflict detection eventually** — irrelevant for a 3-day demo, and they'll never know your campus.

---

## Open Questions for the Team

1. **Name:** "ClipCal" is a placeholder. Alternatives: SnapSchedule, FlyerIQ, CampusCopilot, Gopherly, PasteIt?
2. **Primary campus?** GopherLink suggests UMN — do we demo against UMN-specific events or keep it campus-agnostic?
3. **Who owns the demo script and pitch deck?** (Needs to happen by Sunday night, not Monday.)
4. **Do we want a Vercel team account** so everyone can deploy, or one dev owns the deploy?
5. **Chat interviewer tone** — playful ("what would make you skip class to attend?") or practical ("what's your major?")? Tone dictates the vibe of the whole pitch.

---

## Next Step

Scaffold Next.js + wire one Claude vision call with a Zod event schema tonight. Validate against one real flyer. If the JSON looks right, everything else is UI work.
