import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Using middleware.ts (not Next 16's renamed proxy.ts) because proxy.ts has
// an open production bug with Cloudflare — vercel/next.js#86122.
// middleware.ts is still supported in Next 16 (deprecated, not removed).

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: do no work between createServerClient and getUser() — the
  // session cookie refresh depends on this call happening next.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Unauthenticated access to a protected route → redirect to /login.
  // Matcher below already excludes /login, /auth/*, /_next, static assets,
  // so anything reaching this point is protected.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Match all paths EXCEPT:
  //  - /login and anything under /auth/*  (auth flow itself)
  //  - /_next/static, /_next/image        (build assets)
  //  - /favicon.ico, common image types   (public assets)
  //
  // The negative lookahead keeps this list tight and intentional.
  matcher: [
    '/((?!login|auth/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
