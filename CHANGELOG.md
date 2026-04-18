# Changelog

All notable changes to ShowUp are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **QR signup chip now renders on the upload flow** (`components/event-card.tsx`, `lib/resolve-signup-chip.ts`) — PR #82 added the three-tier signup chip but only wired it into `components/goldy-event-card.tsx` and `components/goldy-event-row.tsx`. The upload success view (`components/event-card.tsx`) never imported `resolveSignupChip`, so flyer uploads that produced a valid `signupUrl` or `hasQR: true` silently showed nothing. `EventCard` now renders a `SignupChip` sub-component driven by the same `resolveSignupChip` helper. Chip label and aria strings moved to exported constants (`SIGNUP_CHIP_LINK_LABEL`, `SIGNUP_CHIP_LINK_ARIA`, `SIGNUP_CHIP_FALLBACK_LABEL`, `SIGNUP_CHIP_FALLBACK_ARIA`) in `lib/resolve-signup-chip.ts`; all three card render paths (`EventCard`, `GoldyEventCard`, `GoldyEventRow`) consume the constants so future label edits can't drift between surfaces. `aria-label` now satisfies WCAG 2.5.3 (accessible name contains the visible label — voice-control users can activate the chip by speaking "Sign up via flyer QR"). Dark-mode bg/ring added for the amber link chip variant. (Sherlock Lite.)

### Added

- **Clickable URLs in flyer notes** (`lib/linkify.ts`, `components/linkified.tsx`, `components/home-success-view.tsx`, `app/api/extract/route.ts`) — Haiku's `sourceNotes` free text now renders URLs as clickable anchors. Pure `linkifySafe(input)` returns a discriminated-union segment array; `<Linkified text={...}>` maps segments to React nodes. XSS-safe by construction: (1) strict `/^https?:\/\//i` regex pre-filter rejects `javascript:`, `data:`, `file:`, `ftp:` at the parse step; (2) `new URL()` parse re-confirms protocol and catches malformed authority (e.g. `https://` with no host); (3) trailing sentence punctuation (`.,;:!?)]}`) peeled off the href; (4) 2048-char cap on emitted hrefs matches `schema.ts` `signupUrl` parity; (5) segment array + JSX `{value}` interpolation means no HTML string ever reaches the DOM (no `dangerouslySetInnerHTML` anywhere in the new code). Anchors use `target="_blank" rel="noopener noreferrer"`. One-line Haiku prompt nudge in `app/api/extract/route.ts` asks the model to prepend `https://` to URLs in `sourceNotes`. 20 new tests (all P0; regression + length-cap hardening tests added during review) lock every defense layer.

- **QR fallback: visible-URL extraction + "QR detected" hint chip** (`lib/schema.ts` → optional `hasQR: boolean` + `signupUrl` `.max(2048)` cap, `lib/merge-signup-url.ts`, `lib/resolve-signup-chip.ts`, `app/api/extract/route.ts`, `components/goldy-event-card.tsx`, `components/goldy-event-row.tsx`) — closes the silent-failure gap when a flyer has a QR code but the on-device decoder (`BarcodeDetector` / `qr-scanner`) can't read it. Two upgrades: (1) Claude Haiku's extraction prompt now pulls any printed URL into `signupUrl`, with the existing `.url() + refine(^https?://)` validator catching XSS payloads; (2) when the LLM reports `hasQR: true` but no URL was decoded or extracted, the event card renders a muted, non-link "QR on flyer — scan original" chip (dashed border, `cursor-default`, `currentColor`-tied border so dark-mode contrast is automatic) so the user knows to scan the original flyer with their phone camera. Precedence: on-device QR decode > LLM-extracted URL > fallback chip. Chip-state gate extracted into pure `resolveSignupChip` helper (discriminated-union return) shared by card + row variants. 17 new tests (7 P0) locking schema field, precedence rule, and all three chip branches. (Sherlock Lite.)

- **Starred events** (`lib/schema.ts` → optional `starred` field, `components/event-card.tsx`, `lib/ble-sync.ts`) — a ★ toggle on each event card lets users flag high-priority events. In the app, starred events get an amber ring and gold star; in the e-ink payload, a `s: true` flag is emitted so the Pi renderer (already wired for it) prefixes the priority title with `* `. `lib/event-store.ts` gains `updateEventInBatch` so the toggle persists to `localStorage` through the existing batch shape. (PR #74 split.)
- **Pi Zero e-ink sidecar** (`pi/ble_server.py`, `pi/http_server.py`, `pi/main.py`, `pi/renderer.py`, `pi/ap_setup.sh`, `pi/setup.sh`, `pi/clipcal.service`) — the physical display side of the existing app-side sync transports. BLE GATT peripheral advertising as `ShowUp` (matches `components/eink-sync-button.tsx` filter); captive-portal HTTP server on `10.42.0.1:8080` for iOS devices that cannot use Web Bluetooth; Waveshare 2.13" V4 renderer with a priority-event hero + row list; systemd unit for boot-time start. WiFi AP mode (`ShowUp-Display` SSID) documented in `pi/ap_setup.sh` for first-pair setup. Known caveat: `pi/clipcal.service` hardcodes Elton's home path and needs parameterization before any other Pi deployment.
- **`next.config.ts` — `allowedDevOrigins`** — wildcard LAN ranges (`192.168.*`, `10.0.*`, `10.59.*`, `172.16.*`, `172.20.*`) so phones on the same network can reach the Next.js dev server during e-ink sync testing. Existing CSP / PI_ORIGIN / security headers unchanged.

### Changed

- **`/api/abbreviate` validation** (`app/api/abbreviate/route.ts`) — swapped zod `.max(20/14)` rejection for `.transform()` truncation using the existing `truncate()` helper. An LLM response that exceeds column widths now shortens with an ellipsis instead of failing validation and forcing the local fallback. All upstream hardening (`requireAnthropic` auth, `abbreviateLimiter` rate limit, 10 KB body cap, 50-event cap, prompt-safety fences) preserved.

### Changed

- **Rebrand: ClipCal → ShowUp.** All user-facing surfaces updated: PWA manifest (`name`/`short_name`), `<title>`/Apple web app title, profile page copy, interviewer system prompt, `.ics` download filename (`showup-events.ics`), Nominatim User-Agent, and the Pi sidecar's BLE advertised name, e-ink splash, and HTTP captive-portal sync page. Prose across README, CHANGELOG, release notes, collaborator guide, and `docs/*` swapped to the new name. Internal identifiers intentionally left unchanged to preserve existing user data and device provisioning: localStorage keys (`clipcal_*`), service-worker cache name (`clipcal-shared-media`), `package.json` name, filesystem paths (`/etc/clipcal/`), env var (`CLIPCAL_SYNC_TOKEN`), WiFi SSID (`ClipCal-Display`), GitHub repo slug, and historical ADRs/mockups.

### Added

- **Campus-feed confidence scores** (`lib/relevance.ts` → `scoreEvent`, `components/campus-feed.tsx`) — each "Happening on Campus" row now shows a tone-tinted `NN%` chip driven by the user's saved profile interests. Deterministic keyword scoring (title hit +30, group/type hit +20, free bonus +5, capped at 99); returns `null` when no interests are set so cold-start users see no badge. 5 new unit tests.
- **Calm Mode toggle** (`lib/calm-mode.ts`, `components/calm-mode-toggle.tsx`) — user-controllable sensory-low palette grounded in Tiimo's 2024/2025 Apple Design Award pattern: the control IS the design, not a preset. Toggling writes `clipcal_calm_mode_v1` to `localStorage`, sets `document.body.dataset.calm = "true"`, and all token-bound colors shift to desaturated variants within one frame. State is restored on page reload. Implemented as `useState + useEffect` hook so the toggle re-renders correctly; SSR returns safe no-op defaults. (AC-1)
- **Sensory-low typography baseline** — app-wide, unconditionally: `body` line-height ≥ 1.6, paragraph `max-width` 68ch, minimum font weight 400 in primary-content regions. Applies regardless of Calm Mode state because wide-measure dense text is strictly worse for everyone, not a preference. Grounded in Ottawa Decision Support Framework (ODSF) guidance on reducing decisional conflict through environmental clarity. (AC-2)
- **Calm Mode token overrides** (`app/globals.css`) — when `[data-calm="true"]`, body letter-spacing bumps +0.01em and the high-contrast maroon-on-cream pairing (~15:1) shifts to muted-maroon-on-warm-cream (~9–10:1), which still passes WCAG AA for body text but eliminates the contrast spike that triggers sensory fatigue. (AC-3)
- **`prefers-reduced-motion` audit** — global CSS block zeros all `transition-duration`, `animation-duration`, and `animation-iteration-count` when the OS setting is `reduce`. Non-essential animations (`animate-bounce` on Goldy, spring transitions on cards, shimmer loaders) are fully suppressed; `animate-spin` on loading indicators degrades to static icon (acceptable trade-off: informational fallback exists). (AC-4)
- **Day Rail** (`components/day-rail.tsx`) — proportional time view replacing the flat card list when a day is selected on `/feed`. Renders 8 AM–10 PM as a vertical rail; each event block's pixel height is `(durationMinutes / totalRangeMinutes) × railHeight`, making relative time cost perceptually honest (Barkley's "make time visible" principle). A "now" line marks the current time when within range. Events outside the range collapse to "Earlier today (N)" and "After 10 PM (N)" summary rows. Tapping any block opens the full card. Minimum block height 44px enforced for WCAG 2.5.8. (AC-5)
- **Chip-ranking module** (`lib/chip-ranking.ts`) — deterministic `rankChips()` function orders event chips by cognitive load priority: (1) stated-interest match, (2) conflict status, (3) walk/transit distance, (4) time constraints, (5) amenities (food/free). The highest-priority chip receives a gold-filled "priority" style (matches match-% badge weight) so the single most load-bearing reason to attend reads at a glance. Deterministic sort is stable: tie-breaking uses alphabetical `rankKey` to prevent render jitter. (AC-6) Rationale: unranked information increases decisional conflict (ODSF critique).
- **Empty-profile chip fallback** — when a user has not completed the interest interview, `rankChips()` falls back to a default order (conflict → time → walk → amenities) and suppresses the "priority" style entirely. A subtle nudge toward the profile flow appears on the feed. (AC-7)
- **WeekStrip consolidation** (`components/week-strip.tsx`) — single implementation behind a `mode` discriminated union replaces both `components/week-density.tsx` and `components/goldy-week-glance.tsx`. Both `app/page.tsx` and `components/goldy-feed-client.tsx` now consume it with the correct `interactive` prop. (AC-8)

### Changed

- `components/event-card.tsx` now consumes `rankChips()` from `lib/chip-ranking.ts`; chips render in priority order with distinct gold-filled top chip.
- `components/goldy-feed-client.tsx` mounts `DayRail` when `selectedDayIdx !== null`, renders `CalmModeToggle` (compact variant) in the feed header, and consumes `WeekStrip`.
- `app/page.tsx` swaps `WeekDensity` for `WeekStrip`.
- `app/globals.css` gains sensory-low type baseline at `:root`, Calm Mode token overrides at `[data-calm="true"]`, and expanded `@media (prefers-reduced-motion: reduce)` guards covering all surfaces.
- **`/feed` header consolidation** — grounded in a `/deep-r` audit of AI-assistant + discovery-feed UX patterns (Arc Search, Perplexity, NYT Cooking, Google Discover, NN/G). Greeting bubble removed; the existing compact editorial hero (`OneThingHero`) becomes the sole above-the-fold surface. Redundant filter chips ("Just today" duplicated the WeekStrip; "Just gameday" had low signal) removed along with the `chipFilter` state machine. Stacked page-level toggles (`CalmModeToggle`, `EinkSyncButton`, `LeaveByNotifyToggle` banner) relocated into a single `⋯` overflow menu (`components/feed-overflow-menu.tsx`) + an inline leave-by notify chip on the hero (`components/leave-by-notify-chip.tsx`). Net ~300 lines removed, ~120 added; pre-content chrome shrinks from ~240pt → ~140pt.

### Removed

- `components/week-density.tsx` — consolidated into `components/week-strip.tsx`. (AC-8)
- `components/goldy-week-glance.tsx` — consolidated into `components/week-strip.tsx`. (AC-8)
- `components/leave-by-notify-toggle.tsx` — replaced by the inline `LeaveByNotifyChip` on the hero.
- `components/goldy-fab.tsx` — "Hey Goldy, I snapped a flyer" FAB removed; upload access retained via the bottom nav (simpler, one voice).

### Deferred (out of scope this cycle)

- Co-design sessions with ADHD students (falsifiable accessibility — required for "Tiimo-caliber" claim, explicitly out-of-scope for this cycle)
- Spoon/energy widget
- Custom color picker (Tiimo ships 3,000 user-selectable colors; we ship one Calm preset)
- DayRail earlier/later tap-to-expand (summary rows are static `<div>`, not interactive; users can scroll full week view)
- DayRail responsive `railHeight` (fixed 520px default; auto-viewport computation deferred)

- **QR code decode** (`lib/qr-decode.ts`) — extracts a signup URL from any uploaded flyer image. Uses the native `BarcodeDetector` API on Chrome/Edge/Android (zero bundle cost) and falls back to `qr-scanner` (nimiq, dynamically imported) on iOS Safari/Firefox. Result is filtered to `http(s)` only — `javascript:`, `data:`, `file:` URLs are rejected to prevent XSS via `<a href={signupUrl}>`. New `signupUrl` field on `EventSchema` is also URL-validated at the schema level.
- **E-ink display sync infra** (`lib/ble-sync.ts`, `components/eink-sync-button.tsx`) — sync the next batch of upcoming events to a Pi Zero e-ink display worn on a phone case. Two transports: WiFi (HTTPS POST to the Pi's local IP — Chrome/Edge/Firefox; iOS Safari falls back to the Pi's captive-portal paste page) and BLE (Web Bluetooth, Chrome/Edge/Android). BLE writes are properly chunked into 20-byte ATT-MTU-safe slices with a notifications handshake on the TX characteristic — fixes a silent-truncation bug where 510-byte payloads were sent as a single write. Pi sync URL is env-gated via `NEXT_PUBLIC_EINK_PI_URL`; CSP `connect-src` is appended only when that env var is set, so the security headers stay tight by default.
- **`/api/abbreviate`** LLM endpoint — Claude Haiku 4.5 shortens event titles (≤20 chars) and locations (≤14 chars) for the 250×122px e-ink display. Wrapped in the standard `requireAnthropic` guard + dedicated `abbreviateLimiter` bucket (6/min per-key, 30/min global), 10 KB body cap, 50-event ceiling. All untrusted titles + locations pass through `prompt-safety` fencing (`<title>`, `<location>` tags + `UNTRUSTED_PREAMBLE`) so a malicious flyer can't slip a fresh instruction into the prompt.
- **Pi server stack** (`pi/`) — Flask HTTP server with iOS captive-portal paste fallback, BLE GATT server, e-ink renderer, and AP setup script. Self-contained; not part of the Next build.
- 14 new tests (208 total): qr-decode URL filter, BLE chunker boundary cases.

### Changed

- `components/event-card.tsx` delegates to the shared primitives; DOM output on `/feed` is unchanged.

### Co-authored

- QR + e-ink feature originally proposed by **Sittikone Keopraseuth** (PR #39); split + re-hardened to land cleanly on current main.

### Added (continued)

- **Unified UI design language** — All pages (`/`, `/browse`, `/profile`) now inherit the Goldy brand tokens that previously lived only on `/feed`. `app/globals.css` rebinds shadcn tokens (`--primary` → maroon, `--background` → warm cream, `--ring` → gold) at `:root` and adds three surface variants (`--surface-vibrant` for feed, `--surface-calm` default, `--surface-paper` for cards/inputs). `--font-sans` + `--font-heading` both resolve to Fredoka. `.goldy-theme` stays additive (radial gradient stays feed-only).
- **Shared primitive library** (`components/shared/`): `LeaveByClock`, `NoticingChip`, `ConflictBadge`, `PrimaryCTA`, `GoldyBubble`. Extracted from `event-card.tsx` (−57 lines) so browse/upload/profile can reuse ADHD decision-support chrome without duplication.
- **Browse page restyle** — paper cards with gold-ring hover, pill-style list/calendar toggle, "★ your interests" chip on rows matching the saved profile.
- **Upload + Profile Goldy invitations** — a scoped `<GoldyBubble>` speech bubble introduces each non-feed surface without turning the mascot into persistent chrome.
- **Architecture decision**: tokens-at-root + surface variants (single source of truth, easier WCAG audits) instead of per-page theme classes. Rejected alternative: per-page `.goldy-theme`-style classes.

### Changed

- `components/event-card.tsx` delegates to the shared primitives; DOM output on `/feed` is unchanged.

## [1.0.3] - 2026-04-13

### Added

- **Goldy Sidekick feed** — `/feed` redesigned as a mascot-forward UI with UMN maroon + gold branding, Graduate + Fredoka fonts, a week-at-a-glance day bar, camera-roll of recent clips, and ranked event cards each carrying a contextual Goldy speech bubble + match percentage. Replaces the previous shadcn-styled feed. (Note: the original greeting bubble and persistent snap-a-flyer FAB that shipped in this version were later removed — see Unreleased § Changed/Removed for the header consolidation.)
- **Deterministic Goldy commentary** (`lib/goldy-commentary.ts` + `lib/goldy-templates.json`): 120 hand-authored lines across 8 context buckets (conflict · top-pick-gameday · interest-match · free-food · back-to-back · late-night · weekend-open · default). djb2 hash picks a deterministic variant per event; slot substitution with fallthrough for missing slots. No runtime LLM, fully offline. Timezone-aware late-night/weekend detection (Intl.DateTimeFormat on `event.timezone`).
- **Bottom tab bar** (`components/bottom-nav.tsx`) — sticky `Upload · Browse · Feed · Profile` nav with safe-area padding, `aria-current="page"` on the active tab. Mounted globally in `app/layout.tsx`.
- **Goldy UI primitives**: `components/goldy-avatar.tsx` (inline SVG block-M, self-hosted, `decorative` prop for inline uses), `components/goldy-event-card.tsx`, `components/goldy-week-glance.tsx`, `components/goldy-feed-client.tsx`.
- **Mobile-first app shell**: `viewport-fit=cover`, `100dvh`, `env(safe-area-inset-*)` padding, `@media (hover: hover)` gating for hover affordances, Graduate + Fredoka via `next/font/google` (self-hosted, CSP-friendly, `display: swap`). Theme color now UMN maroon `#7A0019`.
- 33 new tests for the commentary lib (all 8 buckets covered in `buildContext`, slot substitution asserted across buckets, timezone regression test for the late-night bucket, word-boundary interest matching regression). 166 tests total, all green.
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
