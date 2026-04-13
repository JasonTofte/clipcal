-- ============================================================================
-- enforce_umn_domain Before-User-Created hook tests.
-- Covers AC-1..4, AC-33, AC-34.
-- ============================================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

-- Helper: build a minimal hook event payload.
create or replace function pg_temp.mk_event(email text, provider text default 'email')
returns jsonb language sql as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'email', email,
      'app_metadata', jsonb_build_object('provider', provider)
    )
  );
$$;

-- AC-1: @umn.edu + email provider → allowed
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@umn.edu', 'email')),
  '{}'::jsonb,
  'AC-1: alice@umn.edu with email provider → allowed');

-- AC-1: google provider also allowed for @umn.edu
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@umn.edu', 'google')),
  '{}'::jsonb,
  'AC-1b: alice@umn.edu via google provider → allowed');

-- AC-2: gmail domain → rejected
select is(
  public.enforce_umn_domain(pg_temp.mk_event('bob@gmail.com', 'email'))->'error'->>'http_code',
  '400',
  'AC-2: @gmail.com → rejected with 400');

-- AC-4: magic link with non-umn → rejected (same hook, same result; timing is Supabase-side)
select is(
  public.enforce_umn_domain(pg_temp.mk_event('eve@gmail.com', 'email'))->'error'->>'message',
  'Only @umn.edu email addresses are allowed.',
  'AC-4: magic link non-umn rejected with clear message');

-- AC-34: email with trailing dot — rejected
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@umn.edu.', 'email'))->'error'->>'http_code',
  '400',
  'AC-34a: trailing-dot email rejected');

-- AC-34: subdomain — rejected (exact domain match via split_part)
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@sub.umn.edu', 'email'))->'error'->>'http_code',
  '400',
  'AC-34b: sub.umn.edu rejected (not exactly umn.edu)');

-- AC-34: confusable / suffix-stuffing — rejected
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@umn.edu.evil.com', 'email'))->'error'->>'http_code',
  '400',
  'AC-34c: umn.edu.evil.com rejected');

-- AC-34: uppercase — normalized to lowercase, then accepted
select is(
  public.enforce_umn_domain(pg_temp.mk_event('ALICE@UMN.EDU', 'email')),
  '{}'::jsonb,
  'AC-34d: uppercase @UMN.EDU normalized and accepted');

-- AC-34: whitespace around email — trimmed
select is(
  public.enforce_umn_domain(pg_temp.mk_event('  alice@umn.edu  ', 'email')),
  '{}'::jsonb,
  'AC-34e: whitespace trimmed before domain check');

-- AC-34: control characters (newline) — rejected
select is(
  public.enforce_umn_domain(pg_temp.mk_event(E'alice@umn.edu\n@evil.com', 'email'))->'error'->>'http_code',
  '400',
  'AC-34f: control char in email rejected');

-- Missing email — rejected
select is(
  public.enforce_umn_domain(jsonb_build_object(
    'user', jsonb_build_object('email', null, 'app_metadata', jsonb_build_object('provider','email'))
  ))->'error'->>'http_code',
  '400',
  'null email rejected');

-- AC-33: unsupported provider — rejected even with valid umn email
select is(
  public.enforce_umn_domain(pg_temp.mk_event('alice@umn.edu', 'github'))->'error'->>'message',
  'Unsupported auth provider.',
  'AC-33: unknown provider (github) rejected');

-- AC-33: missing provider — rejected
select is(
  public.enforce_umn_domain(jsonb_build_object(
    'user', jsonb_build_object('email', 'alice@umn.edu', 'app_metadata', jsonb_build_object())
  ))->'error'->>'message',
  'Unsupported auth provider.',
  'AC-33: missing provider rejected');

-- Empty email string — rejected
select is(
  public.enforce_umn_domain(pg_temp.mk_event('', 'email'))->'error'->>'http_code',
  '400',
  'empty-string email rejected');

select * from finish();
rollback;
