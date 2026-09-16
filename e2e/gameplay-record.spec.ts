import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Sustained Gameplay E2E Demo Test for Visual Verification.
 *
 * Runs the game in a continuous, active turn generation loop for a configurable
 * duration (default: 30s, or via RECORD_DURATION_MS env var).
 *
 * Force-enables video recording for this test file so developers can visually
 * review rendering, animations, lighting/FOV, and HUD state in the generated .webm.
 */

// Force video recording specifically for this recording suite
test.use({
  video: 'on',
});

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');
const RECORD_DURATION_MS = parseInt(process.env.RECORD_DURATION_MS || '30000', 10);
const ACTION_INTERVAL_MS = 200; // ~5 actions/sec for human-readable video playback

test('continuous active gameplay loop for visual verification', { tag: '@record' }, async ({ page }) => {
  // Dynamically set timeout to duration + 15s buffer for boot and teardown
  test.setTimeout(RECORD_DURATION_MS + 15000);

  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. Boot the game
  await page.goto(pathToFileURL(BUNDLE).href);
  await expect(page.locator('#main-menu-screen')).toBeVisible();

  // 2. Start a New Game
  await page.locator('#btn-menu-new-game').click();
  await expect(page.locator('#title-screen')).toBeVisible();

  // Roll stats for good starting values and embark
  await page.locator('#btn-roll-dice').click();
  await page.locator('#btn-create-embark').click();

  // 3. Confirm Canvas and HUD are mounted
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('#ground-status-bar')).toBeAttached();

  console.log(`\n▶ Starting active gameplay loop for ${RECORD_DURATION_MS / 1000}s...`);
  const endTime = Date.now() + RECORD_DURATION_MS;
  let actionCount = 0;

  // Directions and actions palette
  const moveKeys = [
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'ArrowLeft',
    'KeyW',
    'KeyD',
    'KeyS',
    'KeyA',
  ];

  // 4. Continuous Turn Generation Loop
  while (Date.now() < endTime) {
    actionCount++;

    // Periodic Modal & Interaction Checks
    if (actionCount % 45 === 0) {
      // Inventory Modal Toggle: inspect paperdoll & pack
      await page.keyboard.press('KeyI');
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    } else if (actionCount % 65 === 0) {
      // Explored Dungeon Map Overlay Toggle
      await page.keyboard.press('KeyM');
      await page.waitForTimeout(350);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    } else if (actionCount % 55 === 0) {
      // Radial Menu Hold & Selection
      await page.keyboard.down('KeyV');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      await page.keyboard.up('KeyV');
      await page.waitForTimeout(100);
    } else if (actionCount % 25 === 0) {
      // Quick Spell / Ability cast
      await page.keyboard.press('Digit1');
      await page.waitForTimeout(ACTION_INTERVAL_MS);
    } else if (actionCount % 15 === 0) {
      // Wait tick / search
      await page.keyboard.press('Space');
      await page.waitForTimeout(ACTION_INTERVAL_MS);
    } else if (actionCount % 20 === 0) {
      // Search for secret doors / traps
      await page.keyboard.press('KeyS');
      await page.waitForTimeout(ACTION_INTERVAL_MS);
    } else {
      // Cardinal movement / combat bump
      const key = moveKeys[actionCount % moveKeys.length];
      await page.keyboard.press(key);
      await page.waitForTimeout(ACTION_INTERVAL_MS);
    }
  }

  // Grace period for effect runner and renderer
  await page.waitForTimeout(500);

  console.log(`✓ Completed ${actionCount} gameplay actions across ${RECORD_DURATION_MS / 1000}s.`);
  expect(pageErrors, 'Expected zero uncaught page errors during sustained gameplay').toEqual([]);

  // Close page to ensure video is completely finalized and flushed to disk
  const video = page.video();
  await page.close();

  if (video) {
    const videoPath = await video.path();
    console.log(`🎥 Video artifact successfully written to:\n   ${videoPath}\n`);
  }
});
