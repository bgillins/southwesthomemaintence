// ------- Getting in, and being kept out -------
import { expect, test } from '@playwright/test';
import { admin, staffByEmail } from '../support/db';
import { APP_URL, testEmail } from '../support/env.cjs';
import { alertIn, codeFrom, emailsTo, linkFrom, requestCode, signIn, waitForEmail } from '../support/helpers';

const OWNER2 = testEmail('owner2');
const THROTTLE = testEmail('throttle');
const STRANGER = testEmail('stranger');
const OUTSIDER = testEmail('outsider');

test.describe('without signing in', () => {
  for (const path of ['/', '/homes', '/homes/new', '/schedule', '/team', '/visits/new', '/homes/3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b', '/visits/3f2b8c1e-9d4a-4b6f-8e2a-1c3d5e7f9a0b']) {
    test(`${path} sends you to the sign-in page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Team sign in' })).toBeVisible();
    });
  }

  test('pages carry the security headers and are hidden from search engines', async ({ page }) => {
    const response = await page.goto('/login');
    const headers = response!.headers();
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('same-origin');
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('asking for a code', () => {
  test('someone who is not on the team gets no email, and the screen does not reveal that', async ({ page }) => {
    await requestCode(page, STRANGER);
    await expect(page.getByText(`If ${STRANGER} is on the team`)).toBeVisible();
    await page.waitForTimeout(2000);
    expect(await emailsTo(STRANGER)).toHaveLength(0);
    // And no login was created for them behind the scenes.
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    expect(data.users.some((user) => user.email === STRANGER)).toBe(false);
  });

  test('the sign-in email comes from us, with the code and a link back to the portal', async ({ page }) => {
    const since = Date.now() - 1;
    await requestCode(page, OWNER2);
    const email = await waitForEmail(OWNER2, since);
    expect(email.from).toBe('Southwest Home Maintenance <portal@example.com>');
    expect(email.reply_to).toBe('office@example.com');
    expect(email.to).toEqual([OWNER2]);
    expect(email.authorization).toBe('Bearer test-key');
    expect(codeFrom(email)).toMatch(/^\d{6,8}$/);
    expect(linkFrom(email)).toContain(`${APP_URL}/auth/confirm?token_hash=`);
    expect(email.html).toContain(codeFrom(email));
  });

  test('no more than 4 codes in 15 minutes for one address', async ({ page }) => {
    for (let attempt = 0; attempt < 6; attempt++) await requestCode(page, THROTTLE);
    await page.waitForTimeout(1500);
    expect(await emailsTo(THROTTLE)).toHaveLength(4);
  });
});

test.describe('signing in with the code', () => {
  test('a wrong code is refused, the right one works, and it works only once', async ({ page }) => {
    const since = Date.now() - 1;
    await requestCode(page, OWNER2);
    const code = codeFrom(await waitForEmail(OWNER2, since));

    await page.getByLabel('Sign-in code').fill(code === '00000000' ? '11111111' : '00000000');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(alertIn(page)).toContainText('That code did not work');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Sign-in code').fill(code);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: /^Hi, / })).toBeVisible();
    // First sign-in by an address in PORTAL_OWNER_EMAILS creates their owner record.
    expect(await staffByEmail(OWNER2)).toMatchObject({ role: 'owner', active: true });

    // Sign out, then try the same code again.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await requestCodeWithoutSending(page, OWNER2);
    await page.getByLabel('Sign-in code').fill(code);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(alertIn(page)).toContainText('That code did not work');
  });

  test('the one-tap link signs in after a button press, and cannot be reused', async ({ page, browser }) => {
    const since = Date.now() - 1;
    await requestCode(page, OWNER2);
    const link = linkFrom(await waitForEmail(OWNER2, since));

    // Opening the link alone must not sign anyone in (mail scanners open links).
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Almost there' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: /^Hi, / })).toBeVisible();

    const second = await browser.newContext();
    const other = await second.newPage();
    await other.goto(link);
    await other.getByRole('button', { name: 'Sign in' }).click();
    await expect(other).toHaveURL(/\/login\?expired=1$/);
    await expect(other.getByText('expired or was already used')).toBeVisible();
    await second.close();
  });
});

test('a login that exists but is not on this team sees a dead end, not data', async ({ page }) => {
  // Like a user of one of the other apps that share the same Supabase project.
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OUTSIDER });
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}`);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'No access yet' })).toBeVisible();
  for (const path of ['/', '/homes', '/schedule', '/team']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'No access yet' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
  }
  expect(await staffByEmail(OUTSIDER)).toBeNull();
});

// Reach the "enter your code" step. The 15-minute limit may mean no new email
// goes out, which is fine: these tests are about the code that was already used.
async function requestCodeWithoutSending(page: import('@playwright/test').Page, email: string) {
  await signInPageReset(page);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Sign-in code')).toBeVisible();
}
async function signInPageReset(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
}
// Imported for other specs' benefit; keeps this file's imports honest.
void signIn;
