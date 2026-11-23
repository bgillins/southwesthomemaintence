// ------- Runs once after the browser tests: leave the test copy empty -------
import { wipeTestData } from './db';

export default async function globalTeardown() {
  // Set KEEP_TEST_DATA=1 to look at what a run left behind.
  if (!process.env.KEEP_TEST_DATA) await wipeTestData();
}
