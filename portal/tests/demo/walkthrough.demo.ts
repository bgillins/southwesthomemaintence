// ------- The recorded walkthrough -------
// A real browser driving the real app: office sets up a member, a tech runs the
// visit on a phone, the customer opens the report. Every caption is written to
// timeline.json with its timestamp, and compose.mjs burns them into the video.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { localDate } from '@/lib/time';
import { admin } from '../support/db';
import { testEmail } from '../support/env.cjs';
import { codeFrom, waitForEmail, type SentEmail } from '../support/helpers';

const OUT = join(__dirname, 'out');
const OWNER = testEmail('owner');
const TECH = testEmail('sam');
const CUSTOMER = 'harriet.lowell@example.com';
const FAMILY = 'jordan.lowell@example.com';

// ------- A stand-in for the phone's camera -------
// Drawn, not photographed, and labelled as a sample so nobody mistakes it for a real home.
test.beforeAll(async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const scratch = await browser.newPage();
  const jpeg = await scratch.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1800;
    const c = canvas.getContext('2d')!;
    // Cabinet interior
    const wall = c.createLinearGradient(0, 0, 0, 1800);
    wall.addColorStop(0, '#3b3027');
    wall.addColorStop(1, '#1e1812');
    c.fillStyle = wall;
    c.fillRect(0, 0, 2400, 1800);
    c.fillStyle = '#6b5a48';
    c.fillRect(0, 1450, 2400, 350);
    // Drain trap
    c.strokeStyle = '#d9d9d6';
    c.lineWidth = 150;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(1150, 0);
    c.lineTo(1150, 700);
    c.arc(1400, 700, 250, Math.PI, 0, true);
    c.lineTo(1650, 520);
    c.lineTo(2400, 520);
    c.stroke();
    // Supply valve and braided line
    c.strokeStyle = '#9aa3a8';
    c.lineWidth = 46;
    c.setLineDash([26, 14]);
    c.beginPath();
    c.moveTo(620, 0);
    c.bezierCurveTo(560, 500, 760, 800, 640, 1150);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = '#b08d3c';
    c.fillRect(540, 1130, 200, 150);
    c.fillStyle = '#c0392b';
    c.beginPath();
    c.ellipse(640, 1110, 150, 44, 0, 0, Math.PI * 2);
    c.fill();
    // The drip, and the water it has left
    c.fillStyle = '#7fc4e8';
    for (const [x, y, r] of [[640, 1340, 26], [640, 1410, 20]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(127,196,232,.55)';
    c.beginPath();
    c.ellipse(650, 1500, 260, 46, 0, 0, Math.PI * 2);
    c.fill();
    // Flashlight glow
    const glow = c.createRadialGradient(700, 1250, 80, 700, 1250, 900);
    glow.addColorStop(0, 'rgba(255,244,214,.38)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 2400, 1800);
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.font = 'bold 64px sans-serif';
    c.fillText('SAMPLE PHOTO (illustration)', 80, 1740);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  writeFileSync(join(OUT, 'sample-photo.jpg'), Buffer.from(jpeg, 'base64'));
  await scratch.close();
});

test('walkthrough', async ({ page, context }) => {
  // ------- Recording helpers -------
  const started = Date.now();
  const timeline: { at: number; title: string; body: string }[] = [];
  const say = (title: string, body: string) => timeline.push({ at: (Date.now() - started) / 1000, title, body });
  const pause = (ms: number) => page.waitForTimeout(ms);

  // Show where each tap lands (the video has no finger or cursor otherwise).
  await context.addInitScript(() => {
    window.addEventListener(
      'pointerdown',
      (event) => {
        const dot = document.createElement('div');
        dot.style.cssText = `position:fixed;left:${event.clientX - 24}px;top:${event.clientY - 24}px;width:48px;height:48px;border-radius:50%;background:rgba(236,163,25,.5);border:2px solid rgba(6,36,58,.7);z-index:2147483647;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
        document.documentElement.appendChild(dot);
        requestAnimationFrame(() => {
          dot.style.transform = 'scale(1.7)';
          dot.style.opacity = '0';
        });
        setTimeout(() => dot.remove(), 500);
      },
      true,
    );
  });
  page.on('dialog', (dialog) => dialog.accept());

  const show = async (target: Locator) => {
    await target.evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await pause(650);
  };
  const tap = async (target: Locator, after = 500) => {
    await show(target);
    await target.click();
    await pause(after);
  };
  const type = async (target: Locator, text: string) => {
    await show(target);
    await target.pressSequentially(text, { delay: 28 });
    await pause(250);
  };
  const glide = async (pixels: number, seconds: number) => {
    const steps = Math.round(seconds * 30);
    for (let step = 0; step < steps; step++) {
      await page.mouse.wheel(0, pixels / steps);
      await pause(33);
    }
  };
  // Display an email the app sent, the way a phone's mail app would.
  const openEmail = async (email: SentEmail) => {
    const header = `<div style="background:#fff;border-bottom:1px solid #d9d9d9;padding:14px 18px;font-family:Helvetica,Arial,sans-serif"><div style="font-size:13px;color:#888;letter-spacing:.04em">INBOX</div><div style="font-size:18px;font-weight:700;margin-top:4px">${email.subject}</div><div style="font-size:13px;color:#555;margin-top:6px;line-height:1.5">From: ${email.from.replace(/</g, '&lt;')}<br>To: ${email.to.join(', ')}</div></div>`;
    const html = email.html
      .replace('<html>', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>')
      .replace(/<body([^>]*)>/, `<body$1>${header}`);
    await page.setContent(html);
    await pause(400);
  };

  // ------- Starting data: an owner and a technician exist; nothing else -------
  for (const [email, name, role] of [[OWNER, 'Dana Whitfield', 'owner'], [TECH, 'Sam Ortiz', 'tech']] as const) {
    const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    await admin.from('staff').upsert({ id: data.user!.id, full_name: name, email, role });
  }
  const today = localDate();

  // =====================================================================
  // PART 1: THE OFFICE
  // =====================================================================
  await page.goto('/login');
  say('Signing in', 'No passwords. Staff enter their email and get a one-time code.');
  await pause(1800);
  let since = Date.now() - 1;
  await type(page.getByLabel('Email'), OWNER);
  await tap(page.getByRole('button', { name: 'Email me a code' }), 1500);

  say('The sign-in email', 'Sent through Resend. It carries a code to type, or a one-tap link.');
  await openEmail(await waitForEmail(OWNER, since));
  await pause(3500);
  await tap(page.getByRole('link', { name: 'Or sign in with one tap' }), 1200);
  await tap(page.getByRole('button', { name: 'Sign in' }), 1500);
  await expect(page.getByRole('heading', { name: 'Hi, Dana' })).toBeVisible();

  say('The office adds a member', 'Customer, address, plan, how to get in, and what the home has.');
  await tap(page.getByRole('link', { name: 'Homes' }), 900);
  await tap(page.getByRole('link', { name: 'Add home' }), 900);
  await type(page.getByLabel('Name', { exact: true }), 'Harriet Lowell');
  await type(page.getByLabel('Phone'), '702-555-0148');
  await type(page.getByLabel('Email (reports go here)'), CUSTOMER);
  await type(page.getByLabel('Street address'), '2418 Desert Marigold Ln');
  await page.getByLabel('City').fill('Henderson');
  await type(page.getByLabel('ZIP'), '89052');
  await show(page.getByLabel('Plan'));
  await page.getByLabel('Plan').selectOption('plus');
  await pause(500);
  await type(page.getByLabel('Access notes'), 'Side gate, code 2468. Bella the dog is friendly.');
  say('Only what this home has', 'Ticking equipment here decides which tasks appear on the checklist.');
  await tap(page.getByLabel('Water softener'), 350);
  await tap(page.getByLabel('Irrigation system'), 350);
  await tap(page.getByLabel('Leak sensors'), 600);
  say('A copy for family', 'With the customer’s permission, a relative gets every report too.');
  await type(page.getByLabel('Their name'), 'Jordan (daughter)');
  await type(page.getByLabel('Their email'), FAMILY);
  await tap(page.getByLabel('The customer agreed'), 700);
  await tap(page.getByRole('button', { name: 'Add home' }), 1500);
  await expect(page.getByRole('heading', { name: 'Harriet Lowell' })).toBeVisible();

  say('The home profile', 'What to bring, the equipment record, and the customer’s own to-do list.');
  await type(page.getByLabel('New job'), 'Tighten the pantry door hinge');
  await tap(page.locator('form:has(#task-title)').getByRole('button', { name: 'Add' }), 900);
  await tap(page.getByText('Add a supply'), 500);
  await page.getByLabel('How many').fill('2');
  await type(page.getByLabel('Size or type'), '20x25x1 MERV 11');
  await type(page.getByLabel('Where it goes'), 'Hallway return');
  await tap(page.getByRole('button', { name: 'Save supply' }), 1000);
  await tap(page.getByText('Add equipment'), 500);
  await page.getByLabel('What is it').selectOption('Water heater');
  await type(page.getByLabel('Make'), 'Rheem');
  await type(page.getByLabel('Model'), 'XG50T06');
  await type(page.getByLabel('Year installed'), '2014');
  await type(page.getByLabel('Where', { exact: true }), 'Garage');
  await tap(page.getByRole('button', { name: 'Save equipment' }), 1400);

  say('Booking a visit', 'The portal builds the checklist for this plan, this visit and this home.');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(900);
  await tap(page.getByRole('link', { name: 'Schedule a visit' }), 1000);
  await page.getByLabel('Kind of visit').selectOption('maintenance');
  await page.getByLabel('Date and time').fill(`${today}T14:00`);
  await show(page.getByLabel('Technician'));
  await page.getByLabel('Technician').selectOption({ label: 'Sam Ortiz' });
  await pause(900);
  await tap(page.getByRole('button', { name: 'Schedule visit' }), 1800);
  await expect(page.getByText('Visit 1 of 6')).toBeVisible();
  await pause(1500);
  await tap(page.getByRole('button', { name: 'Sign out' }), 1200);

  // =====================================================================
  // PART 2: THE TECHNICIAN
  // =====================================================================
  say('The technician’s phone', 'Sam signs in with the code from his email.');
  since = Date.now() - 1;
  await type(page.getByLabel('Email'), TECH);
  await tap(page.getByRole('button', { name: 'Email me a code' }), 900);
  await type(page.getByLabel('Sign-in code'), codeFrom(await waitForEmail(TECH, since)));
  await tap(page.getByRole('button', { name: 'Sign in' }), 1500);
  await expect(page.getByRole('heading', { name: 'Hi, Sam' })).toBeVisible();

  say('Today', 'Sam’s visits for the day. One tap opens the job.');
  await pause(2500);
  await tap(page.getByRole('link').filter({ hasText: 'Harriet Lowell' }), 1500);

  say('Before knocking', 'Directions, how to get in, and the parts to bring.');
  await pause(3500);
  await tap(page.getByRole('button', { name: 'Start visit' }), 1500);

  say('Working the checklist', 'One tap per item. Each answer saves as it is tapped.');
  const answer = (name: string, label: string | RegExp) => page.getByRole('group', { name: `Answer for ${name}`, exact: true }).getByRole('button', { name: label });
  const names = await page.locator('[role=group]').evaluateAll((groups) => groups.map((group) => group.getAttribute('aria-label')!.replace('Answer for ', '')));
  await tap(answer(names[0], 'Done'), 800);
  await tap(answer(names[1], /Done|Looks good/), 800);
  await tap(answer(names[2], /Done|Looks good/), 800);

  const problem = 'Under every sink';
  say('Something is wrong', 'A problem needs a note and can carry a photo, straight from the camera.');
  await tap(answer(problem, 'Problem'), 900);
  await type(page.getByLabel(`Note for ${problem}`), 'Slow drip at the kitchen hot supply valve. Not urgent, but worth having a plumber look.');
  await page.getByLabel(`Note for ${problem}`).blur();
  const row = page.getByRole('listitem').filter({ has: page.getByRole('group', { name: `Answer for ${problem}`, exact: true }) });
  await row.locator('input[type=file]').setInputFiles(join(OUT, 'sample-photo.jpg'));
  await expect(row.getByRole('img', { name: 'Visit photo' })).toBeVisible();
  await show(row.getByRole('img', { name: 'Visit photo' }));
  await pause(2200);

  say('The rest of the visit', 'Shown faster here. The bar at the top tracks progress and confirms saves.');
  for (const name of names) {
    const group = page.getByRole('group', { name: `Answer for ${name}`, exact: true });
    if ((await group.getByRole('button', { pressed: true }).count()) > 0) continue;
    await group.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await group.getByRole('button').first().click();
    await pause(140);
  }
  await expect(page.getByText('All saved')).toBeVisible({ timeout: 30_000 });
  await pause(1200);

  say('Beyond the checklist', 'Their to-do list, readings, and the parts supplied on this visit.');
  await tap(page.getByLabel('Tighten the pantry door hinge'), 900);
  await type(page.getByLabel('Water pressure (psi)'), '62');
  await page.getByLabel('Water pressure (psi)').blur();
  await type(page.getByLabel('Hot water at the tap (°F)'), '121');
  await page.getByLabel('Hot water at the tap (°F)').blur();
  await tap(page.getByRole('button', { name: '+ 2 × 20x25x1 MERV 11' }), 1100);

  say('Finishing', 'The visit cannot be closed until every item is answered and every problem explained.');
  await type(page.getByLabel('Note to the customer'), 'everything looked good today. Both air filters are new. One slow drip under the kitchen sink is worth a look.');
  since = Date.now() - 1;
  await tap(page.getByRole('button', { name: 'Finish visit and send report' }), 2500);
  await expect(page.getByRole('link', { name: 'Open the customer report' })).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(3000);

  // =====================================================================
  // PART 3: THE CUSTOMER
  // =====================================================================
  const reportEmail = await waitForEmail(CUSTOMER, since);
  expect(reportEmail.to).toEqual([CUSTOMER, FAMILY]);
  // From here on there is no login at all: this is the customer's own phone.
  await context.clearCookies();
  say('The customer’s inbox', 'Harriet and her daughter both get this, moments after the visit.');
  await openEmail(reportEmail);
  await pause(4500);
  await tap(page.getByRole('link', { name: 'See the full report and photos' }), 1500);
  await expect(page.getByRole('heading', { name: 'Your home report' })).toBeVisible();

  say('The photo report', 'No login needed. The private link is the key.');
  await pause(3000);
  say('What needs attention', 'The tech’s note and photo, in plain words.');
  await glide(620, 3.5);
  await pause(2200);
  say('Everything that was done', 'Parts supplied, readings, and every item completed, by area of the home.');
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.scrollY - window.innerHeight);
  await glide(height, 11);
  await pause(2500);

  say('Checked end to end', 'Every step shown here is also covered by the automated test suite.');
  await pause(3500);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ length: (Date.now() - started) / 1000, captions: timeline }, null, 2));
});

// Kept so an unused-import check does not flag Page in editors.
export type { Page };
