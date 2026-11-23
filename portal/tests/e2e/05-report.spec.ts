// ------- The customer's report: what they see, and what nobody else can -------
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { addDays, formatLongDay, fromLocalInput, localDate } from '@/lib/time';
import { admin, BUCKET, seedHome, seedVisit, SUPABASE_URL } from '../support/db';
import { expectNoSidewaysScroll, PHOTO_TALL } from '../support/helpers';

// No storageState: every test here is a customer with no login.
let report: { url: string; token: string; photoPath: string; flagged: string; skipped: string; doneName: string; otherCustomer: string; nextVisit: string };

test.beforeAll(async () => {
  const { home } = await seedHome({ name: 'Walter Okafor', plan: 'essentials', address: '77 Report Lane' });
  const { visit, items } = await seedVisit(home, {
    status: 'completed',
    answers: 'done',
    summary: 'all looked good today.\n<script>window.__injected = true</script>',
  });
  const [flagged, skipped, done] = items;
  await admin.from('visit_items').update({ status: 'attention', note: 'Slow drip at the hot supply valve. <b>Not urgent</b>, worth a plumber.' }).eq('id', flagged.id);
  await admin.from('visit_items').update({ status: 'na' }).eq('id', skipped.id);
  await admin.from('visit_items').update({ note: 'New 9V batteries fitted.' }).eq('id', done.id);

  const path = `${visit.id}/report-photo.jpg`;
  await admin.storage.from(BUCKET).upload(path, readFileSync(PHOTO_TALL), { contentType: 'image/jpeg' });
  await admin.from('visit_photos').insert({ visit_id: visit.id, item_id: flagged.id, storage_path: path, width: 800, height: 1600 });
  await admin.from('visit_readings').insert({ visit_id: visit.id, key: 'water_pressure', value: 58 });
  await admin.from('visit_supplies').insert({ visit_id: visit.id, name: 'Air filter: 16x25x1', qty: 2 });
  await admin.from('home_tasks').insert({ home_id: home.id, title: 'Fix the squeaky gate', status: 'done', done_visit_id: visit.id, done_at: new Date().toISOString() });

  // A visit already booked for later, and a different customer's finished visit.
  const nextDay = addDays(localDate(), 90);
  await seedVisit(home, { when: `${nextDay}T09:00`, seq: 2 });
  const other = await seedHome({ name: 'Someone Else Entirely', address: '1 Other Street' });
  await seedVisit(other.home, { status: 'completed', answers: 'done', summary: 'Private to the other customer.' });

  report = {
    url: `/r/${visit.report_token}`,
    token: visit.report_token,
    photoPath: path,
    flagged: flagged.name,
    skipped: skipped.name,
    doneName: done.name,
    otherCustomer: 'Someone Else Entirely',
    nextVisit: formatLongDay(fromLocalInput(`${nextDay}T09:00`)),
  };
});

test('opens with no login and shows the whole visit', async ({ page }) => {
  const response = await page.goto(report.url);
  expect(response!.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Your home report' })).toBeVisible();
  await expect(page.getByText('Essentials plan · visit 1 of 4')).toBeVisible();
  await expect(page.getByText('77 Report Lane, Henderson')).toBeVisible();

  // The three numbers at the top.
  const total = await admin.from('visit_items').select('status').eq('visit_id', (await admin.from('visits').select('id').eq('report_token', report.token).single()).data!.id);
  const doneCount = total.data!.filter((item) => item.status === 'done').length;
  await expect(page.getByText('items completed').locator('..')).toContainText(String(doneCount));
  await expect(page.getByText('need a look').locator('..')).toContainText('1');
  await expect(page.getByText('photos', { exact: true }).locator('..')).toContainText('1');

  await expect(page.getByText('Hi Walter, all looked good today.')).toBeVisible();

  // The problem, with the tech's note and photo.
  const attention = page.getByRole('listitem').filter({ hasText: report.flagged }).first();
  await expect(attention).toContainText('Slow drip at the hot supply valve.');
  const photo = attention.getByRole('img', { name: 'Photo from the visit' });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);

  await expect(page.getByText('Fix the squeaky gate')).toBeVisible();
  await expect(page.getByText('2 × Air filter: 16x25x1')).toBeVisible();
  await expect(page.getByText('58 psi')).toBeVisible();
  await expect(page.getByText('New 9V batteries fitted.')).toBeVisible();
  await expect(page.getByText(`Your next visit is ${report.nextVisit}.`)).toBeVisible();

  // Items marked "not applicable" are left out rather than listed as done.
  await expect(page.getByText(report.skipped, { exact: true })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
});

test('shows nothing about any other customer, and no way into the staff side', async ({ page }) => {
  await page.goto(report.url);
  await expect(page.getByText(report.otherCustomer)).toHaveCount(0);
  await expect(page.getByText('Private to the other customer')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const links = await page.getByRole('link').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href') ?? ''));
  // Every link on the page is a photo; none lead to staff pages.
  expect(links.every((href) => href.includes('/storage/v1/object/sign/'))).toBe(true);
});

test('text typed by staff is shown as text, never run as code', async ({ page }) => {
  await page.goto(report.url);
  await expect(page.getByText('<script>window.__injected = true</script>')).toBeVisible();
  await expect(page.getByText('<b>Not urgent</b>')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected)).toBeUndefined();
});

test('is hidden from search engines', async ({ page }) => {
  await page.goto(report.url);
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
});

test('a wrong, altered or malformed link shows "not found"', async ({ page }) => {
  const random = randomBytes(32).toString('hex');
  const oneCharOff = report.token.slice(0, -1) + (report.token.endsWith('a') ? 'b' : 'a');
  for (const token of [random, oneCharOff, 'abc', report.token.toUpperCase(), `${report.token}0`, "' or '1'='1"]) {
    const response = await page.goto(`/r/${encodeURIComponent(token)}`);
    expect(response!.status(), token).toBe(404);
    await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();
  }
});

test('a report link is long enough that it cannot be guessed', async () => {
  const { data } = await admin.from('visits').select('report_token');
  for (const row of data ?? []) expect(row.report_token).toMatch(/^[0-9a-f]{64}$/);
  expect(new Set((data ?? []).map((row) => row.report_token)).size).toBe(data!.length);
});

test('the photo itself cannot be opened without a signed link', async ({ request }) => {
  const direct = await request.get(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${report.photoPath}`);
  expect(direct.ok()).toBe(false);
  const unsigned = await request.get(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${report.photoPath}`);
  expect(unsigned.ok()).toBe(false);
});
