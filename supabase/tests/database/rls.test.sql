-- ============================================================================
-- RLS truth-table for all four tables.
-- Covers ACs: 6-style negative tests, AC-8..16, AC-26 (profile_version lock).
-- Runs via `supabase test db`. Wrapped in begin/rollback so no persisted data.
-- ============================================================================
begin;

-- Load pgTAP. supabase test db pre-installs this.
create extension if not exists pgtap with schema extensions;

select plan(32);

-- ---------------------------------------------------------------------------
-- Seed two users. We run as postgres here so RLS is bypassed for setup.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, instance_id)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@umn.edu', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'bob@umn.edu',   'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- profiles auto-seeded by handle_new_user trigger. Verify.
select is(
  (select count(*)::int from public.profiles
   where user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')),
  2,
  'AC-14: handle_new_user trigger auto-seeded profile rows for both users'
);

-- Seed some data for each user as postgres.
insert into public.event_batches (id, user_id, source_notes) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alice batch 1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'bob batch 1');

insert into public.events (batch_id, user_id, title, starts_at, category, confidence) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alice event 1', now(), 'social', 'high'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alice event 2', now(), 'cs', 'high'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'alice event 3', now(), 'career', 'high'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'bob event 1',   now(), 'workshop', 'high');

insert into public.relevance_cache (user_id, event_hash, score, model_version, profile_version) values
  ('11111111-1111-1111-1111-111111111111', 'alice_hash_1', 80, 'test-model', 1),
  ('22222222-2222-2222-2222-222222222222', 'bob_hash_1',   90, 'test-model', 1);

-- ===========================================================================
-- PROFILES
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- AC-14: SELECT own profile
select is(
  (select count(*)::int from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  1, 'profiles: alice sees her own profile row');

-- AC-14: Cannot SELECT other user's profile
select is(
  (select count(*)::int from public.profiles where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'profiles: alice cannot see bob''s profile');

-- UPDATE own (allowed columns only)
select lives_ok(
  $$ update public.profiles set major = 'CS', interests = array['hackathons']
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'profiles: alice can UPDATE her own allowed columns');

-- Verify profile_version auto-bumped.
select is(
  (select profile_version from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  2::bigint,
  'profiles: profile_version auto-bumped on meaningful edit');

-- AC-26: Cannot UPDATE profile_version directly (column-level REVOKE).
-- PostgREST would return 403; in SQL, plain UPDATE from authenticated role
-- raises "permission denied for column".
select throws_ok(
  $$ update public.profiles set profile_version = 999
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',  -- insufficient_privilege
  null,
  'AC-26: profile_version is NOT directly client-writable (column-level REVOKE)');

-- AC-26 belt: even if the REVOKE were removed, trigger resets to OLD.
-- Simulate by testing as postgres (bypasses column grants) that trigger still
-- normalizes. This validates the defense-in-depth claim.
reset role;
select lives_ok(
  $$ update public.profiles set profile_version = 999
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'AC-26 belt: postgres can bypass column grant, trigger must normalize');
select is(
  (select profile_version from public.profiles where user_id = '11111111-1111-1111-1111-111111111111'),
  2::bigint,
  'AC-26 belt: bump_profile_version trigger locked value to OLD despite raw UPDATE');

-- UPDATE other user's row (as alice) — blocked by RLS USING.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select results_eq(
  $$ update public.profiles set major = 'ECE'
     where user_id = '22222222-2222-2222-2222-222222222222' returning user_id $$,
  $$ select '22222222-2222-2222-2222-222222222222'::uuid where false $$,
  'profiles: alice cannot UPDATE bob''s profile (RLS USING)');

-- No INSERT policy — authenticated INSERT should fail.
select throws_ok(
  $$ insert into public.profiles (user_id) values ('33333333-3333-3333-3333-333333333333') $$,
  null, null,
  'profiles: authenticated cannot INSERT (no policy + not a real user)');

-- ===========================================================================
-- EVENT_BATCHES
-- ===========================================================================
-- AC-8: own SELECT
select is(
  (select count(*)::int from public.event_batches),
  1, 'batches: alice sees exactly 1 row (her own)');

-- AC-9 / AC-15: cross-user block
select is(
  (select count(*)::int from public.event_batches where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'batches: alice cannot see bob''s batches');

-- AC-15 INSERT own
select lives_ok(
  $$ insert into public.event_batches (user_id, source_notes)
     values ('11111111-1111-1111-1111-111111111111', 'alice batch 2') $$,
  'batches: alice can INSERT own batch');

-- AC-10-equivalent INSERT other user's id — WITH CHECK rejects
select throws_ok(
  $$ insert into public.event_batches (user_id, source_notes)
     values ('22222222-2222-2222-2222-222222222222', 'forged') $$,
  '42501', null,
  'batches: alice cannot INSERT batch with bob''s user_id (WITH CHECK)');

-- UPDATE own
select lives_ok(
  $$ update public.event_batches set ics_committed = true
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'batches: alice can UPDATE her own batches');

-- AC-11 UPDATE to change user_id — WITH CHECK rejects
select throws_ok(
  $$ update public.event_batches set user_id = '22222222-2222-2222-2222-222222222222'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null,
  'batches: alice cannot UPDATE to reassign user_id to bob (WITH CHECK)');

-- DELETE own
select lives_ok(
  $$ delete from public.event_batches where source_notes = 'alice batch 2' $$,
  'batches: alice can DELETE her own batch');

-- DELETE other's — no rows affected (USING denies)
select results_eq(
  $$ delete from public.event_batches where user_id = '22222222-2222-2222-2222-222222222222' returning id $$,
  $$ select 'bbbbbbbb-0000-0000-0000-000000000001'::uuid where false $$,
  'batches: alice cannot DELETE bob''s batch');

-- ===========================================================================
-- EVENTS
-- ===========================================================================
-- AC-8 own read
select is(
  (select count(*)::int from public.events),
  3, 'events: alice sees exactly her 3 events');

-- AC-9 cross-user block
select is(
  (select count(*)::int from public.events where user_id = '22222222-2222-2222-2222-222222222222'),
  0, 'events: alice cannot see bob''s events');

-- AC-10 INSERT with foreign user_id
select throws_ok(
  $$ insert into public.events (batch_id, user_id, title, starts_at, category, confidence)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
             'forged', now(), 'social', 'high') $$,
  '42501', null,
  'events: alice cannot INSERT event with bob''s user_id (WITH CHECK)');

-- AC-13: user_id/batch_id mismatch via trigger
-- Here alice tries to insert an event tagged with her own user_id but pointing
-- at bob's batch. WITH CHECK passes (user_id = auth.uid()), then the trigger
-- catches batch_user mismatch.
select throws_ok(
  $$ insert into public.events (batch_id, user_id, title, starts_at, category, confidence)
     values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
             'cross-batch', now(), 'social', 'high') $$,
  null,
  'events.user_id must match parent batch.user_id',
  'AC-13: events_enforce_user_match trigger blocks user_id/batch_id mismatch');

-- ===========================================================================
-- ANON BLOCK (AC-12)
-- ===========================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.profiles),        0, 'AC-12: anon sees 0 profiles');
select is((select count(*)::int from public.event_batches),   0, 'AC-12: anon sees 0 batches');
select is((select count(*)::int from public.events),          0, 'AC-12: anon sees 0 events');
select is((select count(*)::int from public.relevance_cache), 0, 'AC-12: anon sees 0 relevance_cache rows');

-- ===========================================================================
-- RELEVANCE_CACHE write policies (AC-16)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- SELECT own works
select is(
  (select count(*)::int from public.relevance_cache where user_id = '11111111-1111-1111-1111-111111111111'),
  1, 'AC-16: relevance_cache SELECT own works');

-- INSERT blocked for authenticated (no policy)
select throws_ok(
  $$ insert into public.relevance_cache (user_id, event_hash, score, model_version, profile_version)
     values ('11111111-1111-1111-1111-111111111111', 'forged_hash', 50, 'test', 1) $$,
  '42501', null,
  'AC-16: authenticated cannot INSERT into relevance_cache (no policy)');

-- UPDATE blocked
select throws_ok(
  $$ update public.relevance_cache set score = 0
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'AC-16: authenticated cannot UPDATE relevance_cache (no policy)');

-- DELETE blocked
select throws_ok(
  $$ delete from public.relevance_cache
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'AC-16: authenticated cannot DELETE relevance_cache (no policy)');

-- service_role bypass: reset to postgres/service_role and verify write works.
reset role;
select lives_ok(
  $$ insert into public.relevance_cache (user_id, event_hash, score, model_version, profile_version)
     values ('11111111-1111-1111-1111-111111111111', 'service_upsert_hash', 75, 'test', 1) $$,
  'AC-16: service_role (postgres) can INSERT into relevance_cache');

-- ===========================================================================
-- SELECT policy NULL guard: no JWT at all
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims', '', true);
select is(
  (select count(*)::int from public.profiles),
  0,
  'profiles_select_own: no JWT → auth.uid() IS NULL → zero rows');

select * from finish();
rollback;
