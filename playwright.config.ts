import { defineConfig, devices } from '@playwright/test';

// Support custom `--video` command-line flag (e.g. `npx playwright test -- --video` or `npm run test:e2e -- --video`).
// Supports `--video`, `--video=on`, `--video=retain-on-failure`, `--video=on-first-retry`, and VIDEO env var.
const videoArg = process.argv.find((arg) => arg === '--video' || arg.startsWith('--video='));
if (videoArg) {
  process.env.VIDEO = videoArg.startsWith('--video=') ? videoArg.split('=')[1] || 'on' : 'on';
}
const recordVideoMode = process.env.VIDEO as
  | 'off'
  | 'on'
  | 'retain-on-failure'
  | 'on-first-retry'
  | undefined;
const recordVideo: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry' =
  recordVideoMode === 'true' ? 'on' : recordVideoMode || 'off';
if (recordVideo !== 'off') {
  console.log(`[playwright.config.ts] Video recording ENABLED (video: "${recordVideo}")`);
}

// Separate sustained recording demo tests and campaign flow from standard CI smoke test runs
const isRecordingRun =
  process.argv.some((arg) => arg.includes('gameplay-record') || arg.includes('@record')) ||
  !!process.env.RECORD_DURATION_MS;

const isCampaignRun =
  process.argv.some((arg) => arg.includes('campaign-flow') || arg.includes('@campaign')) ||
  !!process.env.CAMPAIGN_RUN;

const isSoakRun =
  process.argv.some((arg) => arg.includes('soak') || arg.includes('@soak')) ||
  process.env.SOAK === '1';

/**
 * End-to-end smoke tests for the shipped single-file bundle (ARCHITECTURE.md §2, §7.1).
 * Specs load the built `dist/` output over file://, so run `npm run build` first;
 * no dev server is involved.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: [
    ...(isRecordingRun ? [] : ['**/gameplay-record.spec.ts']),
    ...(isCampaignRun ? [] : ['**/campaign-flow.spec.ts']),
    ...(isSoakRun ? [] : ['**/soak.spec.ts']),
  ],
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* Locally, a quarter of the logical cores (5 on the owner's 20). Playwright's default,
     half, timed out a Firefox test in 1 of 3 full runs on an idle machine; 25% passed 4 of 4,
     and faster (38-40 s against 46-53 s). */
  workers: process.env.CI ? 1 : '25%',
  /* `open: 'never'` keeps a local failure from blocking on the HTML report server. */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    video: recordVideo,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
