# ClipCal

> Your campus copilot. Snap a flyer, know if you should go.

ClipCal is an AI-powered flyer → calendar web app with an ADHD-supportive design layer. Built for a hackathon (Apr 10 – Apr 13, 2026).

**Status:** Hackathon build · Pre-MVP

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

- **Frontend:** Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui
- **AI:** Claude (Haiku 4.5 primary, Sonnet 4.5 fallback) via Vercel AI SDK `generateObject` + `useChat`
- **Calendar out:** `ics` npm package + Google/Outlook render-URL deeplinks
- **Calendar in:** Google Calendar `freebusy.query` (read-only scope)
- **Persistence:** `localStorage` only · no auth · no DB
- **Deploy:** Vercel

## Repo layout

```
clipcal/
├── docs/              # Product brief (.md + .docx)
├── mockups/           # Static HTML mockups (3 directions + index)
├── src/               # Next.js app (coming)
└── README.md
```

## Hackathon timeline

- **Fri Apr 10** — Research + mockups + scaffold
- **Sat Apr 11** — Core extraction flow + conflict detection
- **Sun Apr 12** — AI chat interviewer + ADHD "noticings" layer + polish
- **Mon Apr 13 (5:45 PM)** — Demo

## License

MIT — see [LICENSE](LICENSE).
