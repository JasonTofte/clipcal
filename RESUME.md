# RESUME — Supabase auth migration

**Branch:** `feature/supabase-auth` (off `origin/main`)
**Phase:** Phase 1 complete. **Paused awaiting live provisioning before Phase 2.**
**Plan:** `.sherlock-plan.md` (14 sections, 34 ACs, red-team validated)
**Last commit:** `29baf08 feat(auth): Phase 1 — Supabase auth scaffolding`

---

## Where we stopped

Phase 1 scaffolding is written, typechecks clean, existing test suite unregressed (95/95 Vitest). Nothing is deployed. The app will not run end-to-end until a Supabase project is provisioned and `.env.local` is filled in — middleware.ts will throw on missing env vars.

## Before resuming — YOU must do these (§9 of `.sherlock-plan.md`)

1. Create Supabase project at https://supabase.com/dashboard → copy URL + anon key + service_role key into `.env.local` (template in `.env.example`)
2. Enable auth providers: Email (**"Confirm email" ON — required**), Magic Link, Google OAuth
3. Google OAuth: create Web OAuth client in Google Cloud Console, paste ID+secret into Supabase dashboard, add redirect URI `https://<ref>.supabase.co/auth/v1/callback`
4. `supabase login` (browser) → `supabase link --project-ref <ref>` → `supabase db push` → `supabase test db`
5. In Supabase Dashboard → Authentication → Hooks → enable **Before User Created Hook** pointing at `public.enforce_umn_domain`
6. Smoke test: sign up with `@gmail.com` → blocked with "Only @umn.edu…" message; sign up with `@umn.edu` → confirmation email arrives

If any of step 1–6 fails, fix before Phase 2.

## When you come back — say this to Claude

> "Resume Supabase auth plan. We're at Phase 1 exit on branch `feature/supabase-auth`. Provisioning is done — [OR: provisioning hit X]. Read `.sherlock-plan.md` and `RESUME.md`. Proceed to Phase 2."

Claude will re-read the plan, confirm state, and start Phase 2 (profile data-path migration). The 5-phase breakdown is in `.sherlock-plan.md` §11.

## What Phase 2–5 will touch

- **Phase 2 — Profile:** rewrite `lib/profile.ts` to be Supabase-backed; update `app/profile/page.tsx`, `/api/profile`, `components/interest-picker.tsx`
- **Phase 3 — Event batches:** rewrite `lib/event-store.ts`; update `app/page.tsx`, `app/feed/page.tsx`, `/api/extract`
- **Phase 4 — Relevance cache:** new `lib/event-hash.ts`; rewrite `/api/relevance` with cache read/upsert
- **Phase 5 — Remaining API gating:** `/api/chat`, `/api/campus-*`, rate-limit refactor to user.id keying

All 5 land on this branch. **No intermediate merges to main** — single squash merge after Phase 5 passes the final review gate.

## Open items deferred from Phase 1

Tracked in `.sherlock-plan.md` §12 Pivot Log + §14 Red-Team Log:

- **N5** ESLint `no-restricted-imports` on `lib/supabase/admin` — deferred (project has no ESLint; `server-only` is the real defense)
- **M3-migration** `relevance_cache` TTL sweep (pg_cron) — deferred, rows expire via `expires_at` read filter
- **L5** `relevance_cache.updated_at` trigger — deferred, demo scope
- **Timezone IANA CHECK** on `events.timezone` — deferred, app-layer validates today
- **H4 research** — whether `app_metadata.provider` is populated at Before-User-Created time for ALL flows (email OTP, Google, magic link). Live-validate in step 6 smoke test; if magic-link signup fails with "Unsupported auth provider," adjust the hook to allow missing provider.

## Quick state checks when resuming

```bash
git rev-parse --abbrev-ref HEAD          # should be feature/supabase-auth
git log --oneline -1                     # should be 29baf08 Phase 1
npx tsc --noEmit                         # expect clean
npm test -- --run                        # expect 95/95
cat .env.local | grep SUPABASE_URL       # confirms you provisioned
```
