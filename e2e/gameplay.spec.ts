import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Plays the shipped bundle, not the source: minification and bundling have broken
// behavior that every unit test passed (class names hooks match on, input routing).
const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

const state = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine!;
    return { turn: e.turnCount, x: e.player.x, y: e.player.y, lastAction: e.lastActionName };
  });

test('a new hero moves, the map owns the keyboard, and save & continue restores the run', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-new-game').click();
  // Keep every rolled attribute under 15: the first step would otherwise offer that
  // attribute's milestone choice, whose modal takes the keyboard (flaky on high rolls).
  for (const attr of ['str', 'dex', 'con', 'int']) {
    for (let i = 0; i < 6; i++) await page.locator(`#btn-dec-${attr}`).click();
  }
  await page.locator('#btn-create-embark').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine))).toBe(true);

  // Moving spends a turn, and the pipeline sees the real class name (esbuild keepNames).
  const start = await state(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(page)).turn).toBeGreaterThan(start.turn);
  const moved = await state(page);
  expect(moved.x).toBe(start.x + 1);
  expect(moved.lastAction).toBe('MovementAction');

  // With the map open, movement keys don't reach the simulation, and Escape closes the map.
  await page.keyboard.press('KeyM');
  await expect.poll(() => page.evaluate(() => window.__cotwRenderer?.mapOverlay.isOpen)).toBe(true);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: moved.turn, x: moved.x });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__cotwRenderer?.mapOverlay.isOpen)).toBe(false);
  await expect(page.locator('#save-quit-modal')).toBeHidden();

  // Save & exit, then Continue resumes exactly where the hero stood.
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-save-exit').click();
  await expect(page.locator('#btn-menu-continue')).toBeEnabled();
  await page.locator('#btn-menu-continue').click();
  await expect.poll(async () => (await state(page)).turn).toBe(moved.turn);
  expect(await state(page)).toMatchObject({ x: moved.x, y: moved.y });

  expect(pageErrors).toEqual([]);
});
