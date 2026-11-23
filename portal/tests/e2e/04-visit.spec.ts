// ------- A visit, from the calendar to the customer's inbox -------
// This is the heart of the product. One home is followed through its first
// maintenance visit exactly as a tech would do it on a phone.
import { expect, test } from '@playwright/test';
import { checklist } from '@/data/checklist';
import { buildVisitItems } from '@/lib/plan';
import { fromLocalInput, localDate } from '@/lib/time';
import { admin, BUCKET, seedHome, seedVisit, staffByEmail } from '../support/db';
import { APP_URL } from '../support/env.cjs';
import { alertIn, answers, emailsTo, expectNoSidewaysScroll, OWNER_STATE, PHOTO_LARGE, PHOTO_TALL, statusIn, TECH, TECH_STATE, waitForEmail } from '../support/helpers';

const FEATURES = ['softener', 'irrigation'];
const today = localDate();

test.describe.serial('the first maintenance visit', () => {
  test.use({ storageState: TECH_STATE });

  let home: Awaited<ReturnType<typeof seedHome>>['home'];
  let customer: Awaited<ReturnType<typeof seedHome>>['customer'];
  let visitUrl = '';
  let visitId = '';
  const familyEmail = `shm-e2e-family-${Date.now().toString(36)}@example.com`;
  const expected = buildVisitItems({ visitType: 'maintenance', plan: 'plus', seq: 1, features: FEATURES });
  const first = expected[0].name;
  const second = expected[1].name;

  test.beforeAll(async () => {
    ({ home, customer } = await seedHome({ name: 'Harriet Lowell', plan: 'plus', features: FEATURES, ccEmail: familyEmail, ccOk: true }));
    await admin.from('home_supplies').insert({ home_id: home.id, kind: 'Air filter', spec: '20x25x1 MERV 11', qty: 2 });
    await admin.from('home_tasks').insert({ home_id: home.id, title: 'Tighten the pantry door hinge' });
  });

  test('a home with no visits starts with the Home Health Assessment', async ({ page }) => {
    await page.goto(`/visits/new?home=${home.id}`);
    await expect(page.getByLabel('Kind of visit')).toHaveValue('assessment');
    await page.getByLabel('Date and time').fill(`${today}T08:00`);
    await page.getByRole('button', { name: 'Schedule visit' }).click();
    await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Home Health Assessment').first()).toBeVisible();

    // Exactly the one-time assessment items from the website's checklist.
    const assessment = checklist.find((category) => category.id === 'assessment')!.items.map((item) => item.name);
    for (const name of assessment) await expect(answers(page, name)).toBeVisible();
    await expect(page.locator('[role=group]')).toHaveCount(assessment.length);

    // Cancel it: it must leave the calendar and not count as a visit.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByText('Reschedule, reassign or cancel').click();
    await page.getByRole('button', { name: 'Cancel this visit' }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    const { data } = await admin.from('visits').select('status').eq('home_id', home.id);
    expect(data).toEqual([{ status: 'cancelled' }]);
  });

  test('scheduling builds the right checklist for this plan, visit number and home', async ({ page }) => {
    await page.goto(`/visits/new?home=${home.id}`);
    await page.getByLabel('Kind of visit').selectOption('maintenance');
    await page.getByLabel('Date and time').fill(`${today}T14:30`);
    await page.getByRole('button', { name: 'Schedule visit' }).click();
    await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}$/);
    visitUrl = page.url();
    visitId = visitUrl.split('/').pop()!;

    await expect(page.getByText('Visit 1 of 6')).toBeVisible();
    await expect(page.getByText('at 2:30 PM')).toBeVisible();
    await expect(page.getByText('Gate code 4321')).toBeVisible();
    await expect(page.getByText('2 × 20x25x1 MERV 11')).toBeVisible();

    // The screen shows the same items, in the same order, as the planning logic.
    await expect(page.locator('[role=group]')).toHaveCount(expected.length);
    const shown = await page.locator('[role=group]').evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label')!.replace('Answer for ', '')));
    expect(shown).toEqual(expected.map((item) => item.name));
    // No pool or solar items: this home has neither. Softener and irrigation items are there.
    expect(shown.some((name) => name.startsWith('Pool') || name.startsWith('Solar'))).toBe(false);
    expect(shown).toContain('Softener salt topped off');
    expect(shown).toContain('Irrigation controller');

    const minutes = expected.reduce((total, item) => total + (item.minutes ?? 0), 0);
    await expect(page.getByText(`${expected.length} checklist items, about ${minutes} minutes of a 90-minute visit.`)).toBeVisible();

    // Saved as the right instant (2:30 PM Las Vegas, whatever the server clock says).
    const { data } = await admin.from('visits').select('scheduled_for, seq, plan, status').eq('id', visitId).single();
    expect(new Date(data!.scheduled_for).toISOString()).toBe(fromLocalInput(`${today}T14:30`).toISOString());
    expect(data).toMatchObject({ seq: 1, plan: 'plus', status: 'scheduled' });
  });

  test('the checklist is locked until the visit is started', async ({ page }) => {
    await page.goto(visitUrl);
    await expect(answers(page, first).getByRole('button', { name: 'Done' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Finish visit and send report' })).toHaveCount(0);
  });

  test('reschedule it', async ({ page }) => {
    await page.goto(visitUrl);
    await page.getByText('Reschedule, reassign or cancel').click();
    await page.getByLabel('Date and time').fill(`${today}T15:45`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('at 3:45 PM')).toBeVisible();
  });

  test('start the visit', async ({ page }) => {
    await page.goto(visitUrl);
    await page.getByRole('button', { name: 'Start visit' }).click();
    await expect(page.getByText(`0 of ${expected.length} answered`)).toBeVisible();
    await expect(page.getByText('In progress')).toBeVisible();
    const tech = await staffByEmail(TECH);
    const { data } = await admin.from('visits').select('status, started_at, tech_id').eq('id', visitId).single();
    expect(data!.status).toBe('in_progress');
    expect(data!.started_at).not.toBeNull();
    // Scheduled by this tech, so it was already theirs.
    expect(data!.tech_id).toBe(tech!.id);
  });

  test('answering saves straight away, and tapping again clears the answer', async ({ page }) => {
    await page.goto(visitUrl);
    const done = answers(page, first).getByRole('button', { name: 'Done' });
    await done.click();
    await expect(done).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(`1 of ${expected.length} answered`)).toBeVisible();
    await expect.poll(async () => (await admin.from('visit_items').select('status').eq('visit_id', visitId).eq('name', first).single()).data?.status).toBe('done');

    await done.click();
    await expect(done).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(`0 of ${expected.length} answered`)).toBeVisible();
    await expect.poll(async () => (await admin.from('visit_items').select('status').eq('visit_id', visitId).eq('name', first).single()).data?.status).toBe('pending');
  });

  test('the visit cannot be finished while items are unanswered', async ({ page }) => {
    await page.goto(visitUrl);
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Finish visit and send report' }).click();
    await expect(alertIn(page)).toContainText(`${expected.length} checklist items still need an answer`);
    expect((await admin.from('visits').select('status').eq('id', visitId).single()).data?.status).toBe('in_progress');
  });

  test('a problem must be explained before the visit can be finished', async ({ page }) => {
    await page.goto(visitUrl);
    page.on('dialog', (dialog) => dialog.accept());
    await answers(page, first).getByRole('button', { name: 'Problem' }).click();
    await answers(page, second).getByRole('button', { name: 'N/A' }).click();
    for (const item of expected.slice(2)) await answers(page, item.name).getByRole('button').first().click();
    await expect(page.getByText(`${expected.length} of ${expected.length} answered`)).toBeVisible();
    await expect(page.getByText('1 to flag')).toBeVisible();
    // The label only says "All saved" once every answer has reached the database.
    await expect(page.getByText('All saved')).toBeVisible({ timeout: 30_000 });
    expect((await admin.from('visit_items').select('id', { count: 'exact', head: true }).eq('visit_id', visitId).eq('status', 'pending')).count).toBe(0);

    await page.getByRole('button', { name: 'Finish visit and send report' }).click();
    await expect(alertIn(page)).toContainText(`Add a note for “${first}”`);

    await page.getByLabel(`Note for ${first}`).fill('The filter slot is bent, so the new filter does not seat fully.');
    await page.getByLabel(`Note for ${first}`).blur();
    await expect.poll(async () => (await admin.from('visit_items').select('note').eq('visit_id', visitId).eq('name', first).single()).data?.note).toContain('filter slot is bent');
  });

  test('a photo is shrunk on the phone, uploaded, shown, and can be deleted', async ({ page }) => {
    await page.goto(visitUrl);
    const row = page.getByRole('listitem').filter({ has: answers(page, first) });

    // ------- A 3000 x 2000 "camera" photo -------
    await row.locator('input[type=file]').setInputFiles(PHOTO_LARGE);
    const thumb = row.getByRole('img', { name: 'Visit photo' });
    await expect(thumb).toHaveCount(1);
    await expect.poll(() => thumb.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const { data: photos } = await admin.from('visit_photos').select('*').eq('visit_id', visitId);
    expect(photos).toHaveLength(1);
    // Long edge capped at 1600, shape kept.
    expect(photos![0]).toMatchObject({ width: 1600, height: 1067 });
    expect(photos![0].storage_path.startsWith(`${visitId}/`)).toBe(true);
    const { data: file } = await admin.storage.from(BUCKET).download(photos![0].storage_path);
    expect(file!.type).toBe('image/jpeg');
    expect(file!.size).toBeLessThan(1_500_000);

    // ------- A second, portrait photo, then delete it -------
    await row.locator('input[type=file]').setInputFiles(PHOTO_TALL);
    await expect(thumb).toHaveCount(2);
    const { data: two } = await admin.from('visit_photos').select('*').eq('visit_id', visitId).order('created_at');
    expect(two![1]).toMatchObject({ width: 800, height: 1600 });

    await row.getByRole('button', { name: 'Delete photo' }).nth(1).click();
    await expect(thumb).toHaveCount(1);
    await expect.poll(async () => (await admin.from('visit_photos').select('id').eq('visit_id', visitId)).data?.length).toBe(1);
    // The file itself is gone from storage, not just the record.
    const { data: gone } = await admin.storage.from(BUCKET).download(two![1].storage_path);
    expect(gone).toBeNull();
  });

  test('readings, parts and the to-do list', async ({ page }) => {
    await page.goto(visitUrl);

    await page.getByLabel('Water pressure (psi)').fill('62');
    await page.getByLabel('Water pressure (psi)').blur();
    await page.getByLabel('Hot water at the tap (°F)').fill('121.5');
    await page.getByLabel('Hot water at the tap (°F)').blur();
    await expect.poll(async () => (await admin.from('visit_readings').select('key, value').eq('visit_id', visitId).order('key')).data).toEqual([
      { key: 'hot_water_temp', value: 121.5 },
      { key: 'water_pressure', value: 62 },
    ]);

    // One tap adds the home's usual filter; anything else can be typed.
    await page.getByRole('button', { name: '+ 2 × 20x25x1 MERV 11' }).click();
    await expect(page.getByText('2 × Air filter: 20x25x1 MERV 11')).toBeVisible();
    await page.getByLabel('Part').fill('9V battery');
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Add', exact: true }).last().click();
    await expect(page.getByText('3 × 9V battery')).toBeVisible();
    await page.getByLabel('Part').fill('Mistake');
    await page.getByRole('button', { name: 'Add', exact: true }).last().click();
    await page.getByRole('listitem').filter({ hasText: '1 × Mistake' }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('1 × Mistake')).toHaveCount(0);

    await page.getByLabel('Tighten the pantry door hinge').check();
    await page.getByLabel('Add a job').fill('Replace the porch light bulb');
    await page.locator('form:has(#new-task)').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByLabel('Replace the porch light bulb')).toBeVisible();
    await expect.poll(async () => (await admin.from('home_tasks').select('status, done_visit_id').eq('home_id', home.id).eq('title', 'Tighten the pantry door hinge').single()).data).toEqual({ status: 'done', done_visit_id: visitId });
    await expectNoSidewaysScroll(page);
  });

  test('nothing is lost when the page is reloaded mid-visit', async ({ page }) => {
    await page.goto(visitUrl);
    await expect(page.getByText(`${expected.length} of ${expected.length} answered`)).toBeVisible();
    await expect(answers(page, first).getByRole('button', { name: 'Problem' })).toHaveAttribute('aria-pressed', 'true');
    await expect(answers(page, second).getByRole('button', { name: 'N/A' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel(`Note for ${first}`)).toHaveValue(/filter slot is bent/);
    await expect(page.getByLabel('Water pressure (psi)')).toHaveValue('62');
    await expect(page.getByText('3 × 9V battery')).toBeVisible();
    await expect(page.getByLabel('Tighten the pantry door hinge')).toBeChecked();
    await expect(page.getByRole('img', { name: 'Visit photo' })).toHaveCount(1);
  });

  test('finishing emails the report to the customer and the family member', async ({ page }) => {
    await page.goto(visitUrl);
    page.on('dialog', (dialog) => dialog.accept());
    const since = Date.now() - 1;
    await page.getByLabel('Note to the customer').fill('everything went smoothly. One thing to look at on the air filter slot.');
    await page.getByRole('button', { name: 'Finish visit and send report' }).click();

    await expect(statusIn(page)).toContainText(`Report emailed to ${customer.email} and ${familyEmail}.`);
    await expect(page.getByRole('link', { name: 'Open the customer report' })).toBeVisible();
    await expect(page.getByText('Report emailed.')).toBeVisible();

    const { data: visit } = await admin.from('visits').select('status, completed_at, report_sent_at, report_token, summary').eq('id', visitId).single();
    expect(visit!.status).toBe('completed');
    expect(visit!.completed_at).not.toBeNull();
    expect(visit!.report_sent_at).not.toBeNull();

    // One email, addressed to both, linking to this visit's report.
    const email = await waitForEmail(customer.email, since);
    expect(email.to).toEqual([customer.email, familyEmail]);
    expect(email.subject).toMatch(/^Your home report for /);
    expect(email.text).toContain('Hi Harriet,');
    expect(email.text).toContain(`${APP_URL}/r/${visit!.report_token}`);
    expect(email.text).toContain(`${expected.length - 2} checklist items completed`);
    expect(email.text).toContain(`- ${first}`);
    expect(email.text).toContain('everything went smoothly');
    expect(await emailsTo(customer.email)).toHaveLength(1);

    const { data: log } = await admin.from('message_log').select('recipient, status').eq('visit_id', visitId).order('recipient');
    expect(log).toEqual([{ recipient: customer.email, status: 'sent' }, { recipient: familyEmail, status: 'sent' }].sort((a, b) => a.recipient.localeCompare(b.recipient)));
  });

  test('a finished visit is locked, and a tech cannot reopen it', async ({ page }) => {
    await page.goto(visitUrl);
    await expect(answers(page, first).getByRole('button', { name: 'Problem' })).toBeDisabled();
    await expect(page.getByLabel(`Note for ${first}`)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete photo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Finish visit and send report' })).toHaveCount(0);
    await expect(page.getByText('Reopen to fix something')).toHaveCount(0);
  });

  test('the next visit is visit 2, with its own checklist (the cancelled one does not count)', async ({ page }) => {
    await page.goto(`/visits/new?home=${home.id}`);
    await expect(page.getByLabel('Kind of visit')).toHaveValue('maintenance');
    await page.getByLabel('Date and time').fill(`${today}T16:00`);
    await page.getByRole('button', { name: 'Schedule visit' }).click();
    await expect(page.getByText('Visit 2 of 6')).toBeVisible();
    const next = buildVisitItems({ visitType: 'maintenance', plan: 'plus', seq: 2, features: FEATURES });
    const shown = await page.locator('[role=group]').evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label')!.replace('Answer for ', '')));
    expect(shown).toEqual(next.map((item) => item.name));
    expect(shown).not.toEqual(expected.map((item) => item.name));
    // The job added during the last visit is waiting on this one.
    await expect(page.getByText('Replace the porch light bulb')).toBeVisible();
  });
});

// ------- What happens around the edges of finishing a visit -------
test.describe('finishing a visit', () => {
  test.use({ storageState: TECH_STATE });

  async function finish(page: import('@playwright/test').Page, visitId: string) {
    await page.goto(`/visits/${visitId}`);
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Finish visit and send report' }).click();
  }

  test('with no customer email, the visit still saves and the tech is told to share the link', async ({ page }) => {
    const { home } = await seedHome({ email: null });
    const { visit } = await seedVisit(home, { status: 'in_progress', answers: 'done' });
    await finish(page, visit.id);
    await expect(statusIn(page)).toContainText('No email on file');
    await expect(page.getByText('Report not emailed yet.')).toBeVisible();
    expect((await admin.from('visits').select('status').eq('id', visit.id).single()).data?.status).toBe('completed');
  });

  test('if the email is rejected, the visit still saves, the failure is shown, and it can be sent again', async ({ page }) => {
    const address = `shm-e2e-bounce-${Date.now().toString(36)}@example.com`;
    const { home, customer } = await seedHome({ email: address });
    const { visit } = await seedVisit(home, { status: 'in_progress', answers: 'done' });
    await finish(page, visit.id);
    await expect(statusIn(page)).toContainText('the report email failed: Recipient address was rejected');
    await expect(page.getByText('Report not emailed yet.')).toBeVisible();
    const { data } = await admin.from('visits').select('status, report_sent_at').eq('id', visit.id).single();
    expect(data).toEqual({ status: 'completed', report_sent_at: null });
    expect((await admin.from('message_log').select('status, error').eq('visit_id', visit.id).single()).data).toMatchObject({ status: 'failed' });

    // The office fixes the address, then the tech sends it again.
    const fixed = address.replace('bounce', 'fixed');
    await admin.from('customers').update({ email: fixed }).eq('id', customer.id);
    await page.getByRole('button', { name: 'Email it again' }).click();
    await expect(statusIn(page)).toContainText(`Report emailed to ${fixed}.`);
    expect(await emailsTo(fixed)).toHaveLength(1);
  });

  test('with no signal, an answer is not shown as saved, and works again once back online', async ({ page, context }) => {
    const { home } = await seedHome();
    const { visit, items } = await seedVisit(home, { status: 'in_progress' });
    const name = items[0].name;
    await page.goto(`/visits/${visit.id}`);
    const done = answers(page, name).getByRole('button').first();
    await expect(page.getByText('All saved')).toBeVisible();

    // ------- Lose the connection, then tap -------
    await context.setOffline(true);
    await done.click();
    await expect(alertIn(page)).toContainText('Not saved: no connection');
    // The tap is undone on screen: it does not pretend.
    await expect(done).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(`0 of ${items.length} answered`)).toBeVisible();
    expect((await admin.from('visit_items').select('status').eq('id', items[0].id).single()).data?.status).toBe('pending');

    // ------- Signal returns -------
    await context.setOffline(false);
    await done.click();
    await expect(done).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('All saved')).toBeVisible();
    await expect.poll(async () => (await admin.from('visit_items').select('status').eq('id', items[0].id).single()).data?.status).toBe('done');
  });

  test('answers given while another answer is failing are not wiped out', async ({ page, context }) => {
    const { home } = await seedHome();
    const { visit, items } = await seedVisit(home, { status: 'in_progress' });
    await page.goto(`/visits/${visit.id}`);
    const first = answers(page, items[0].name).getByRole('button').first();
    const second = answers(page, items[1].name).getByRole('button').first();

    await first.click();
    await expect.poll(async () => (await admin.from('visit_items').select('status').eq('id', items[0].id).single()).data?.status).toBe('done');
    await context.setOffline(true);
    await second.click();
    await expect(alertIn(page)).toContainText('Not saved');
    await context.setOffline(false);
    // The failed one is undone; the earlier, saved one is untouched.
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  test('the family member gets no copy unless the customer agreed', async ({ page }) => {
    const family = `shm-e2e-nocopy-${Date.now().toString(36)}@example.com`;
    const { home, customer } = await seedHome({ ccEmail: family, ccOk: false });
    const { visit } = await seedVisit(home, { status: 'in_progress', answers: 'done' });
    await finish(page, visit.id);
    await expect(statusIn(page)).toContainText(`Report emailed to ${customer.email}.`);
    expect(await emailsTo(family)).toHaveLength(0);
  });
});

test.describe('fixing a finished visit', () => {
  test.use({ storageState: OWNER_STATE });

  test('an owner can reopen a visit, correct it, and finish it again', async ({ page }) => {
    const { home } = await seedHome();
    const { visit, items } = await seedVisit(home, { status: 'completed', answers: 'done', summary: 'First version.' });
    await page.goto(`/visits/${visit.id}`);
    await page.getByRole('button', { name: 'Reopen to fix something' }).click();
    await expect(page.getByText('In progress')).toBeVisible();

    // While it is being corrected, the customer's link shows a holding message.
    await page.goto(`/r/${visit.report_token}`);
    await expect(page.getByRole('heading', { name: 'This report is being updated' })).toBeVisible();

    await page.goto(`/visits/${visit.id}`);
    page.on('dialog', (dialog) => dialog.accept());
    await answers(page, items[0].name).getByRole('button', { name: 'N/A' }).click();
    await page.getByRole('button', { name: 'Finish visit and send report' }).click();
    await expect(page.getByRole('link', { name: 'Open the customer report' })).toBeVisible();
    // Same link as before, now showing the corrected report.
    await expect(page.getByRole('link', { name: 'Open the customer report' })).toHaveAttribute('href', `/r/${visit.report_token}`);
  });
});
