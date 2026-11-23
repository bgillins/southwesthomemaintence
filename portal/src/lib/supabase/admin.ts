// ------- Supabase client with the service role -------
// Bypasses row-level security, so it is used in exactly three places:
// sign-in, adding team members, and the customer's report page (no login there).
// Never import this from a client component.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SCHEMA, serviceRoleKey, supabaseUrl } from '@/lib/env';

export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey(), {
    db: { schema: SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
