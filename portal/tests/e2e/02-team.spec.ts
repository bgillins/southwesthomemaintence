// ------- Owners manage who has access -------
import { expect, test } from '@playwright/test';
import { staffByEmail } from '../support/db';
import { testEmail } from '../support/env.cjs';
import { emailsTo, OWNER_STATE, requestCode, signIn, statusIn, TECH_STATE } from '../support/helpers';

const TECH2 = testEmail('tech2');

test.describe('as the owner', () => {
  test.use({ storageState: OWNER_STATE });

  test('add a technician, who can then sign in but cannot reach the Team page', async ({ page, browser }) => {
    await page.goto('/team');
    await page.getByLabel('Name').fill('Riley Chen');
    await page.getByLabel('Email').fill(TECH2);
    await page.getByLabel('Phone').fill('702-555-0142');
    await page.getByRole('button', { name: 'Add to team' }).click();
    await expect(statusIn(page)).toContainText('Added');
    await expect(page.getByRole('listitem').filter({ hasText: 'Riley Chen' })).toContainText('tech');
    expect(await staffByEmail(TECH2)).toMatchObject({ full_name: 'Riley Chen', role: 'tech', active: true });

    const context = await browser.newContext();
    const techPage = await context.newPage();
    await signIn(techPage, TECH2);
    await expect(techPage.getByRole('link', { name: 'Team' })).toHaveCount(0);
    await techPage.goto('/team');
    await expect(techPage).toHaveURL(/\/$/);
    await expect(techPage.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();

    // ------- Turning access off takes effect on their very next page -------
    await page.getByRole('listitem').filter({ hasText: 'Riley Chen' }).getByRole('button', { name: 'Turn off access' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Riley Chen' }).getByRole('button', { name: 'Turn access back on' })).toBeVisible();
    await techPage.goto('/homes');
    await expect(techPage.getByRole('heading', { name: 'No access yet' })).toBeVisible();

    // And they cannot get a new code.
    const before = (await emailsTo(TECH2)).length;
    await techPage.context().clearCookies();
    await requestCode(techPage, TECH2);
    await techPage.waitForTimeout(1500);
    expect((await emailsTo(TECH2)).length).toBe(before);

    // ------- And back on -------
    await page.getByRole('listitem').filter({ hasText: 'Riley Chen' }).getByRole('button', { name: 'Turn access back on' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Riley Chen' }).getByRole('button', { name: 'Turn off access' })).toBeVisible();
    expect((await staffByEmail(TECH2))?.active).toBe(true);
    await context.close();
  });

  test('an owner cannot switch themselves off', async ({ page }) => {
    await page.goto('/team');
    const me = page.getByRole('listitem').filter({ hasText: 'shm-e2e-owner@example.com' });
    await expect(me).toContainText('You');
    await expect(me.getByRole('button')).toHaveCount(0);
  });

  test('a bad email address is refused with a clear message', async ({ page }) => {
    await page.goto('/team');
    // Switch off the browser's own checks so the server's check is what is tested.
    await page.locator('form:has(#full_name)').evaluate((form) => form.setAttribute('novalidate', ''));
    await page.getByLabel('Name').fill('No Email');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Add to team' }).click();
    await expect(page.locator('main [role=alert]')).toContainText('valid email');
  });
});

test.describe('as a technician', () => {
  test.use({ storageState: TECH_STATE });

  test('the Team page is not offered and cannot be opened', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Today', 'Homes', 'Schedule']);
    await page.goto('/team');
    await expect(page).toHaveURL(/\/$/);
  });
});
