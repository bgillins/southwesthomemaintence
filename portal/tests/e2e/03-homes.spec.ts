// ------- Customers, homes and the home profile -------
import { expect, test } from '@playwright/test';
import { admin, seedHome } from '../support/db';
import { alertIn, expectNoSidewaysScroll, TECH_STATE } from '../support/helpers';

test.use({ storageState: TECH_STATE });

const stamp = Date.now().toString(36);
const NAME = `Dolores Vance ${stamp}`;
const ADDRESS = `482 Juniper Ridge ${stamp}`;

test.describe.serial('one home, start to finish', () => {
  let homeUrl = '';

  test('the server refuses a home with no name or address', async ({ page }) => {
    await page.goto('/homes/new');
    await page.locator('main form').evaluate((form) => form.setAttribute('novalidate', ''));
    await page.getByRole('button', { name: 'Add home' }).click();
    await expect(alertIn(page)).toContainText('name');
    await page.getByLabel('Name', { exact: true }).fill(NAME);
    await page.getByRole('button', { name: 'Add home' }).click();
    await expect(alertIn(page)).toContainText('street address');
  });

  test('add a home with everything filled in', async ({ page }) => {
    await page.goto('/homes/new');
    await page.getByLabel('Name', { exact: true }).fill(NAME);
    await page.getByLabel('Phone').fill('702-555-0177');
    await page.getByLabel('Email (reports go here)').fill(`shm-e2e-dolores-${stamp}@example.com`);
    await page.getByLabel('Street address').fill(ADDRESS);
    await page.getByLabel('City').fill('Summerlin');
    await page.getByLabel('ZIP').fill('89135');
    await page.getByLabel('Plan').selectOption('plus');
    await page.getByLabel('Access notes').fill('Side gate, code 2468. Dog is friendly.');
    await page.getByLabel('Water softener').check();
    await page.getByLabel('Pool or spa').check();
    await page.getByLabel('Their name').fill('Marcus Vance');
    await page.getByLabel('Their email').fill(`shm-e2e-marcus-${stamp}@example.com`);
    await page.getByLabel('The customer agreed').check();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'Add home' }).click();

    await expect(page).toHaveURL(/\/homes\/[0-9a-f-]{36}$/);
    homeUrl = page.url();
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
    await expect(page.getByText(`${ADDRESS}, Summerlin, NV 89135`)).toBeVisible();
    await expect(page.getByText('6 visits a year')).toBeVisible();
    await expect(page.getByText('Side gate, code 2468')).toBeVisible();
    await expect(page.getByText('Report copies go to Marcus Vance.')).toBeVisible();
    await expect(page.getByText('This home has: water softener, pool or spa.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Call 702-555-0177' })).toHaveAttribute('href', 'tel:702-555-0177');

    // What was saved matches what was typed.
    const { data } = await admin.from('homes').select('plan, features, report_cc_ok, customer:customers(name, email)').eq('address', ADDRESS).single();
    expect(data).toMatchObject({ plan: 'plus', features: ['softener', 'pool'], report_cc_ok: true });
  });

  test('find it in the list by name or by address', async ({ page }) => {
    await page.goto('/homes');
    await page.getByLabel('Search by name or address').fill('dolores');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: new RegExp(NAME) })).toBeVisible();
    await page.getByLabel('Search by name or address').fill(`juniper ridge ${stamp}`);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: new RegExp(NAME) })).toBeVisible();
    await page.getByLabel('Search by name or address').fill('zzz-no-such-home');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No homes match that search.')).toBeVisible();
  });

  test('build the home profile: to-do list, supplies and equipment', async ({ page }) => {
    await page.goto(homeUrl);

    await page.getByLabel('New job').fill('Hang the hallway mirror');
    await page.locator('form:has(#task-title)').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('Hang the hallway mirror')).toBeVisible();

    await page.getByText('Add a supply').click();
    await page.getByLabel('Size or type').fill('16x25x1 MERV 11');
    await page.getByLabel('How many').fill('3');
    await page.getByLabel('Where it goes').fill('Hallway ceiling return');
    await page.getByRole('button', { name: 'Save supply' }).click();
    await expect(page.getByText('3 × 16x25x1 MERV 11')).toBeVisible();
    await expect(page.getByText('Air filter · Hallway ceiling return')).toBeVisible();

    await page.getByText('Add equipment').click();
    await page.getByLabel('What is it').selectOption('Water heater');
    await page.getByLabel('Make').fill('Rheem');
    await page.getByLabel('Model').fill('XG50T06');
    await page.getByLabel('Serial').fill('Q301512345');
    await page.getByLabel('Year installed').fill(String(new Date().getFullYear() - 11));
    await page.getByLabel('Where', { exact: true }).fill('Garage');
    await page.getByRole('button', { name: 'Save equipment' }).click();
    // Age is worked out from the install year, so old tanks stand out.
    await expect(page.getByText('(11 yr)')).toBeVisible();
    await expect(page.getByText('Rheem XG50T06 · S/N Q301512345 · Garage')).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Removing works too.
    const supplyRow = page.getByRole('listitem').filter({ hasText: '16x25x1 MERV 11' });
    await supplyRow.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('3 × 16x25x1 MERV 11')).toHaveCount(0);
  });

  test('edit the home: change plan, pause it, record a shutoff', async ({ page }) => {
    await page.goto(homeUrl);
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(NAME);
    await page.getByLabel('Plan').selectOption('premier');
    await page.getByLabel('Membership status').selectOption('paused');
    await page.getByLabel('Main water').fill('Front left of house, blue handle');
    // Untick the permission: copies must stop.
    await page.getByLabel('The customer agreed').uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(homeUrl);
    await expect(page.getByText('12 visits a year')).toBeVisible();
    await expect(page.getByText('paused', { exact: true })).toBeVisible();
    await expect(page.getByText('Front left of house, blue handle')).toBeVisible();
    await expect(page.getByText('Report copies go to')).toHaveCount(0);
  });
});

test('ticking the family-copy box without an email address does not turn copies on', async ({ page }) => {
  const name = `No Copy ${stamp}`;
  await page.goto('/homes/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Street address').fill(`9 Nocopy Way ${stamp}`);
  await page.getByLabel('The customer agreed').check();
  await page.getByRole('button', { name: 'Add home' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const { data } = await admin.from('homes').select('report_cc_ok').eq('address', `9 Nocopy Way ${stamp}`).single();
  expect(data?.report_cc_ok).toBe(false);
});

test('an address that does not exist gives "not found", not a crash', async ({ page }) => {
  const missing = await page.goto('/homes/3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b');
  expect(missing?.status()).toBe(404);
  const junk = await page.goto('/homes/not-an-id');
  expect(junk?.status()).toBe(404);
  // seedHome is used by other specs; a quick use here proves the helper itself works.
  const { home } = await seedHome();
  expect((await page.goto(`/homes/${home.id}`))?.status()).toBe(200);
});
