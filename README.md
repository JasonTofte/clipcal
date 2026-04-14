# ShowUp

> Your campus copilot. Snap a flyer, know if you should go.

ShowUp is an AI-powered flyer → calendar web app with a decision-support UX layer grounded in the [Ottawa Decision Support Framework](https://pubmed.ncbi.nlm.nih.gov/32428429/) and cognitive-offloading theory ([Risko & Gilbert 2016](https://www.cell.com/trends/cognitive-sciences/abstract/S1364-6613(16)30098-5)). Built for a hackathon (Apr 10 – Apr 13, 2026).

**Live demo:** https://clipcal-six.vercel.app/feed
**Demo video:** https://youtu.be/5ruDXcEH1Iw

**Status:** Post-hackathon · v1.0.1 (Public Release — Safety Gates, TDD, Multi-Agent Review). Ships with a Pi Zero e-ink sidecar (`pi/`) as an optional hardware companion.

## What it does

1. **Snap, paste, or drop a flyer.** Mobile web app — no install.
2. **AI extraction** pulls out the event (title, date, time, location, category) — even multiple events from a single club semester schedule.
3. **Conflict detection** against your Google Calendar — green badge if you're free, red if you overlap.
4. **Interest profile** — a 90-second AI chat interviewer learns what you care about; flyers get ranked by relevance.
5. **"Worth noticing" chips** surface the trade-offs (12-min walk · first open Sat · ends after your 8am class) so you can decide. No auto-decline. No nagging.
6. **Leave-by clock** — concrete timestamp, targets time blindness.
7. One tap → `.ics` download or Google/Outlook deeplink.
8. **Goldy Sidekick feed** — `/feed` shows your extracted events with UMN Gopher mascot commentary. Goldy reacts to your schedule: "Tricky one — overlaps CSCI 5801, but your call", "Free pizza? Say less", "Ski-U-Mah! Home game energy — this is the one." Lines are chosen deterministically from a 120-variant hand-authored bank (8 context buckets × 15 variants). Zero runtime LLM, fully offline, calendar data never leaves the browser.
9. **Browse UMN events** — `/browse` discovers campus events ahead of time (list + month calendar, interest-filtered).

## Design principle

**Inform, don't decide** is not our invention — it's the core principle of the [Ottawa Decision Support Framework](https://pubmed.ncbi.nlm.nih.gov/32428429/) applied to campus events. Decisional conflict is reduced by giving users information *and* control, not by choosing for them. Paired with the cognitive-offloading literature ([Risko & Gilbert 2016](https://www.cell.com/trends/cognitive-sciences/abstract/S1364-6613(16)30098-5)) that frames why externalizing time (the leave-by clock, proportional Day Rail) lowers working-memory load. Pattern analysis of [Tiimo](https://www.tiimoapp.com/resource-hub/sensory-design-neurodivergent-accessibility) (Apple Design Award 2024/2025), Goblin Tools, and Sunsama anchors the shipped UX. Every feature surfaces trade-offs so your brain can make a better call — no paternalism, no streak shame, no auto-rejecting events.

> **Honest caveat:** ShowUp ships Tiimo-*inspired* accessibility, not Tiimo-*caliber*. The distinction requires co-design sessions with ADHD/autistic students, which are logged as a required follow-up before any public marketing claim.

See [`docs/brief.md`](docs/brief.md) for the full product brief and [`mockups/index.html`](mockups/index.html) for three design directions.

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind 4 + shadcn/ui
- **AI:** Claude (Haiku 4.5 primary, Sonnet 4.5 fallback) via Vercel AI SDK v6 (`@ai-sdk/anthropic`) — `generateObject` with Zod 4 schema for typed structured output
- **Calendar out:** `ics` npm package + Google/Outlook render-URL deeplinks *(Session 3)*
- **Calendar in:** Google Calendar `freebusy.query` (read-only scope) *(Session 3)*
- **Persistence:** `localStorage` only · no auth · no DB
- **Testing:** Vitest for unit tests (schema); manual real-flyer gate for extraction feasibility
- **Deploy:** Vercel

## Repo layout

```
clipcal/
├── app/                      # Next.js 16 App Router
│   ├── api/                  # /extract · /campus-feed · /campus-match · /campus-orgs
│   │                         # /campus-browse · /chat · /profile · /relevance
│   ├── browse/page.tsx       # UMN events discovery (list + month calendar)
│   ├── feed/page.tsx         # Goldy Sidekick feed (RSC shell)
│   ├── profile/              # Interest interviewer
│   ├── layout.tsx            # Tailwind root + next/font + BottomNav
│   └── page.tsx              # Upload flow (snap / paste / drop)
├── components/
│   ├── bottom-nav.tsx        # Sticky tab bar (Upload · Browse · Feed · Profile)
│   ├── goldy-*.tsx           # Goldy Sidekick UI (avatar, feed, cards, week-glance, FAB)
│   ├── event-card.tsx        # Post-extraction editable card (home page)
│   ├── campus-feed.tsx       # UMN events widget
│   └── ui/                   # shadcn primitives
├── lib/
│   ├── schema.ts             # Zod EventSchema + ExtractionSchema
│   ├── goldy-commentary.ts   # Deterministic Goldy line selection per event
│   ├── goldy-templates.json  # 120 mascot lines (8 buckets × 15 variants)
│   ├── format.ts             # Centralized en-US date/time formatters
│   ├── conflict.ts           # Calendar overlap detection
│   ├── noticings.ts          # "Worth noticing" chip generator
│   ├── leave-by.ts           # Leave-by clock
│   ├── livewhale.ts          # UMN LiveWhale events client
│   ├── calendar-grid.ts      # UTC-safe month-grid builder
│   └── relevance.ts          # Interest matcher + relevance score schema
├── docs/                     # Product brief + full build plan
├── mockups/                  # Static HTML mockups (6 directions + index)
├── pi/                       # Pi Zero e-ink sidecar (BLE + captive-portal HTTP)
├── public/                   # Static assets
└── README.md
```

## Scripts

- `npm run dev` — Next dev server
- `npm run build` — production build
- `npm test` — Vitest unit tests (~280 tests across schema, chip ranking, conflict detection, commentary, profile flow, etc.)
- `npm run analyze` — bundle analyzer (Turbopack-native `--experimental-analyze`). Open `.next/diagnostics/analyze/index.html` after the build.
- `npm run lighthouse` — mobile Lighthouse report against a running `npm run dev`. Requires no pre-install (uses `npx -y lighthouse`); outputs `lighthouse-feed.html`.

## Hackathon timeline

- **Fri Apr 10** — Research + mockups + scaffold
- **Sat Apr 11** — Core extraction flow + conflict detection
- **Sun Apr 12** — AI chat interviewer + ADHD "noticings" layer + polish
- **Mon Apr 13 (5:45 PM)** — Demo

## License

MIT — see [LICENSE](LICENSE).
