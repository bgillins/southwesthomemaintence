import { defineConfig, devices } from '@playwright/test';
import { APP_URL } from './tests/support/env.cjs';
import { webServer } from './tests/support/servers';

// ------- Recorded walkthrough -------
// Drives the same production build as the tests, slowly enough to watch, and
// records the screen. `npm run demo:video` then adds captions and writes an mp4.
export default defineConfig({
  testDir: './tests/demo',
  testMatch: /.*\.demo\.ts/,
  outputDir: './tests/demo/out/raw',
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  globalSetup: './tests/support/global-setup.ts',
  globalTeardown: './tests/support/global-teardown.ts',
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    baseURL: APP_URL,
    // Record at exactly the size of the page on the phone (390 x 664: the screen
    // minus the browser's own bars). The recorder does not enlarge, so a bigger
    // size here would just leave the page in one corner of the frame.
    video: { mode: 'on', size: devices['iPhone 13'].viewport },
  },
  webServer,
});
