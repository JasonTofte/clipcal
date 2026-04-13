// Service-role Supabase client. BYPASSES ROW-LEVEL SECURITY.
//
// Enforcement posture:
// - `server-only` import below makes this module un-bundleable by the client.
//   This is the PRIMARY defense against key leakage.
// - Single-import posture is grep-auditable:
//     grep -rn "supabase/admin" app/ lib/
//   Only allowed consumer (Phase 4+): app/api/relevance/route.ts.
//   Any other import must be rejected in code review.
//
// When used, `user_id` for writes MUST come from
// `(await supabase.auth.getUser()).data.user.id`, NEVER from a request body.

import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'createSupabaseAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
