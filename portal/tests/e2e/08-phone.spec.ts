// ------- Is it comfortable on a phone? -------
import { expect, test } from '@playwright/test';
import { seedHome, seedVisit, staffByEmail } from '../support/db';
import { answers, expectNoSidewaysScroll, TECH, TECH_STATE } from '../support/helpers';

test.use({ storageState: TECH_STATE });

let visitId = '';
let firstItem = '';
let homeId = '';

test.beforeAll(async () => {
  const tech = (await staffByEmail(TECH))!;
  const { home } = await seedHome({ name: 'Phone Layout Customer With A Fairly Long Name', address: '12345 Extraordinarily Long Street Name Boulevard North' });
  const { visit, items } = await seedVisit(home, { techId: tech.id, status: 'in_progress' });
  homeId = home.id;
  visitId = visit.id;
  firstItem = items[0].name;
});

test('no page scrolls sideways, even with long names and addresses', async ({ page }) => {
  for (const path of ['/', '/homes', '/homes/new', `/homes/${homeId}`, `/homes/${homeId}/edit`, '/schedule', '/visits/new', `/visits/${visitId}`]) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expectNoSidewaysScroll(page);
  }
});

test('buttons are big enough to tap with a thumb', async ({ page }) => {
  await page.goto(`/visits/${visitId}`);
  for (const button of await answers(page, firstItem).getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(88);
  }
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  expect((await page.getByRole('button', { name: 'Finish visit and send report' }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

test('text boxes use 16px type, so iPhones do not zoom in when you tap them', async ({ page }) => {
  await page.goto('/homes/new');
  const sizes = await page.locator('input.input, textarea.input, select.input').evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
  expect(sizes.length).toBeGreaterThan(10);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
});

test('the progress bar stays in view while scrolling a long checklist', async ({ page }) => {
  await page.goto(`/visits/${visitId}`);
  await page.getByRole('button', { name: 'Finish visit and send report' }).scrollIntoViewIfNeeded();
  const bar = page.getByRole('progressbar', { name: 'Checklist progress' });
  await expect(bar).toBeInViewport();
});

test('the photo button opens the camera on a phone', async ({ page }) => {
  await page.goto(`/visits/${visitId}`);
  await page.getByRole('listitem').filter({ has: answers(page, firstItem) }).getByRole('button', { name: 'Add a note or photo' }).click();
  const input = page.getByRole('listitem').filter({ has: answers(page, firstItem) }).locator('input[type=file]');
  await expect(input).toHaveAttribute('capture', 'environment');
  await expect(input).toHaveAttribute('accept', 'image/*');
});

test('it can be added to the home screen as an app', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', short_name: 'SHM Portal' });
  expect((await request.get(manifest.icons[0].src)).ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('link[rel=manifest]')).toHaveCount(1);
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /width=device-width/);
});
