// Shared Playwright helpers for the capture scripts in this folder. Labels match
// case-insensitively, so a wording or case change in the UI ("New Game" ->
// "New game") doesn't break every script at once.
import fs from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// URL=dist captures the last build (dist/index.html); the default is the dev server.
export const GAME_URL = process.env.URL === 'dist'
  ? pathToFileURL(resolve('dist/index.html')).href
  : process.env.URL ?? 'http://localhost:5173/';

// OUT overrides the output folder; the default is .prompts/captures/<name>/ (gitignored).
export function outDir(name) {
  const dir = process.env.OUT ?? `.prompts/captures/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const SIZES = { 1440: [1440, 900], 1366: [1366, 768], 1920: [1920, 1080] };

// Holds Date.now still from page load until startRun has created the hero: the title
// screen seeds its stat roll from the clock, so a pinned clock rolls the same hero every
// run. Call before page.goto.
export async function pinCreationClock(page) {
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    let pinned = true;
    Date.now = () => (pinned ? 1_700_000_000_000 : real());
    window.__unpinCaptureClock = () => { pinned = false; };
  });
}

export const button = (page, label) =>
  page.getByRole('button', { name: label instanceof RegExp ? label : new RegExp(label, 'i') });

// Title screen -> a fresh run with the default hero, ready for input.
export async function startRun(page, { opening = false } = {}) {
  await button(page, 'New game').click();
  await button(page, 'Create & Embark').click();
  await page.waitForFunction(() => !!window.__cotwEngine?.player);
  await page.evaluate(() => window.__unpinCaptureClock?.());
  if (opening) return; // stay on the controls note and the night raid
  // Past the controls note and the night raid, to the town's own spawn (e2e/newHero.ts).
  const begin = page.locator('#controls-primer-begin');
  if (await begin.isVisible()) await begin.click();
  await page.evaluate(() => {
    const e = window.__cotwEngine;
    e.diagnostics.endPrologue?.();
    const spawn = e.manifest.town?.playerSpawn;
    if (spawn) e.map.moveEntity(e.player, spawn.x, spawn.y);
    e.updateFov();
    window.__cotwRenderer?.render();
  });
  // The DOM HUD redraws after a player action: one wait brings it past the raid.
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
}
