// ------- Direct access to the TEST database, for setting up and checking -------
// Tests use this to (1) create starting data quickly, and (2) look behind the
// screen and confirm that what the app showed is what was actually saved.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildVisitItems } from '@/lib/plan';
import { fromLocalInput, localDate } from '@/lib/time';
import type { PlanTier, VisitStatus, VisitType } from '@/lib/types';
import { loadEnv, TEST_EMAIL_PATTERN, TEST_NAMES } from './env.cjs';

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL as string;
export const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
export const BUCKET = TEST_NAMES.bucket;

// Service-role client on the test schema. Bypasses access rules on purpose.
export const admin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY as string, {
  db: { schema: TEST_NAMES.schema },
  auth: { persistSession: false, autoRefreshToken: false },
});

// A client with no login, like a stranger on the internet. `schema` lets a test
// aim it at the live schema to prove test logins cannot see live data.
export function anonClient(schema: string = TEST_NAMES.schema): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { db: { schema }, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as SupabaseClient;
}

// A client signed in as the given email (creating the login if needed).
export async function signedInClient(email: string, schema: string = TEST_NAMES.schema): Promise<{ client: SupabaseClient; userId: string }> {
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const client = anonClient(schema);
  const session = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (session.error || !session.data.user) throw session.error ?? new Error('no session');
  return { client, userId: session.data.user.id };
}

export async function staffByEmail(email: string) {
  const { data } = await admin.from('staff').select('*').eq('email', email).maybeSingle();
  return data as { id: string; full_name: string; role: string; active: boolean } | null;
}

// ------- Starting data -------
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface SeedHome {
  name?: string;
  email?: string | null;
  plan?: PlanTier;
  features?: string[];
  ccEmail?: string | null;
  ccOk?: boolean;
  address?: string;
}

export async function seedHome(options: SeedHome = {}) {
  const id = unique();
  const { data: customer, error: customerError } = await admin
    .from('customers')
    .insert({ name: options.name ?? `Test Customer ${id}`, email: options.email === undefined ? `shm-e2e-cust-${id}@example.com` : options.email, phone: '702-555-0100' })
    .select('*')
    .single();
  if (customerError) throw customerError;
  const { data: home, error: homeError } = await admin
    .from('homes')
    .insert({
      customer_id: customer.id,
      address: options.address ?? `${100 + counter} Test Canyon Dr ${id}`,
      city: 'Henderson',
      zip: '89052',
      plan: options.plan ?? 'plus',
      features: options.features ?? [],
      access_notes: 'Gate code 4321',
      report_cc_name: options.ccEmail ? 'Jordan (daughter)' : null,
      report_cc_email: options.ccEmail ?? null,
      report_cc_ok: options.ccOk ?? false,
    })
    .select('*')
    .single();
  if (homeError) throw homeError;
  return { customer, home };
}

export interface SeedVisit {
  techId?: string | null;
  status?: VisitStatus;
  type?: VisitType;
  seq?: number;
  // Las Vegas wall-clock time, e.g. "2026-11-23T09:00". Defaults to today 10:00.
  when?: string;
  // 'done' answers every item, 'none' leaves them all open.
  answers?: 'done' | 'none';
  summary?: string | null;
}

export async function seedVisit(home: { id: string; plan: PlanTier; features: string[] }, options: SeedVisit = {}) {
  const status = options.status ?? 'scheduled';
  const type = options.type ?? 'maintenance';
  const seq = options.seq ?? 1;
  const when = fromLocalInput(options.when ?? `${localDate()}T10:00`);
  const { data: visit, error } = await admin
    .from('visits')
    .insert({
      home_id: home.id,
      tech_id: options.techId ?? null,
      visit_type: type,
      seq,
      plan: home.plan,
      status,
      scheduled_for: when.toISOString(),
      started_at: status === 'scheduled' ? null : when.toISOString(),
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      summary: options.summary ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  const planned = buildVisitItems({ visitType: type, plan: home.plan, seq, features: home.features });
  const { data: items, error: itemsError } = await admin
    .from('visit_items')
    .insert(planned.map((item) => ({ ...item, visit_id: visit.id, status: options.answers === 'done' ? 'done' : 'pending' })))
    .select('*')
    .order('sort');
  if (itemsError) throw itemsError;
  return { visit, items: items ?? [] };
}

// ------- Cleanup -------
// Empties the TEST copy only: every row, every photo, and every login whose
// address matches the test pattern. The live schema is never named here.
export async function wipeTestData() {
  if (!TEST_NAMES.schema.endsWith('_test')) throw new Error('Refusing to wipe a schema that is not the test copy');

  const { data: folders } = await admin.storage.from(BUCKET).list('', { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from(BUCKET).list(folder.name, { limit: 1000 });
    if (files?.length) await admin.storage.from(BUCKET).remove(files.map((file) => `${folder.name}/${file.name}`));
  }

  // Deleting customers removes their homes, visits, items and photo records too.
  const everything = '00000000-0000-0000-0000-000000000000';
  await admin.from('customers').delete().neq('id', everything);
  await admin.from('message_log').delete().gte('id', 0);
  await admin.from('staff').delete().neq('id', everything);

  for (let page = 1; page < 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const user of users) if (TEST_EMAIL_PATTERN.test(user.email ?? '')) await admin.auth.admin.deleteUser(user.id);
    if (users.length < 200) break;
  }
}
