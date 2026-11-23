import path from 'node:path';
import { defineConfig } from 'vitest/config';

// ------- Fast tests of the pure logic (no browser, no database) -------
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // "server-only" throws outside Next's server. In unit tests it is a no-op.
      'server-only': path.resolve(import.meta.dirname, 'tests/support/empty.ts'),
    },
  },
});
