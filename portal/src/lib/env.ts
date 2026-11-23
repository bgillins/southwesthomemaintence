// ------- Environment -------
// One place that reads env vars, so a missing one fails with a clear message.

export const SCHEMA = 'shm_portal';
export const PHOTO_BUCKET = 'shm-visit-photos';

// Vercel's Supabase integration provides either the older "anon / service role"
// names or the newer "publishable / secret" ones. Accept both.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

// Public address of the portal, used to build links in emails.
export function appUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = process.env.APP_URL || (vercel ? `https://${vercel}` : 'http://localhost:3000');
  return url.replace(/\/$/, '');
}

export function ownerEmails(): string[] {
  return (process.env.PORTAL_OWNER_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
