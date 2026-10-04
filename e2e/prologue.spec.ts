import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The opening a new hero gets, played through the shipped bundle's own keys: the controls
 * note that holds the keys until answered, the night raid with its countdown and objective,
 * the drink cue on the potion slot, a villager freed by walking into her, the hero struck
 * down instead of slain, and Hallvard's last words before the run proper.
 *
 * The raid's monsters are cleared from the page first (what they do is unit-tested), so
 * nothing but the input under test changes the hero's health.
 */

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

type Pos = { x: number; y: number };

const stackIds = (page: Page) => page.evaluate(() => window.__cotwInputHandler!.modalStack.getStackIds());
const heroAt = (page: Page) => page.evaluate(() => ({ x: window.__cotwEngine!.player.x, y: window.__cotwEngine!.player.y }));
const hp = (page: Page) => page.evaluate(() => window.__cotwEngine!.player.hp);
const flag = (page: Page, name: string) => page.evaluate((f) => window.__cotwEngine!.getWorldFlag(f), name);
const unlocked = (page: Page) => expect.poll(() => page.evaluate(() => window.__cotwInputHandler!.isInputLocked)).toBe(false);

/** Stands the hero west of `target` (the tile is free in the town's lanes) and returns the key into it. */
async function standWestOf(page: Page, target: Pos): Promise<string> {
  await page.evaluate(({ x, y }) => {
    const e = window.__cotwEngine!;
    e.map.moveEntity(e.player, x - 1, y);
    e.updateFov();
    window.__cotwRenderer?.render();
  }, target);
  await unlocked(page);
  return 'ArrowRight';
}

test.describe('the opening', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one browser plays the opening');

  test('the controls note, the raid and its cues, a villager freed, struck down, Hallvard', async ({ page }) => {
    expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto(pathToFileURL(BUNDLE).href);
    await page.locator('#btn-menu-new-game').click();
    // No roll reaches an attribute milestone (cap 16, first tier 20), so none takes the keyboard.
    await page.locator('#btn-create-embark').click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine?.player))).toBe(true);

    // The controls note comes first and holds the keys until answered.
    await expect(page.locator('#controls-primer')).toBeVisible();
    expect(await stackIds(page)).toEqual(['controls-primer']);
    const start = await heroAt(page);
    await page.keyboard.press('ArrowUp');
    expect(await heroAt(page)).toEqual(start);
    await page.keyboard.press('Enter');
    await expect(page.locator('#controls-primer')).toBeHidden();
    expect(await stackIds(page)).toEqual([]);

    // The raid: its objective and its countdown.
    await expect(page.locator('#console-objective')).toContainText('Free them before the coven is done');
    await expect(page.locator('#console-objective')).toContainText('held villager');
    await expect(page.locator('.sb-cond-name', { hasText: 'Coven’s rite' })).toBeVisible();
    await page.evaluate(() => {
      const e = window.__cotwEngine!;
      for (const m of e.map.getAllEntities()) if (m.id.startsWith('prologue-monster-')) e.removeEntity(m);
    });

    // A step, with the keys.
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => heroAt(page)).toEqual({ x: start.x, y: start.y - 1 });

    // Badly hurt: the slot of a potion that heals glows with its key until the hero drinks.
    // The starting poultice is pinned first and cures poison, so the cue skips it.
    await page.evaluate(() => window.__cotwEngine!.player.takeDamage(window.__cotwEngine!.player.hp - 3));
    await unlocked(page);
    await page.keyboard.press('Space');
    const cued = page.locator('.potion-slot.hud-cue');
    await expect(cued).toHaveCount(1);
    await expect(cued).toHaveAttribute('data-cue', /Drink/);
    const slotKey = await cued.evaluate((el) => [...el.parentElement!.children].indexOf(el) + 1);
    await page.keyboard.press(`Shift+Digit${slotKey}`);
    await expect.poll(() => hp(page)).toBeGreaterThan(3);
    await expect(page.locator('.hud-cue')).toHaveCount(0);

    // Eir, her thrall gone, is freed by walking into her; her gift lies where she stood.
    const eir = await page.evaluate(() => {
      const n = window.__cotwEngine!.map.getEntityById('prologue-eir')!;
      return { x: n.x, y: n.y };
    });
    await page.keyboard.press(await standWestOf(page, eir));
    await expect.poll(() => flag(page, 'prologue-eir_saved')).toBe(true);
    expect(await page.evaluate(({ x, y }) => window.__cotwEngine!.map.getItemsAt(x, y).length, eir)).toBeGreaterThan(0);

    // A killing blow strikes the hero down instead; the raid ends, and dawn comes.
    await page.evaluate(() => window.__cotwEngine!.player.takeDamage(999));
    await unlocked(page);
    await page.keyboard.press('Space');
    await expect.poll(() => flag(page, 'cotw_prologue_ended')).toBe(true);
    expect(await page.evaluate(() => window.__cotwEngine!.player.isAlive())).toBe(true);
    expect(await page.evaluate(() => window.__cotwEngine!.map.lit)).toBe(true);
    await expect(page.locator('#console-objective')).toContainText('Hallvard');

    // Hallvard's last words, by walking into him and closing his eyes.
    const hallvard = await page.evaluate(() => {
      const n = window.__cotwEngine!.map.getEntityById('prologue-hallvard')!;
      return { x: n.x, y: n.y };
    });
    await page.keyboard.press(await standWestOf(page, hallvard));
    const choice = page.locator('#choice-modal-overlay');
    await expect(choice).toBeVisible();
    await page.waitForTimeout(250); // past the modal's open debounce
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(choice).toBeHidden();
    await expect.poll(() => flag(page, 'cotw_prologue_gateward_heard')).toBe(true);
    expect(await page.evaluate(() => Boolean(window.__cotwEngine!.map.getEntityById('prologue-hallvard')))).toBe(false);
    await expect(page.locator('#console-objective')).toContainText('Gear up');

    expect(pageErrors).toEqual([]);
  });
});
