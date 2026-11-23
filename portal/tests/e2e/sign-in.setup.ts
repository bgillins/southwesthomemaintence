// ------- Sign in once as each role, and keep the sessions for the other tests -------
import { expect, test as setup } from '@playwright/test';
import { staffByEmail } from '../support/db';
import { OWNER, OWNER_STATE, signIn, TECH, TECH_STATE } from '../support/helpers';

setup('the first owner gets in with an emailed code', async ({ page }) => {
  await signIn(page, OWNER);
  // PORTAL_OWNER_EMAILS made this person an owner on first sign-in.
  expect((await staffByEmail(OWNER))?.role).toBe('owner');
  await page.context().storageState({ path: OWNER_STATE });
});

setup('the owner adds a technician, who then signs in', async ({ page, browser }) => {
  await signIn(page, OWNER);
  await page.goto('/team');
  await page.getByLabel('Name').fill('Sam Ortiz');
  await page.getByLabel('Email').fill(TECH);
  await page.getByLabel('Role').selectOption('tech');
  await page.getByRole('button', { name: 'Add to team' }).click();
  await expect(page.locator('main p[role=status]')).toContainText('Added');
  expect((await staffByEmail(TECH))?.role).toBe('tech');

  const context = await browser.newContext();
  const techPage = await context.newPage();
  await signIn(techPage, TECH);
  await expect(techPage.getByRole('heading', { name: 'Hi, Sam' })).toBeVisible();
  await context.storageState({ path: TECH_STATE });
  await context.close();
});
