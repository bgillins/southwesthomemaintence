import { defineConfig, devices } from '@playwright/test';
import { APP_URL } from './tests/support/env.cjs';
import { webServer } from './tests/support/servers';

// ------- End-to-end tests -------
// What runs: a production build of the portal, driven by a real browser sized
// like an iPhone, against the TEST copy of the database, with a stand-in for
// Resend. Nothing here can read or change live data or send a real email.
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/.results',
  // One at a time: the tests share one database, and order keeps failures readable.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'tests/.report', open: 'never' }]],
  globalSetup: './tests/support/global-setup.ts',
  globalTeardown: './tests/support/global-teardown.ts',

  use: {
    baseURL: APP_URL,
    // Keep a screenshot and a step-by-step trace of anything that fails.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // Signs in once as an owner and once as a tech, and saves both sessions.
    { name: 'setup', testMatch: /sign-in\.setup\.ts/, use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    {
      name: 'phone',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],

  webServer,
});
