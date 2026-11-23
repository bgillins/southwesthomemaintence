// ------- Who can reach the data, tested at the database itself -------
// The pages hide things, but a determined person can skip the pages and talk to
// the database API directly with the public key. These tests do exactly that,
// as four kinds of people, and check the database refuses each one correctly.
import { expect, test } from '@playwright/test';
import { admin, anonClient, BUCKET, seedHome, seedVisit, signedInClient, SUPABASE_URL } from '../support/db';
import { testEmail } from '../support/env.cjs';
import { OWNER, TECH } from '../support/helpers';

const TABLES = [
  'staff', 'customers', 'homes', 'home_equipment', 'home_supplies', 'home_tasks',
  'visits', 'visit_items', 'visit_photos', 'visit_readings', 'visit_supplies', 'message_log',
];

let customerId = '';
let homeId = '';
let photoPath = '';
let openVisitId = '';
let openItemId = '';

test.beforeAll(async () => {
  const { home, customer } = await seedHome({ name: 'Access Test Customer' });
  const { visit } = await seedVisit(home, { status: 'in_progress' });
  const { items } = await admin.from('visit_items').select('id').eq('visit_id', visit.id).order('sort').limit(1).then((result) => ({ items: result.data ?? [] }));
  customerId = customer.id;
  homeId = home.id;
  openVisitId = visit.id;
  openItemId = items[0].id;
  photoPath = `${visit.id}/access-test.jpg`;
  await admin.storage.from(BUCKET).upload(photoPath, Buffer.from('not really a jpeg'), { contentType: 'image/jpeg' });
  await admin.from('visit_photos').insert({ visit_id: visit.id, storage_path: photoPath });
  await admin.from('message_log').insert({ template: 'visit_report', recipient: 'x@example.com', status: 'sent' });
});

test('every table has data in it, so "zero rows" below really means "refused"', async () => {
  for (const table of TABLES.filter((name) => !['home_equipment', 'home_supplies', 'home_tasks', 'visit_readings', 'visit_supplies'].includes(name))) {
    const { count } = await admin.from(table).select('*', { count: 'exact', head: true });
    expect(count, table).toBeGreaterThan(0);
  }
});

test.describe('a stranger with no login', () => {
  const stranger = anonClient();

  test('is refused on every table', async () => {
    for (const table of [...TABLES, '_migration_history']) {
      const { data, error } = await stranger.from(table).select('*').limit(1);
      expect(error?.code, table).toBe('42501'); // "permission denied"
      expect(data).toBeNull();
    }
  });

  test('cannot write anything', async () => {
    expect((await stranger.from('customers').insert({ name: 'x' })).error?.code).toBe('42501');
    expect((await stranger.from('customers').update({ name: 'x' }).eq('id', customerId)).error?.code).toBe('42501');
    expect((await stranger.from('customers').delete().eq('id', customerId)).error?.code).toBe('42501');
  });

  test('cannot see, sign for, or upload photos', async () => {
    expect((await stranger.storage.from(BUCKET).createSignedUrl(photoPath, 60)).error).not.toBeNull();
    expect((await stranger.storage.from(BUCKET).download(photoPath)).error).not.toBeNull();
    expect((await stranger.storage.from(BUCKET).upload('x/y.jpg', Buffer.from('x'), { contentType: 'image/jpeg' })).error).not.toBeNull();
    expect((await stranger.storage.from(BUCKET).list('')).data ?? []).toEqual([]);
    expect((await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photoPath}`)).ok).toBe(false);
  });
});

test.describe('someone logged in to the shared account system, but not on this team', () => {
  let outsider: Awaited<ReturnType<typeof signedInClient>>;
  test.beforeAll(async () => {
    outsider = await signedInClient(testEmail('api-outsider'));
  });

  test('sees zero rows in every table', async () => {
    for (const table of TABLES) {
      const { data, error } = await outsider.client.from(table).select('*').limit(5);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  test('cannot add, change or delete anything', async () => {
    expect((await outsider.client.from('customers').insert({ name: 'intruder' })).error?.code).toBe('42501');
    await outsider.client.from('customers').update({ name: 'hacked' }).eq('id', customerId);
    await outsider.client.from('customers').delete().eq('id', customerId);
    expect((await admin.from('customers').select('name').eq('id', customerId).single()).data?.name).toBe('Access Test Customer');
  });

  test('cannot make themselves staff', async () => {
    const attempt = await outsider.client.from('staff').insert({ id: outsider.userId, full_name: 'Me', email: testEmail('api-outsider'), role: 'owner' });
    expect(attempt.error?.code).toBe('42501');
    expect((await admin.from('staff').select('id').eq('id', outsider.userId)).data).toEqual([]);
  });

  test('cannot reach photos', async () => {
    expect((await outsider.client.storage.from(BUCKET).createSignedUrl(photoPath, 60)).error).not.toBeNull();
    expect((await outsider.client.storage.from(BUCKET).upload('x/y.jpg', Buffer.from('x'), { contentType: 'image/jpeg' })).error).not.toBeNull();
  });
});

test.describe('a technician', () => {
  let tech: Awaited<ReturnType<typeof signedInClient>>;
  test.beforeAll(async () => {
    tech = await signedInClient(TECH);
  });

  test('can read and update the homes they work on', async () => {
    expect((await tech.client.from('homes').select('id').eq('id', homeId)).data).toHaveLength(1);
    expect((await tech.client.from('homes').update({ access_notes: 'Updated by tech' }).eq('id', homeId).select('id')).data).toHaveLength(1);
    expect((await tech.client.storage.from(BUCKET).createSignedUrl(photoPath, 60)).error).toBeNull();
  });

  test('cannot delete customers, homes or visits (owners only)', async () => {
    for (const [table, id] of [['customers', customerId], ['homes', homeId]] as const) {
      const { data } = await tech.client.from(table).delete().eq('id', id).select('id');
      expect(data, table).toEqual([]);
    }
    expect((await admin.from('customers').select('id').eq('id', customerId)).data).toHaveLength(1);
  });

  test('cannot promote themselves, add staff, or switch anyone off', async () => {
    await tech.client.from('staff').update({ role: 'owner' }).eq('id', tech.userId);
    expect((await admin.from('staff').select('role').eq('id', tech.userId).single()).data?.role).toBe('tech');
    expect((await tech.client.from('staff').insert({ id: '3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b', full_name: 'Ghost', email: 'ghost@example.com' })).error).not.toBeNull();
    await tech.client.from('staff').update({ active: false }).neq('id', tech.userId);
    expect((await admin.from('staff').select('id').eq('active', false)).data).toEqual([]);
  });

  test('cannot edit or delete the email log', async () => {
    await tech.client.from('message_log').update({ status: 'tampered' }).gte('id', 0);
    await tech.client.from('message_log').delete().gte('id', 0);
    const { data } = await admin.from('message_log').select('status');
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.some((row) => row.status === 'tampered')).toBe(false);
  });

  test('loses everything the moment their access is switched off', async () => {
    const temp = await signedInClient(testEmail('api-temp'));
    await admin.from('staff').insert({ id: temp.userId, full_name: 'Temp Tech', email: testEmail('api-temp'), role: 'tech' });
    expect((await temp.client.from('homes').select('id').limit(1)).data).toHaveLength(1);
    await admin.from('staff').update({ active: false }).eq('id', temp.userId);
    // Same login, same session, no new sign-in: the door is already shut.
    expect((await temp.client.from('homes').select('id').limit(1)).data).toEqual([]);
    expect((await temp.client.storage.from(BUCKET).createSignedUrl(photoPath, 60)).error).not.toBeNull();
  });
});

test.describe('the save-an-answer function', () => {
  const call = (client: Awaited<ReturnType<typeof signedInClient>>['client'], item: string, visit: string) =>
    client.rpc('answer_item', { p_item: item, p_visit: visit, p_status: 'done', p_note: 'via api', p_set_note: true });
  const statusOf = async (item: string) => (await admin.from('visit_items').select('status, note').eq('id', item).single()).data;

  test('is refused for a stranger and does nothing for a non-team login', async () => {
    expect((await call(anonClient(), openItemId, openVisitId)).error).not.toBeNull();
    const outsider = await signedInClient(testEmail('api-outsider'));
    expect((await call(outsider.client, openItemId, openVisitId)).data).toBe(false);
    expect(await statusOf(openItemId)).toEqual({ status: 'pending', note: null });
  });

  test('saves for a technician, records who answered, and refuses once the visit is finished', async () => {
    const tech = await signedInClient(TECH);
    expect((await call(tech.client, openItemId, openVisitId)).data).toBe(true);
    expect(await statusOf(openItemId)).toEqual({ status: 'done', note: 'via api' });
    expect((await admin.from('visit_items').select('updated_by').eq('id', openItemId).single()).data?.updated_by).toBe(tech.userId);

    // An item cannot be saved against a different visit's id.
    const other = await seedVisit((await seedHome()).home, { status: 'in_progress' });
    expect((await call(tech.client, openItemId, other.visit.id)).data).toBe(false);

    // Finished and scheduled visits are closed to answers.
    for (const status of ['completed', 'scheduled', 'cancelled'] as const) {
      const closed = await seedVisit((await seedHome()).home, { status });
      expect((await call(tech.client, closed.items[0].id, closed.visit.id)).data, status).toBe(false);
      expect((await statusOf(closed.items[0].id))?.status, status).toBe('pending');
    }
  });
});

test.describe('an owner', () => {
  test('can delete a customer, which removes their homes and visits with them', async () => {
    const owner = await signedInClient(OWNER);
    const { home, customer } = await seedHome({ name: 'To Be Deleted' });
    const { visit } = await seedVisit(home);
    expect((await owner.client.from('customers').delete().eq('id', customer.id).select('id')).data).toHaveLength(1);
    expect((await admin.from('homes').select('id').eq('id', home.id)).data).toEqual([]);
    expect((await admin.from('visits').select('id').eq('id', visit.id)).data).toEqual([]);
    expect((await admin.from('visit_items').select('id').eq('visit_id', visit.id)).data).toEqual([]);
  });
});

test('test logins have no access to the LIVE data', async () => {
  // The test owner is staff in the test copy only. Aimed at the live schema,
  // the same login must see nothing and change nothing.
  const owner = await signedInClient(OWNER, 'shm_portal');
  for (const table of TABLES) {
    const { data, error } = await owner.client.from(table).select('*').limit(1);
    expect(error, table).toBeNull();
    expect(data, table).toEqual([]);
  }
  expect((await owner.client.from('customers').insert({ name: 'must not appear in live' })).error?.code).toBe('42501');
  expect((await owner.client.storage.from('shm-visit-photos').upload('x/y.jpg', Buffer.from('x'), { contentType: 'image/jpeg' })).error).not.toBeNull();
});
