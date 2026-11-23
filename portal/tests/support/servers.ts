// ------- The two servers every browser run needs -------
// Shared by the test suite and the recorded walkthrough, so both exercise the
// same production build against the same test copy of the database.
import { APP_URL, EMAIL_URL, PORTS, TEST_NAMES, testEmail } from './env.cjs';

export const webServer = [
  // Stand-in for Resend: the app really sends, but nothing leaves this machine.
  { command: 'node tests/support/fake-resend.mjs', url: `${EMAIL_URL}/health`, reuseExistingServer: false },
  {
    command: `npx next build && npx next start -p ${PORTS.app}`,
    url: `${APP_URL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: '.next-test',
      NEXT_PUBLIC_PORTAL_SCHEMA: TEST_NAMES.schema,
      NEXT_PUBLIC_PORTAL_PHOTO_BUCKET: TEST_NAMES.bucket,
      RESEND_API_KEY: 'test-key',
      RESEND_API_URL: EMAIL_URL,
      EMAIL_FROM: 'Southwest Home Maintenance <portal@example.com>',
      EMAIL_REPLY_TO: 'office@example.com',
      APP_URL,
      PORTAL_OWNER_EMAILS: [testEmail('owner'), testEmail('owner2'), testEmail('throttle')].join(','),
    },
  },
];
