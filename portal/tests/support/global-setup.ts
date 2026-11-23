// ------- Runs once before the browser tests -------
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { admin, wipeTestData } from './db';
import { EMAIL_URL, TEST_NAMES } from './env.cjs';

export const TMP = join(__dirname, '..', '.tmp');

export default async function globalSetup() {
  // 1. The test database must have been built from the current migration files.
  //    If someone adds a migration and forgets the test copy, stop here and say so.
  const files = readdirSync(join(__dirname, '..', '..', 'supabase', 'migrations')).filter((file) => file.endsWith('.sql')).sort();
  const { data, error } = await admin.from('_migration_history').select('version').order('version');
  const applied = (data ?? []).map((row) => row.version as string);
  if (error || JSON.stringify(applied) !== JSON.stringify(files)) {
    throw new Error(
      `The test database (${TEST_NAMES.schema}) is missing or out of date.\n` +
        `  migrations in the repo: ${files.join(', ')}\n  applied to test copy:   ${applied.join(', ') || '(none)'}\n` +
        `Run: SUPABASE_ACCESS_TOKEN=... npm run test:db:reset${error ? `\n(${error.message})` : ''}`,
    );
  }

  // 2. Start from empty: no leftovers from an earlier run.
  await wipeTestData();
  await fetch(`${EMAIL_URL}/_outbox`, { method: 'DELETE' });

  // 3. Make the "camera" photos the tests upload. One is deliberately large
  //    (3000 x 2000) to prove the phone shrinks photos before sending.
  mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const draw = (width: number, height: number, label: string, tint: string) =>
    page.evaluate(
      ([w, h, text, color]) => {
        const canvas = document.createElement('canvas');
        canvas.width = w as number;
        canvas.height = h as number;
        const context = canvas.getContext('2d')!;
        const gradient = context.createLinearGradient(0, 0, w as number, h as number);
        gradient.addColorStop(0, color as string);
        gradient.addColorStop(1, '#f7f3e8');
        context.fillStyle = gradient;
        context.fillRect(0, 0, w as number, h as number);
        // Noise so the JPEG is a realistic size, not a tiny flat colour.
        for (let i = 0; i < 4000; i++) {
          context.fillStyle = `hsl(${(i * 37) % 360} 40% ${40 + (i % 30)}%)`;
          context.fillRect(Math.random() * (w as number), Math.random() * (h as number), 40, 40);
        }
        context.fillStyle = '#06243a';
        context.font = `bold ${Math.round((h as number) / 10)}px sans-serif`;
        context.fillText(text as string, (w as number) / 12, (h as number) / 2);
        return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      },
      [width, height, label, tint],
    );
  writeFileSync(join(TMP, 'large.jpg'), Buffer.from(await draw(3000, 2000, 'Test photo 3000x2000', '#587b0b'), 'base64'));
  writeFileSync(join(TMP, 'tall.jpg'), Buffer.from(await draw(1200, 2400, 'Tall photo', '#eca319'), 'base64'));
  await browser.close();
}
