// ------- The test copy of the database -------
// The automated tests never run against live data. They use a second schema
// (shm_portal_test) and a second photo bucket in the same Supabase project,
// built from the very same migration files as the live one.
//
//   node scripts/test-db.mjs reset   rebuild the test copy from supabase/migrations
//   node scripts/test-db.mjs check   compare the live schema with the test copy
//
// "reset" doubles as a test of the migrations themselves: if the SQL in the repo
// cannot build a working database from nothing, it fails here.
// "check" answers: does the live database still match the SQL in the repo?
//
// Needs a Supabase access token (Account > Access Tokens) in SUPABASE_ACCESS_TOKEN.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import testEnv from '../tests/support/env.cjs';

const { TEST_NAMES, loadEnv } = testEnv;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnv();
const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN to a Supabase access token first.');
  process.exit(1);
}

const LIVE = { schema: 'shm_portal', bucket: 'shm-visit-photos', policyPrefix: 'shm_visit_photos_obj' };
const TEST = TEST_NAMES;
// Everything destructive below is aimed at TEST. Refuse to run if that ever
// stops looking like a test copy.
if (!TEST.schema.endsWith('_test') || !TEST.bucket.endsWith('-test')) throw new Error('Refusing: test names must end in _test / -test');

async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query, readOnly = false) => api('/database/query', 'POST', { query, read_only: readOnly });

// Rewrite a migration so it builds the test copy instead of the live one.
// Order matters: the policy prefix and bucket are renamed before the schema.
const forTest = (text) =>
  text
    .replaceAll(LIVE.policyPrefix, TEST.policyPrefix)
    .replaceAll(LIVE.bucket, TEST.bucket)
    .replaceAll(LIVE.schema, TEST.schema);

const migrations = readdirSync(join(root, 'supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();

// ------- reset -------
async function reset() {
  console.log(`Rebuilding ${TEST.schema} from ${migrations.length} migration files…`);
  await sql(`
    drop policy if exists ${TEST.policyPrefix}_read on storage.objects;
    drop policy if exists ${TEST.policyPrefix}_insert on storage.objects;
    drop policy if exists ${TEST.policyPrefix}_delete on storage.objects;
    drop schema if exists ${TEST.schema} cascade;
  `);
  for (const file of migrations) {
    const text = forTest(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
    await sql(`begin;\n${text}\ncommit;`);
    console.log(`  applied ${file}`);
  }

  // The API only serves schemas on its list. Add the test copy, keep the rest.
  const { db_schema: current } = await api('/postgrest');
  const exposed = current.split(',').map((name) => name.trim());
  if (!exposed.includes(TEST.schema)) {
    await api('/postgrest', 'PATCH', { db_schema: [...exposed, TEST.schema].join(',') });
    console.log(`  exposed ${TEST.schema} to the API`);
  }
  // Ask the API to pick up the new tables straight away.
  await sql(`notify pgrst, 'reload schema'`);
  console.log('Done.');
}

// ------- check -------
// Describe a schema as plain rows, with its own name blanked out so that the
// live schema and the test copy can be compared like for like.
async function describe(names) {
  const blank = (value) =>
    value == null ? value : String(value).replaceAll(names.policyPrefix, '<policy>').replaceAll(names.bucket, '<bucket>').replaceAll(names.schema, '<schema>');
  const queries = {
    columns: `select table_name, column_name, udt_name, is_nullable, column_default from information_schema.columns where table_schema = '${names.schema}' order by 1, 2`,
    rls: `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = '${names.schema}' and c.relkind = 'r' order by 1`,
    policies: `select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = '${names.schema}' order by 1, 2`,
    storage_policies: `select policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'storage' and policyname like '${names.policyPrefix}%' order by 1`,
    functions: `select p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = '${names.schema}' order by 1`,
    grants: `select c.relname, r.role, concat_ws(',', case when has_table_privilege(r.role, c.oid, 'select') then 'select' end, case when has_table_privilege(r.role, c.oid, 'insert') then 'insert' end, case when has_table_privilege(r.role, c.oid, 'update') then 'update' end, case when has_table_privilege(r.role, c.oid, 'delete') then 'delete' end) as can from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('anon'), ('authenticated'), ('service_role')) as r(role) where n.nspname = '${names.schema}' and c.relkind = 'r' order by 1, 2`,
    constraints: `select conrelid::regclass::text as on_table, contype, pg_get_constraintdef(oid) as definition from pg_constraint where connamespace = '${names.schema}'::regnamespace order by 1, 3`,
    bucket: `select public, file_size_limit, allowed_mime_types::text from storage.buckets where id = '${names.bucket}'`,
    migrations: `select version from ${names.schema}._migration_history order by 1`,
  };
  const out = {};
  for (const [key, query] of Object.entries(queries)) {
    const rows = await sql(query, true);
    out[key] = rows.map((row) => JSON.stringify(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, blank(v)]))));
  }
  return out;
}

async function check() {
  const [live, test] = [await describe(LIVE), await describe(TEST)];
  let problems = 0;
  for (const key of Object.keys(live)) {
    const onlyLive = live[key].filter((row) => !test[key].includes(row));
    const onlyTest = test[key].filter((row) => !live[key].includes(row));
    const same = !onlyLive.length && !onlyTest.length;
    console.log(`${same ? 'same  ' : 'DIFFER'}  ${key} (${live[key].length} live, ${test[key].length} test)`);
    onlyLive.forEach((row) => console.log(`    only in live: ${row}`));
    onlyTest.forEach((row) => console.log(`    only in test: ${row}`));
    if (!same) problems++;
  }
  const applied = live.migrations.map((row) => JSON.parse(row).version);
  const missing = migrations.filter((file) => !applied.includes(file));
  if (missing.length) {
    problems++;
    console.log(`NOT APPLIED to live: ${missing.join(', ')}`);
  }
  if (problems) {
    console.error(`\n${problems} difference(s). The live database does not match supabase/migrations.`);
    process.exit(1);
  }
  console.log('\nThe live database matches supabase/migrations exactly.');
}

const command = process.argv[2];
if (command === 'reset') await reset();
else if (command === 'check') await check();
else {
  console.error('Usage: node scripts/test-db.mjs reset|check');
  process.exit(1);
}
