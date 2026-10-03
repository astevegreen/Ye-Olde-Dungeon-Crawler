import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pastTheOpening } from './newHero';

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
  await pastTheOpening(page);
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

  // The Oath climax cannot be cancelled: Escape leaves it open. Number keys never pick
  // (number-pad movement must not choose by accident); arrows highlight, Enter picks once.
  await offer('oath_hearth');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.waitForTimeout(250); // past the modal's open debounce
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeVisible();
  expect(await stackIds(page)).toEqual(['choice']);
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Enter'); // nothing highlighted yet
  await expect(choiceOverlay).toBeVisible();
  expect(await outcome()).toEqual({ picked: [], cancelled: 0 });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: ['break'], cancelled: 0 });
  expect(await stackIds(page)).toEqual([]);

  // A cancelable choice: Escape cancels it once, through the pack's onCancel.
  await offer('altar_tyr');
  await expect(choiceOverlay).toBeVisible();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect(choiceOverlay).toBeHidden();
  expect(await outcome()).toEqual({ picked: [], cancelled: 1 });
  expect(await stackIds(page)).toEqual([]);

  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x, y: start.y });
  expect(pageErrors).toEqual([]);
});

// Save & quit's Settings, Help, and Save Code buttons open windows that must each take the
// one modal-stack entry save & quit gives up; with none, the game took their keys.
test('windows opened from save & quit each hold one stack entry and keep keys from the game', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);
  const heldBack = async () => {
    await page.keyboard.press('ArrowRight');
    expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });
  };

  // Settings, including a rebind to a key InputHandler would otherwise claim (F2 toggles
  // diagnostics), pressed right after the keybind list re-renders.
  const settings = page.locator('#settings-keybind-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-settings').click();
  await expect(settings).toBeVisible();
  expect(await stackIds(page)).toEqual(['settings']);
  await heldBack();
  await settings.locator('#settings-keybind-list button').first().click();
  await expect(page.locator('#settings-status')).toContainText('Press a key for');
  // F2 opens Diagnostics before the game reads bindings: Settings refuses it, and it
  // doesn't leak to the game either. Then V, which the game would also claim, binds.
  await page.keyboard.press('F2');
  await expect(page.locator('#settings-status')).toContainText('F2 opens Diagnostics');
  expect(await stackIds(page)).toEqual(['settings']);
  await page.keyboard.press('KeyV');
  await expect(page.locator('#settings-status')).toContainText('Moved V from "Open Radial Action Menu" to "Move North"');
  expect(await stackIds(page)).toEqual(['settings']);
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Help: the F1 help card, as on every other path to it.
  const helpCard = page.locator('#context-help-overlay');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-help').click();
  await expect(helpCard).toBeVisible();
  expect(await stackIds(page)).toEqual(['context_help']);
  await heldBack();
  await page.keyboard.press('Escape');
  await expect(helpCard).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  // Save code.
  const saveCode = page.locator('#save-code-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-copy-code').click();
  await expect(saveCode).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code']);
  await heldBack();
  await page.keyboard.press('Escape');
  await expect(saveCode).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// A save from another pack dropped onto the game in play asks first; until it is
// answered, the warning holds the keyboard, so the hero doesn't move behind it.
test('the other-pack save warning holds the keys until answered', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await embarkNewHero(page);
  const start = await state(page);

  const migrator = readFileSync(resolve(process.cwd(), 'src', 'engine', 'storage', 'migrator.ts'), 'utf8');
  const schemaVersion = Number(/CURRENT_SCHEMA_VERSION = (\d+)/.exec(migrator)![1]);
  const save = JSON.stringify({
    schemaVersion,
    contentManifestId: 'other_pack',
    timestamp: 0,
    data: { profile: { name: 'Stranger' }, player: {}, map: {} },
  });
  await page.evaluate((content) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], 'stranger.json', { type: 'application/json' }));
    document.getElementById('game-container')!.dispatchEvent(
      new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
    );
  }, save);

  const warning = page.locator('#manifest-mismatch-modal');
  await expect(warning).toBeVisible();
  expect(await stackIds(page)).toEqual(['manifest-mismatch']);
  await page.keyboard.press('ArrowRight');
  expect(await state(page)).toMatchObject({ turn: start.turn, x: start.x });

  // Escape cancels the import, as the Cancel button does, with no browser alert.
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await page.keyboard.press('Escape');
  await expect(warning).toBeHidden();
  expect(await stackIds(page)).toEqual([]);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await state(page)).x).toBe(start.x + 1);
  expect(alerts).toEqual([]);

  // The same warning from the save-code window joins the stack above it: Escape turns
  // down the import and leaves the save-code window open.
  const saveCode = page.locator('#save-code-modal');
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-copy-code').click();
  await expect(saveCode).toBeVisible();
  await page.locator('#tab-savecode-paste').click();
  await page.locator('#savecode-paste-text').fill(Buffer.from(save).toString('base64'));
  await page.locator('#btn-savecode-restore-action').click();
  await expect(warning).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code', 'manifest-mismatch']);
  await page.keyboard.press('Escape');
  await expect(warning).toBeHidden();
  await expect(saveCode).toBeVisible();
  expect(await stackIds(page)).toEqual(['save-code']);
  await page.keyboard.press('Escape');
  await expect(saveCode).toBeHidden();
  expect(await stackIds(page)).toEqual([]);

  expect(pageErrors).toEqual([]);
});

// On the main menu InputHandler is disabled, so settings takes keys only through its own
// focus-holding overlay: rebinding by keyboard and Escape must work with no game running.
test('settings on the main menu rebinds and closes by keyboard', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(pathToFileURL(BUNDLE).href);

  const settings = page.locator('#settings-keybind-modal');
  await page.locator('#btn-menu-settings').click();
  await expect(settings).toBeVisible();
  await settings.locator('#settings-keybind-list button').first().click();
  // G picks up, which the game answers before bindings: Settings refuses it, then takes ;.
  await page.keyboard.press('KeyG');
  await expect(page.locator('#settings-status')).toContainText('G picks up');
  await page.keyboard.press('Semicolon');
  await expect(page.locator('#settings-status')).toContainText('Bound ; to "Move North"');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();

  expect(pageErrors).toEqual([]);
});

// No game runs on the menus, so the hall of fame and the saga exchange take their own
// keys: Escape closes the saga exchange over the hall, then the hall.
test('the hall of fame and the saga exchange close on Escape from the menu', async ({ page }) => {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(pathToFileURL(BUNDLE).href);

  const hall = page.locator('#valhalla-modal');
  const saga = page.locator('#saga-share-modal');
  await page.locator('#btn-menu-valhalla').click();
  await expect(hall).toBeVisible();
  await page.locator('#btn-valhalla-import').click();
  await expect(saga).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(saga).toBeHidden();
  await expect(hall).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hall).toBeHidden();

  expect(pageErrors).toEqual([]);
});

// Load a saved game opens from the main menu, with InputHandler off: it takes its own keys,
// and deleting a save asks in the dialog frame, never with the browser's confirm().
test('load a saved game closes on Escape, and its delete asks in the dialog frame', async ({ page }) => {
  const pageErrors: string[] = [];
  const alerts: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await embarkNewHero(page);
  await page.keyboard.press('Escape');
  await page.locator('#btn-savequit-save-exit').click();

  const slots = page.locator('#save-slot-modal');
  const confirmBox = page.locator('#confirm-dialog');
  await page.locator('#btn-menu-load').click();
  await expect(slots).toBeVisible();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(1);

  // Escape on the question keeps the save and leaves the list open.
  await slots.locator('.btn-delete-profile').click();
  await expect(confirmBox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirmBox).toBeHidden();
  await expect(slots).toBeVisible();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(1);

  // Escape closes the list, back to the main menu.
  await page.keyboard.press('Escape');
  await expect(slots).toBeHidden();
  await expect(page.locator('#btn-menu-load')).toBeVisible();

  // Confirming deletes the save, and the list still closes on Escape after its redraw.
  await page.locator('#btn-menu-load').click();
  await slots.locator('.btn-delete-profile').click();
  await confirmBox.locator('#btn-confirm-ok').click();
  await expect(confirmBox).toBeHidden();
  await expect(slots.locator('.btn-delete-profile')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(slots).toBeHidden();

  expect(alerts).toEqual([]);
  expect(pageErrors).toEqual([]);
});
