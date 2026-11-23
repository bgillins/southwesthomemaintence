// ------- Supabase client for the browser -------
// Used only for photo uploads, which go straight from the phone to storage.
import { createBrowserClient } from '@supabase/ssr';
import { SCHEMA, supabaseAnonKey, supabaseUrl } from '@/lib/env';

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, { db: { schema: SCHEMA } });
}
