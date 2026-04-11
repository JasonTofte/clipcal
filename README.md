# ClipCal

> Your campus copilot. Snap a flyer, know if you should go.

ClipCal is an AI-powered flyer → calendar web app with an ADHD-supportive design layer. Built for a hackathon (Apr 10 – Apr 13, 2026).

**Status:** Hackathon build · Session 1 complete (scaffold + Claude vision extraction proven end-to-end)

## What it does

1. **Snap, paste, or drop a flyer.** Mobile web app — no install.
2. **AI extraction** pulls out the event (title, date, time, location, category) — even multiple events from a single club semester schedule.
3. **Conflict detection** against your Google Calendar — green badge if you're free, red if you overlap.
4. **Interest profile** — a 90-second AI chat interviewer learns what you care about; flyers get ranked by relevance.
5. **"Worth noticing" chips** surface the trade-offs (12-min walk · first open Sat · ends after your 8am class) so you can decide. No auto-decline. No nagging.
6. **Leave-by clock** — concrete timestamp, targets time blindness.
7. One tap → `.ics` download or Google/Outlook deeplink.

## Design principle

**Inform, don't decide.** Grounded in cognitive offloading research (Risko & Gilbert 2016), the Ottawa Decision Support Framework, and pattern analysis of Goblin Tools, Tiimo, and Sunsama. Every feature surfaces information so your brain can make a better call — no paternalism, no streak shame, no auto-rejecting events.

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
├── app/               # Next.js 16 App Router
│   ├── api/extract/   # POST image → Claude Haiku 4.5 → ExtractionSchema JSON
│   ├── layout.tsx     # Tailwind root
│   └── page.tsx       # Session 1: minimal file input + JSON display
├── components/ui/     # shadcn primitives (button, card, input, textarea, badge)
├── lib/
│   ├── schema.ts      # Zod EventSchema + ExtractionSchema
│   └── schema.test.ts # Vitest — 9 tests, all green
├── docs/              # Product brief + full build plan
├── mockups/           # Static HTML mockups (3 directions + index)
├── public/            # Static assets
└── README.md
```

## Hackathon timeline

- **Fri Apr 10** — Research + mockups + scaffold
- **Sat Apr 11** — Core extraction flow + conflict detection
- **Sun Apr 12** — AI chat interviewer + ADHD "noticings" layer + polish
- **Mon Apr 13 (5:45 PM)** — Demo

## License

MIT — see [LICENSE](LICENSE).
