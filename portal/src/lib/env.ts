// ------- Environment -------
// One place that reads env vars, so a missing one fails with a clear message.

// The live data lives in the "shm_portal" schema and the "shm-visit-photos" bucket.
// The automated tests point these at a separate copy (see tests/README.md) so a
// test run can never touch a real customer's records.
export const SCHEMA = process.env.NEXT_PUBLIC_PORTAL_SCHEMA || 'shm_portal';
export const PHOTO_BUCKET = process.env.NEXT_PUBLIC_PORTAL_PHOTO_BUCKET || 'shm-visit-photos';

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
// Order: an explicit APP_URL, then the address Vercel gave this deployment
// (the live site in production, the branch's own address for a preview).
export function appUrl(): string {
  const vercelHost =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  const url = process.env.APP_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000');
  return url.replace(/\/$/, '');
}

export function ownerEmails(): string[] {
  return (process.env.PORTAL_OWNER_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
