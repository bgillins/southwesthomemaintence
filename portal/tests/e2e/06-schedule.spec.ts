// ------- Today and Schedule: the right visits, for the right person, on the right day -------
import { expect, test } from '@playwright/test';
import { addDays, formatLongDay, fromLocalInput, localDate } from '@/lib/time';
import { seedHome, seedVisit, staffByEmail } from '../support/db';
import { testEmail } from '../support/env.cjs';
import { expectNoSidewaysScroll, OWNER, OWNER_STATE, TECH, TECH_STATE } from '../support/helpers';

const today = localDate();
const stamp = Date.now().toString(36);
const names = {
  mine: `Mine Today ${stamp}`,
  theirs: `Owners Today ${stamp}`,
  open: `Unassigned Today ${stamp}`,
  overdue: `Overdue Yesterday ${stamp}`,
  stale: `Started Yesterday ${stamp}`,
  soon: `In Three Days ${stamp}`,
  far: `In Thirty Days ${stamp}`,
  done: `Finished ${stamp}`,
  cancelled: `Cancelled ${stamp}`,
};

test.beforeAll(async () => {
  const tech = (await staffByEmail(TECH))!;
  const owner = (await staffByEmail(OWNER))!;
  const add = async (name: string, options: Parameters<typeof seedVisit>[1]) => seedVisit((await seedHome({ name })).home, options);
  await add(names.mine, { techId: tech.id, when: `${today}T09:15` });
  await add(names.theirs, { techId: owner.id, when: `${today}T11:00` });
  await add(names.open, { techId: null, when: `${today}T13:30` });
  await add(names.overdue, { techId: tech.id, when: `${addDays(today, -1)}T10:00` });
  await add(names.stale, { techId: tech.id, when: `${addDays(today, -1)}T15:00`, status: 'in_progress' });
  await add(names.soon, { techId: tech.id, when: `${addDays(today, 3)}T08:00` });
  await add(names.far, { techId: tech.id, when: `${addDays(today, 30)}T08:00` });
  await add(names.done, { techId: tech.id, when: `${today}T07:00`, status: 'completed', answers: 'done' });
  await add(names.cancelled, { techId: tech.id, when: `${today}T12:00`, status: 'cancelled' });
});

const card = (page: import('@playwright/test').Page, name: string) => page.getByRole('link').filter({ hasText: name });
const section = (page: import('@playwright/test').Page, heading: string) => page.locator('section').filter({ has: page.getByRole('heading', { name: heading }) });

test.describe('a technician', () => {
  test.use({ storageState: TECH_STATE });

  test('Today shows their visits and unassigned ones, at Las Vegas times', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(formatLongDay(new Date()))).toBeVisible();
    const todays = section(page, 'Today’s visits');
    await expect(card(todays as never, names.mine)).toContainText('9:15 AM');
    await expect(card(todays as never, names.open)).toContainText('1:30 PM');
    await expect(card(todays as never, names.open)).toContainText('Unassigned');
    await expect(card(todays as never, names.done)).toContainText('Completed');

    // Not theirs, cancelled, or on another day.
    await expect(card(page, names.theirs)).toHaveCount(0);
    await expect(card(page, names.cancelled)).toHaveCount(0);
    await expect(card(todays as never, names.soon)).toHaveCount(0);

    // A visit started yesterday and never finished is put at the top.
    await expect(card(section(page, 'Still open from earlier') as never, names.stale)).toBeVisible();
    // The week ahead, but not next month.
    await expect(card(section(page, 'Next 7 days') as never, names.soon)).toBeVisible();
    await expect(card(page, names.far)).toHaveCount(0);
    await expectNoSidewaysScroll(page);
  });

  test('"Everyone’s" shows the whole team’s day', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Everyone’s' }).click();
    await expect(card(page, names.theirs)).toContainText('11:00 AM');
    await expect(card(page, names.mine)).toBeVisible();
  });

  test('tapping a visit opens it', async ({ page }) => {
    await page.goto('/');
    await card(page, names.mine).click();
    await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: names.mine })).toBeVisible();
  });

  test('Schedule groups by day, flags overdue visits, and lists recent reports', async ({ page }) => {
    await page.goto('/schedule');
    const overdue = section(page, 'Overdue');
    await expect(card(overdue as never, names.overdue)).toBeVisible();
    await expect(card(overdue as never, names.stale)).toBeVisible();

    const soonDay = formatLongDay(fromLocalInput(`${addDays(today, 3)}T08:00`));
    await expect(card(section(page, soonDay) as never, names.soon)).toContainText('8:00 AM');
    await expect(card(section(page, formatLongDay(fromLocalInput(`${today}T09:15`))) as never, names.mine)).toBeVisible();
    await expect(card(page, names.far)).toBeVisible();
    await expect(card(section(page, 'Recently completed') as never, names.done)).toBeVisible();
    await expect(card(page, names.cancelled)).toHaveCount(0);
    await expectNoSidewaysScroll(page);
  });
});

test.describe('an owner', () => {
  test.use({ storageState: OWNER_STATE });

  test('sees everyone’s visits by default, and can narrow to their own', async ({ page }) => {
    await page.goto('/');
    await expect(card(page, names.mine)).toBeVisible();
    await expect(card(page, names.theirs)).toBeVisible();
    await page.getByRole('link', { name: 'Only mine' }).click();
    await expect(card(page, names.theirs)).toBeVisible();
    await expect(card(page, names.mine)).toHaveCount(0);
    await expect(card(page, names.open)).toBeVisible();
  });

  test('can hand a visit to someone else', async ({ page }) => {
    const { home } = await seedHome({ name: `Reassign Me ${stamp}` });
    const { visit } = await seedVisit(home, { techId: null, when: `${addDays(today, 2)}T10:00` });
    await page.goto(`/visits/${visit.id}`);
    await expect(page.getByText('· Unassigned')).toBeVisible();
    await page.getByText('Reschedule, reassign or cancel').click();
    await page.getByLabel('Technician').selectOption({ label: 'Sam Ortiz' });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('· Sam Ortiz')).toBeVisible();
    void testEmail;
  });
});
