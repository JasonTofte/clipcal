'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Server actions for password + magic-link auth.
// Google OAuth stays client-side (uses signInWithOAuth with hd='umn.edu').

function originFromHeaders(h: Headers): string {
  const forwardedHost = h.get('x-forwarded-host') ?? h.get('host');
  const forwardedProto = h.get('x-forwarded-proto') ?? 'https';
  return `${forwardedProto}://${forwardedHost}`;
}

// M1: do NOT leak raw Supabase error messages to the URL — they can reveal
// account existence ("User already registered") enabling enumeration against
// the small @umn.edu user base. Map to a small allowlist of generic strings.
function sanitizeAuthError(raw: string | undefined, kind: 'signin' | 'signup' | 'otp'): string {
  if (!raw) return 'auth_failed';
  const lower = raw.toLowerCase();
  // Domain-restriction hook message is safe to surface verbatim (it's the
  // whole point of the UX — tells the user "use your @umn.edu email").
  if (lower.includes('@umn.edu')) return raw;
  if (lower.includes('unsupported auth provider')) return raw;
  // Everything else: generic.
  if (kind === 'signin') return 'Invalid email or password.';
  if (kind === 'signup') return 'Could not create account.';
  return 'Could not send magic link.';
}

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(sanitizeAuthError(error.message, 'signin'))}`);
  }
  redirect('/');
}

export async function signUpWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createSupabaseServerClient();
  const origin = originFromHeaders(await headers());
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(sanitizeAuthError(error.message, 'signup'))}`);
  }
  redirect('/login?notice=check-email');
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');

  const supabase = await createSupabaseServerClient();
  const origin = originFromHeaders(await headers());
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(sanitizeAuthError(error.message, 'otp'))}`);
  }
  redirect('/login?notice=magic-link-sent');
}
