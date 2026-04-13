import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// OAuth + magic-link callback. Exchanges the ?code for a session cookie.
// AC-32: on failure, redirect to /login with a visible error, not a blank 500.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url),
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(error.message)}`,
          request.url,
        ),
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL('/login?error=oauth_callback_failed', request.url),
    );
  }

  // Open-redirect guard: only allow same-origin "next" paths.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(new URL(safeNext, request.url));
}
