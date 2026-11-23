// ------- Settings shared by the test tooling -------
// Written as CommonJS so both the Node scripts and the Playwright tests can load it.
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..', '..');

// Names of the test copy of the database. Never the live names.
const TEST_NAMES = {
  schema: 'shm_portal_test',
  bucket: 'shm-visit-photos-test',
  policyPrefix: 'shm_test_visit_photos_obj',
};

// Where the test build of the app and the stand-in email server listen.
const PORTS = { app: 3100, email: 3199 };
const APP_URL = `http://localhost:${PORTS.app}`;
const EMAIL_URL = `http://localhost:${PORTS.email}`;

// Every login the tests create uses this pattern, so cleanup can find them all
// and can never match a real person.
const TEST_EMAIL_PATTERN = /^shm-e2e-[a-z0-9-]+@example\.com$/;
const testEmail = (name) => `shm-e2e-${name}@example.com`;

// Read KEY=value lines from .env.local, with real environment variables on top.
function loadEnv() {
  const file = join(root, '.env.local');
  const fromFile = existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
          .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
      )
    : {};
  const env = { ...fromFile, ...process.env };
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[key]) throw new Error(`${key} is missing. Copy .env.example to .env.local and fill it in.`);
  }
  return env;
}

module.exports = { TEST_NAMES, PORTS, APP_URL, EMAIL_URL, TEST_EMAIL_PATTERN, testEmail, loadEnv };
