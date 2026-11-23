// ------- Supabase client for server code, acting as the signed-in person -------
// It carries the user's session cookie, so every query runs under the database's
// row-level security. If a bug in a page asks for too much, the database still says no.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SCHEMA, supabaseAnonKey, supabaseUrl } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: SCHEMA },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
