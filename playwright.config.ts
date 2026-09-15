import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests for the shipped single-file bundle (ARCHITECTURE.md §2, §7.1).
 * Specs load the built `dist/` output over file://, so run `npm run build` first;
 * no dev server is involved.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /* `open: 'never'` keeps a local failure from blocking on the HTML report server. */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
