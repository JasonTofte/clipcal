-- ============================================================================
-- ClipCal — initial schema
-- Tables: profiles, event_batches, events, relevance_cache
-- Auth: enforce_umn_domain hook target
-- RLS: enabled on all four tables, deterministic policies, (select auth.uid())
--      wrapped for planner caching, server-managed columns protected by
--      column-level REVOKE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  major             text,
  stage             text check (stage in ('freshman','sophomore','junior','senior','grad')),
  interests         text[] not null default '{}',
  show_tradeoffs    boolean not null default true,
  surface_noticings boolean not null default true,
  vibe              text,
  profile_version   bigint not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Auto-bump profile_version on meaningful edits AND defensively lock
-- server-managed columns to OLD values. Column-level REVOKE below is the
-- primary gate; this is belt+suspenders and also handles `updated_at`.
create or replace function public.bump_profile_version() returns trigger
language plpgsql
security definer set search_path = '' as $$
begin
  new.profile_version := coalesce(old.profile_version, 1);
  new.created_at      := old.created_at;
  -- H2: sort interests before comparing — reordering the same tags should
  -- NOT bump the version (would needlessly invalidate relevance_cache).
  if new.major    is distinct from old.major
     or new.stage is distinct from old.stage
     or (select array(select unnest(coalesce(new.interests, '{}')) order by 1))
        is distinct from
        (select array(select unnest(coalesce(old.interests, '{}')) order by 1))
     or new.vibe  is distinct from old.vibe then
    new.profile_version := coalesce(old.profile_version, 1) + 1;
  end if;
  new.updated_at := now();
  return new;
end; $$;

create trigger profiles_bump_version
  before update on public.profiles
  for each row execute function public.bump_profile_version();

-- Seed a profiles row on first signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Policies: SELECT/UPDATE own only. INSERT blocked (trigger seeds). DELETE
-- blocked (cascade from auth.users is the only deletion path).
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ( (select auth.uid()) is not null and (select auth.uid()) = user_id );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- C1: server-managed columns are NOT client-writable via PostgREST.
-- RLS WITH CHECK cannot reference OLD; column-level REVOKE is the canonical gate.
-- Explicit SELECT grant so column-level semantics don't drift if Supabase
-- changes its bootstrap default grants.
grant  select on public.profiles to authenticated;
revoke update (profile_version, created_at, updated_at) on public.profiles from authenticated;
grant  update (major, stage, interests, show_tradeoffs, surface_noticings, vibe)
       on public.profiles to authenticated;

-- H1: make SECURITY DEFINER function ownership explicit. The definer must
-- be a role that bypasses RLS on public.profiles (postgres does). If a
-- future migration re-creates these functions under a different owner,
-- this ALTER will catch the drift.
alter function public.handle_new_user()         owner to postgres;
alter function public.bump_profile_version()    owner to postgres;

-- ----------------------------------------------------------------------------
-- event_batches
-- ----------------------------------------------------------------------------
create table public.event_batches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source_notes  text,
  ics_committed boolean not null default false,
  added_at      timestamptz not null default now()
);
alter table public.event_batches enable row level security;
create index event_batches_user_idx on public.event_batches (user_id, added_at desc);

create policy "batches_select_own" on public.event_batches
  for select to authenticated
  using ( (select auth.uid()) = user_id );
create policy "batches_insert_own" on public.event_batches
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );
create policy "batches_update_own" on public.event_batches
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
create policy "batches_delete_own" on public.event_batches
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.event_batches(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  location      text,
  description   text,
  category      text not null check (category in
    ('workshop','networking','social','cs','career','culture','sports','hackathon','other')),
  has_free_food boolean not null default false,
  timezone      text not null default 'America/Chicago',
  confidence    text not null check (confidence in ('high','medium','low')),
  venue_setting text,
  crowd_size    text,
  created_at    timestamptz not null default now()
);
alter table public.events enable row level security;
create index events_user_starts_idx on public.events (user_id, starts_at);
create index events_batch_idx       on public.events (batch_id);

-- Denormalized user_id must match parent batch's user_id.
-- SECURITY INVOKER (not DEFINER) — the trigger only reads the user's own
-- event_batches rows which they already have SELECT rights to via RLS.
-- Invoker is strictly safer: no search-path-hijack vector if owner is
-- ever compromised.
create or replace function public.events_enforce_user_match() returns trigger
language plpgsql
security invoker set search_path = '' as $$
declare batch_user uuid;
begin
  select user_id into batch_user from public.event_batches where id = new.batch_id;
  if batch_user is null or batch_user <> new.user_id then
    raise exception 'events.user_id must match parent batch.user_id';
  end if;
  return new;
end; $$;

create trigger events_user_match
  before insert or update on public.events
  for each row execute function public.events_enforce_user_match();

create policy "events_select_own" on public.events
  for select to authenticated
  using ( (select auth.uid()) = user_id );
create policy "events_insert_own" on public.events
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );
create policy "events_update_own" on public.events
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
create policy "events_delete_own" on public.events
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

-- ----------------------------------------------------------------------------
-- relevance_cache
-- ----------------------------------------------------------------------------
create table public.relevance_cache (
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_hash      text not null,
  score           smallint not null check (score between 0 and 100),
  reason          text,
  model_version   text not null,
  profile_version bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  primary key (user_id, event_hash)
);
alter table public.relevance_cache enable row level security;
create index relevance_cache_expires_idx      on public.relevance_cache (expires_at);
create index relevance_cache_user_version_idx on public.relevance_cache (user_id, profile_version);

-- Clients read own cache only. Writes go through service_role in /api/relevance.
create policy "relevance_cache_select_own" on public.relevance_cache
  for select to authenticated
  using ( (select auth.uid()) = user_id );
-- NO insert/update/delete policies for authenticated. service_role bypasses RLS.

-- ----------------------------------------------------------------------------
-- UMN domain enforcement (Before User Created Hook target)
-- ----------------------------------------------------------------------------
create or replace function public.enforce_umn_domain(event jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  email_addr text := lower(trim(event->'user'->>'email'));
  provider   text := event->'user'->'app_metadata'->>'provider';
  domain_err jsonb := jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 400,
      'message', 'Only @umn.edu email addresses are allowed.'
    )
  );
begin
  if email_addr is null
     or email_addr = ''
     or email_addr ~ '[[:cntrl:]]'
     or right(email_addr, 1) = '.' then
    return domain_err;
  end if;

  if split_part(email_addr, '@', 2) <> 'umn.edu' then
    return domain_err;
  end if;

  if provider is null or provider not in ('email', 'google') then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Unsupported auth provider.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.enforce_umn_domain to supabase_auth_admin;
revoke execute on function public.enforce_umn_domain from authenticated, anon, public;
