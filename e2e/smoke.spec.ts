import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The shipped artifact is a self-contained bundle opened over file:// (ARCHITECTURE.md §2, §7.1).
// Any uncaught boot error, or a bundle that fails to load offline, keeps the main menu from appearing.
const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

test('built single-file bundle boots to the main menu over file://', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(pathToFileURL(BUNDLE).href);

  await expect(page.locator('#main-menu-screen')).toBeVisible();
  await expect(page.locator('#btn-menu-new-game')).toBeVisible();
  await expect(page.locator('#game-canvas')).toBeAttached();
  expect(pageErrors).toEqual([]);
});
