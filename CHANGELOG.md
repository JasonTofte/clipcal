# Changelog

All notable changes to ClipCal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Browse page** (`/browse`) for discovering UMN campus events by keyword, date range, and interest match. List view (default) and 7-column Sunday-first month calendar view (collapses to agenda under `sm`). Profile-interest filter is opt-in and runs client-side via a new `matchesInterests` helper (word-boundary match, no LLM call). Prev/next month navigation with per-month fresh fetch.
- **`/api/campus-browse`** endpoint wrapping LiveWhale's date-range + keyword search. In-memory LRU cache (50 entries, 10-min TTL) keyed on `(startDate, endDate, max, q)` with `encodeURIComponent(q)` to prevent separator collisions. `max` validated as a positive integer and capped at 200 to prevent cache pollution.
- **`lib/livewhale.ts`** `fetchBrowse` helper — validates `YYYY-MM-DD`, empty `q` uses a date-range-only path to avoid a stray `/search/` segment.
- **`lib/calendar-grid.ts`** pure month-grid builder (UTC-safe) powering the calendar view.
- **`vitest.config.ts`** with `@/` alias so route-level tests match the `@/lib/*` import style used elsewhere.

## [1.0.2] - 2026-04-12

### Security

- Fenced untrusted external content (LiveWhale campus events, chat transcripts) in LLM prompts with XML-style delimiters, control-char sanitization, and length caps; added an explicit untrusted-content preamble (OWASP LLM01 hardening).
- PWA share-target service worker now whitelists MIME (`image/png|jpeg|webp`), caps at 5 MB, and sanitizes filenames. Client-side pickup re-sanitizes defensively.
- 20,000-character cap on `/api/chat` and `/api/profile` message bodies to bound LLM cost.
- Error logs across all 7 API routes now emit only `error.name` + `error.message` (no raw Error objects that could echo prompt fragments).
- Rate-limit `unknown` bucket replaced with per-request `anon-{uuid}` so header-strippers can't share a bucket or self-DoS all anonymous callers.
- Sonnet fallback on `/api/extract` gets its own tight limiter (2/min per-key, 10/min global) — client-initiated escalation can no longer run up the bill.
- Site-wide security headers via `next.config.ts`: Content-Security-Policy (Report-Only during soak), X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy (camera/mic/geo disabled), HSTS.

### Changed

- Replaced hand-rolled regex ICS parser in `/api/campus-orgs` with `node-ical`. The old parser missed `DTSTART;TZID=America/Chicago:...` — GopherLink's default for localized events — which were silently dropped.
- Extracted shared LiveWhale client (`lib/livewhale.ts`) with zod-backed response validation; both `/api/campus-feed` and `/api/campus-match` delegate to it. Shape drift now fails loudly at parse time.
- Centralized Claude model IDs in `lib/models.ts` and API preamble (API-key check + rate-limit + error logging) in `lib/api-utils.ts`.
- Split `app/page.tsx` (486 → 264 LOC) into dedicated hooks (`use-demo-mode`, `use-paste-files`, `use-share-target`) and view components (`HomeIdleView`, `HomeSuccessView`). Extraction-enrichment fetch helpers moved to `lib/extraction-client.ts`.
- Renamed `InterviewPage` component → `ProfilePage` to match `/profile` route; "interview" remains user-facing product language.

### Fixed

- Silent `catch {}` blocks in `/api/campus-{feed,match,orgs}` now log the failure via `console.warn` with error name+message so observability isn't lost when LiveWhale or GopherLink change shape.
- Removed dead `eventDate` computation and a misleading "filter by date proximity" comment in `/api/campus-orgs` that promised a filter never applied.
- Extract system prompt no longer hardcodes `Today is 2026-04-10`; injects `new Date().toISOString().slice(0,10)` at request time.
- Relevance scoring now logs when the model returns fewer scores than expected (previously silent padding with `{ score: 50 }` was indistinguishable from genuine neutrality).

### Removed

- Unused `lucide-react` dependency (zero imports; real package, just dead weight).

## [1.0.1] - 2026-04-11

### Added

- `COLLABORATOR_SETUP.md` — standalone Windows onboarding guide for new contributors. Covers prerequisite checks, GitHub CLI authentication, repository clone, dependency installation, `.env.local` configuration with gitignore verification, dev server launch, daily git workflow, project tour, and an 11-row troubleshooting table.
