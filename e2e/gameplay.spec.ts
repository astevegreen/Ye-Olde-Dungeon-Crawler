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

const stackIds = (page: Page) => page.evaluate(() => window.__cotwInputHandler!.modalStack.getStackIds());

async function embarkNewHero(page: Page): Promise<void> {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-new-game').click();
  // Keep every rolled attribute under 15: the first step would otherwise offer that
  // attribute's milestone choice, whose modal takes the keyboard (flaky on high rolls).
  for (const attr of ['str', 'dex', 'con', 'int']) {
    for (let i = 0; i < 6; i++) await page.locator(`#btn-dec-${attr}`).click();
  }
  await page.locator('#btn-create-embark').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine))).toBe(true);
}

test('a new hero moves, the map owns the keyboard, and save & continue restores the run', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);

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

// Save & quit and choices take keys only through the modal stack, as one entry each: a
// second window listener delivered every key twice, and the choice's stack entry let
// Escape dismiss a choice that cannot be cancelled.
test('save & quit and choices take each key once, through one modal-stack entry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);

  // Save & quit: gameplay keys are held back, one Escape closes it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-quit-modal')).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-quit']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  await page.keyboard.press('Escape');
  await expect(page.locator('#save-quit-modal')).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Offer the pack's own choices the way movement does, recording what the modal reports.
  const offer = (choiceId: string) =>
    page.evaluate((id) => {
      const w = window as unknown as { __picked: string[]; __cancelled: number };
      w.__picked = [];
      w.__cancelled = 0;
      const engine = window.__cotwEngine!;
      engine.onChoiceInteract!(
        engine.manifest!.choices![id],
        (optionId) => w.__picked.push(optionId),
        () => (w.__cancelled += 1)
      );
    }, choiceId);
  const outcome = () =>
    page.evaluate(() => {
      const w = window as unknown as { __picked: string[]; __cancelled: number };
      return { picked: w.__picked, cancelled: w.__cancelled };
    });
  const choiceOverlay = page.locator('#choice-modal-overlay');

  // The Oath climax cannot be cancelled: Escape leaves it open, a number key picks once.
  await offer('oath_hearth');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.keyboard.press('Digit2');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: ['break'], cancelled: 0 });
  expect(await stackIds(page)).toEqual([]);

  // A cancelable choice: Escape cancels it once, through the pack's onCancel.
  await offer('altar_tyr');
  await expect(choiceOverlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: [], cancelled: 1 });
  expect(await stackIds(page)).toEqual([]);

  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x, y: start.y });
  expect(pageErrors).toEqual([]);
});
