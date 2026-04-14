# ShowUp — Feature Reference

This file is the authoritative list of shipped features by surface and release cycle.
Update this file when a feature graduates from the plan to production.

---

## Feature Matrix

| Feature | Surface(s) | Status | Since | Notes |
|---|---|---|---|---|
| **Flyer extraction** (Claude Haiku 4.5 vision, `generateObject`) | Upload (`/`) | Shipped | v1.0.0 | Multi-event from a single flyer; Sonnet fallback button |
| **Editable event card** | Upload, Feed | Shipped | v1.0.0 | Inline `contenteditable`; user can correct any field before committing |
| **`.ics` download** | Upload, Feed | Shipped | v1.0.0 | Single + multi-event; Google/Outlook render-URL deeplinks |
| **Conflict badge** | Upload, Feed | Shipped | v1.0.0 | Google Calendar `freebusy.query` + demo-mode fake calendar |
| **AI chat interviewer** | Profile (`/profile`) | Shipped | v1.0.0 | ~90-sec Claude-driven interview → `clipcal_profile` in localStorage |
| **Relevance scoring** | Upload, Feed | Shipped | v1.0.0 | Profile-based match % on every event card |
| **Noticings chips** | Upload, Feed | Shipped | v1.0.0 | Deterministic: walk-time, conflict, free-food, back-to-back, etc. |
| **Leave-by clock** | Upload, Feed | Shipped | v1.0.0 | Deterministic: start time − walk estimate |
| **Week density strip** | Home (`/`), Feed | Shipped | v1.0.0 | 7-day bar showing calendar load; today highlighted |
| **Browse page** | Browse (`/browse`) | Shipped | v1.0.3 | LiveWhale search + month calendar + interest-match filter |
| **Goldy Sidekick feed** | Feed (`/feed`) | Shipped | v1.0.3 | Mascot-forward feed with deterministic commentary (120 variants, 8 buckets) |
| **Bottom tab bar** | App-wide | Shipped | v1.0.3 | `Upload · Browse · Feed · Profile`, sticky, `aria-current="page"` |
| **Unified Goldy design tokens** | App-wide | Shipped | v1.0.3 | UMN maroon/gold/cream at `:root`; all shadcn primitives inherit |
| **Shared primitive library** | App-wide | Shipped | v1.0.3 | `LeaveByClock`, `NoticingChip`, `ConflictBadge`, `PrimaryCTA`, `GoldyBubble` in `components/shared/` |
| **QR code decode** | Upload | Shipped | v1.0.3+ | `BarcodeDetector` (Chrome/Edge/Android) + `qr-scanner` fallback (iOS/Firefox); signup URL extracted from flyer image |
| **E-ink / Pi sync** | Feed | Shipped | v1.0.3+ | WiFi (HTTPS POST) + BLE (Web Bluetooth, 20-byte ATT-MTU chunked) to Pi Zero e-ink display |
| **Pi Zero e-ink sidecar** | Hardware | Shipped | Unreleased | `pi/*.py` — BLE GATT peripheral + captive-portal HTTP fallback + Waveshare 2.13" V4 renderer; systemd-managed; WiFi AP mode for iOS pairing |
| **Starred events** | Feed, E-ink | Shipped | Unreleased | Star-toggle on event cards; starred events get amber ring in app, `* ` prefix on Pi display (`s: true` payload flag) |
| **`/api/abbreviate`** | Feed (internal) | Shipped | v1.0.3+ | Claude Haiku 4.5 shortens titles/locations for 250×122px e-ink display; prompt-safety fenced; zod `.transform()` coerces over-long LLM responses |
| **Calm Mode toggle** | Feed header, Profile | Shipped | Tiimo-Caliber | User-controlled sensory-low palette via `[data-calm="true"]` token cascade; persisted in `localStorage['clipcal_calm_mode_v1']` |
| **Sensory-low typography baseline** | App-wide | Shipped | Tiimo-Caliber | `line-height ≥ 1.6`, `max-width 68ch`, no sub-400 weights in body text; always on (not behind Calm Mode) |
| **Day Rail (proportional time view)** | Feed | Shipped | Tiimo-Caliber | Vertical rail 8 AM–10 PM; block height proportional to event duration; now-line; earlier/later summary rows |
| **Ranked chips** | Feed, Upload | Shipped | Tiimo-Caliber | Deterministic priority order: interest-match → conflict → walk → time → amenities; gold-filled top chip |
| **`prefers-reduced-motion` audit** | App-wide | Shipped | Tiimo-Caliber | Global CSS block suppresses all non-essential animations when OS setting is `reduce` |
| **WeekStrip consolidation** | Home, Feed | Shipped | Tiimo-Caliber | Single `components/week-strip.tsx` replaces `WeekDensity` + `GoldyWeekGlance` |

---

## Deferred / Follow-up

| Item | Reason deferred | Target cycle |
|---|---|---|
| Co-design sessions with ADHD students | Requires recruiting + session facilitation outside hackathon scope | Post-launch |
| Spoon/energy widget | Requires its own design cycle; Tiimo-Caliber scoped to structural foundations | TBD |
| Custom color picker | Tiimo ships 3,000 colors; we ship one Calm preset | TBD |
| DayRail tap-to-expand (earlier/later rows) | Static summary rows sufficient for MVP; expand adds scroll complexity | Hudson follow-up |
| DayRail responsive `railHeight` | Fixed 520px; tight on iPhone SE with keyboard open | Hudson follow-up |
| ConflictBadge on `/browse` | LiveWhale data lacks time-of-day; conflict detection would be speculative | TBD |
| CSP enforcement (Report-Only → enforce) | 1–2 week soak period monitoring DevTools/Vercel for violations first | Post-deploy |
| Loading-state accessibility under `prefers-reduced-motion` | Spinner goes static under `reduce` — no visible progress feedback | TBD |
