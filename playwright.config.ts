import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from default ".env" file.
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests/e2e',
  /* Opt out of parallel tests — required to avoid CSRF token conflicts between
     NextAuth credential login calls that share the same dev server session. */
  workers: 1,
  /* Increase test timeout for Next.js dev compilation overhead */
  timeout: 60000,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  
  /* Increase expect timeout because Next.js dev server takes time to compile */
  expect: {
    timeout: 15000,
  },

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3002',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    // We capture screenshots on failure or explicitly in tests
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // We only need chromium as per user request
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev -- -p 3002',
    url: 'http://localhost:3002',
    reuseExistingServer: false,
    timeout: 120 * 1000, // Wait 120s for the server to start
  },
});
