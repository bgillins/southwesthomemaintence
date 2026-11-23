// ------- Things many tests do -------
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { EMAIL_URL, testEmail } from './env.cjs';

export const OWNER = testEmail('owner');
export const TECH = testEmail('tech');
export const OWNER_STATE = join(__dirname, '..', '.auth', 'owner.json');
export const TECH_STATE = join(__dirname, '..', '.auth', 'tech.json');
export const PHOTO_LARGE = join(__dirname, '..', '.tmp', 'large.jpg');
export const PHOTO_TALL = join(__dirname, '..', '.tmp', 'tall.jpg');

export interface SentEmail {
  id: string;
  at: number;
  authorization: string | null;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

// ------- The stand-in inbox -------
export async function emailsTo(address: string): Promise<SentEmail[]> {
  const response = await fetch(`${EMAIL_URL}/_outbox?to=${encodeURIComponent(address)}`);
  return (await response.json()) as SentEmail[];
}

// Wait for an email to this address that arrived after `since`.
export async function waitForEmail(address: string, since = 0): Promise<SentEmail> {
  let found: SentEmail | undefined;
  await expect
    .poll(async () => {
      found = (await emailsTo(address)).filter((email) => email.at > since).pop();
      return Boolean(found);
    }, { message: `an email to ${address}`, timeout: 15_000 })
    .toBe(true);
  return found!;
}

export const codeFrom = (email: SentEmail) => email.subject.match(/^(\d+) is your sign-in code$/)?.[1] ?? '';
export const linkFrom = (email: SentEmail) => email.text.match(/https?:\/\/\S+\/auth\/confirm\?token_hash=\S+/)?.[0] ?? '';

// ------- Sign in the way a person does: ask for a code, read the email, type it -------
export async function requestCode(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('Sign-in code')).toBeVisible();
}

export async function signIn(page: Page, email: string) {
  const since = Date.now() - 1;
  await requestCode(page, email);
  const code = codeFrom(await waitForEmail(email, since));
  await page.getByLabel('Sign-in code').fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Hi, / })).toBeVisible();
}

// Messages the app shows in the page (Next adds its own hidden alert outside <main>).
export const alertIn = (page: Page) => page.locator('main [role=alert]');
// The green notice box (not the small "All saved" label, which is also a status).
export const statusIn = (page: Page) => page.locator('main p[role=status]');

// The three answer buttons for a checklist item.
export const answers = (page: Page, itemName: string) => page.getByRole('group', { name: `Answer for ${itemName}`, exact: true });

// The page must not scroll sideways on a phone.
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page is wider than the phone screen').toBeLessThanOrEqual(0);
}
