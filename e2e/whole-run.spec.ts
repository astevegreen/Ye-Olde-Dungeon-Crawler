import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pastTheOpening } from './newHero';

/**
 * A whole run, played fast through the shipped bundle's own keys and clicks: a shop buy,
 * a pact sealed with the pact keeper, the stairs, a level-up spent on the Character tab, a
 * spell through the aim reticle, an altar rite, save and continue, and the slain ending
 * through its portal; then a second run for the driven-off ending, and a third that dies
 * and finds its hero in the hall.
 *
 * Where getting somewhere would take hundreds of turns the test sets the scene from the
 * page (the F2 triage API: god mode, floor jumps, levels, kills; or standing the hero next
 * to what it is about to use). The thing under test is then always done with real input.
 * One browser plays it; the rest of the suite covers the others.
 */

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');
/** Point at a dev server while working on this test: WHOLE_RUN_URL=http://localhost:5173/ */
const URL = process.env.WHOLE_RUN_URL ?? pathToFileURL(BUNDLE).href;

type Pos = { x: number; y: number };

const engineState = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine!;
    const p = e.player;
    return {
      floor: e.currentFloor,
      turn: e.turnCount,
      x: p.x,
      y: p.y,
      hp: p.hp,
      mana: p.mana,
      level: p.level,
      str: p.strength,
      unspent: p.unspentStatPoints ?? 0,
      spells: [...p.spellsKnown],
      pacts: e.pacts.getActivePacts().map((pact) => pact.id),
      carried: p.inventory.getAllCarriedItems().length,
    };
  });

const stackIds = (page: Page) => page.evaluate(() => window.__cotwInputHandler!.modalStack.getStackIds());
const messageCount = (page: Page) => page.evaluate(() => window.__cotwEngine!.messages.length);
/** Every log line since `from` (a messageCount taken earlier). */
const messagesSince = (page: Page, from: number) => page.evaluate((k) => window.__cotwEngine!.messages.slice(k).join('\n'), from);

async function embark(page: Page): Promise<void> {
  if (!process.env.WHOLE_RUN_URL) expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  await page.goto(URL);
  await page.locator('#btn-menu-new-game').click();
  // No roll reaches an attribute milestone (cap 16, first tier 20), so none takes the keyboard mid-run.
  await page.locator('#btn-create-embark').click();
  await pastTheOpening(page);
}

/**
 * Presses `key` until `done` holds. Right after a load, or while an effect plays, the
 * game can let a key go by (§4: tactical effects lock input); the player would press again.
 */
async function pressUntil(page: Page, key: string, done: () => Promise<boolean>): Promise<void> {
  await expect(async () => {
    if (!(await done())) await page.keyboard.press(key);
    expect(await done()).toBe(true);
  }).toPass({ timeout: 10_000, intervals: [250] });
}

/** Runs triage calls from the page, then redraws (F2 is a player-reachable menu, §2). */
async function triage(page: Page, fn: string, ...args: unknown[]): Promise<void> {
  await page.evaluate(
    async ({ fn, args }) => {
      const d = window.__cotwEngine!.diagnostics as unknown as Record<string, (...a: unknown[]) => unknown>;
      d[fn](...args);
      await new Promise((r) => setTimeout(r, 150));
      window.__cotwRenderer?.render();
    },
    { fn, args }
  );
}

/**
 * Stands the hero on a free tile next to `target` and returns the key that steps into it.
 * Diagonal neighbours come last, so the key is a plain arrow when it can be.
 */
async function standBeside(page: Page, target: Pos): Promise<string> {
  const dir = await page.evaluate(({ x, y }) => {
    const e = window.__cotwEngine!;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const sx = x + dx;
      const sy = y + dy;
      if (!e.map.isPassable(sx, sy) || e.map.getEntityAt(sx, sy)) continue;
      e.map.moveEntity(e.player, sx, sy);
      e.updateFov();
      window.__cotwRenderer?.render();
      return [-dx, -dy];
    }
    return null;
  }, target);
  expect(dir, `no free tile beside ${target.x},${target.y}`).not.toBeNull();
  // An effect still playing locks the keys (§4); the step would be lost.
  await expect.poll(() => page.evaluate(() => window.__cotwInputHandler!.isInputLocked)).toBe(false);
  const keys: Record<string, string> = {
    '0,1': 'ArrowDown', '0,-1': 'ArrowUp', '1,0': 'ArrowRight', '-1,0': 'ArrowLeft',
    '1,1': 'Numpad3', '-1,1': 'Numpad1', '1,-1': 'Numpad9', '-1,-1': 'Numpad7',
  };
  return keys[`${dir![0]},${dir![1]}`];
}

const findTile = (page: Page, test: { type?: string; handler?: string }) =>
  page.evaluate(({ type, handler }) => {
    const e = window.__cotwEngine!;
    for (let y = 0; y < e.map.height; y++) {
      for (let x = 0; x < e.map.width; x++) {
        const t = e.map.getTile(x, y);
        if ((type && t?.type === type) || (handler && t?.interactionHandlerId === handler)) return { x, y };
      }
    }
    return null;
  }, test);

const findEntity = (page: Page, test: { id?: string; definitionId?: string }) =>
  page.evaluate(({ id, definitionId }) => {
    const m = window.__cotwEngine!.map
      .getAllEntities()
      .find((x) => (id && x.id === id) || (definitionId && (x as { definitionId?: string }).definitionId === definitionId));
    return m ? { x: m.x, y: m.y } : null;
  }, test);

/** Closes whatever dialogs are open with Escape, as a player would. */
async function closeAll(page: Page): Promise<void> {
  for (let i = 0; i < 5 && (await stackIds(page)).length > 0; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
  expect(await stackIds(page)).toEqual([]);
}

/** Floor 50 by its stairs, with the hero unkillable. */
async function arriveAtTheLastFloor(page: Page): Promise<void> {
  await triage(page, 'toggleGodMode');
  await triage(page, 'jumpToFloor', 49);
  await triage(page, 'teleportToStairs', 'down');
  await pressUntil(page, 'Shift+Period', async () => (await engineState(page)).floor === 50);
  await closeAll(page);
}

/** Steps through an ending's portal and reads the ending, then the score screen. */
async function takeThePortal(page: Page, portalType: string): Promise<{ ending: string; score: string }> {
  const portal = await findTile(page, { type: portalType });
  expect(portal, `no ${portalType} on the floor`).not.toBeNull();
  await page.keyboard.press(await standBeside(page, portal!));
  await expect(page.locator('#btn-ending-continue')).toBeVisible();
  const ending = (await page.locator('.ui-dialog:visible').first().innerText()).replace(/\s+/g, ' ');
  await page.keyboard.press('Enter');
  await expect(page.locator('#btn-game-over-return')).toBeVisible();
  const score = (await page.locator('#game-over-score').innerText()).trim();
  return { ending, score };
}

test.describe('a whole run', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one browser plays the whole run');
  test.setTimeout(240_000);

  test('town, stairs, level-up, spell, altar, save and continue, and the slain ending', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await embark(page);
    const start = await engineState(page);
    expect(start.floor).toBe(0);

    // A shop buy: bump the chandler, buy the first thing on his list.
    const shopNpc = await page.evaluate(() => {
      const e = window.__cotwEngine!;
      const npc = e.map.getAllEntities().find((n) => (n as { shopId?: string }).shopId && e.merchants.get((n as { shopId?: string }).shopId!));
      return npc ? { id: npc.id, x: npc.x, y: npc.y } : null;
    });
    expect(shopNpc).not.toBeNull();
    await page.keyboard.press(await standBeside(page, shopNpc!));
    await expect.poll(() => stackIds(page)).toContain('shop');
    const purseBefore = await page.evaluate(() => window.__cotwEngine!.player.inventory.getAllCarriedItems().length);
    // The shop ignores trading keys for a moment after it opens (R-ui-7), so press until it buys.
    await pressUntil(page, 'Enter', async () =>
      (await page.evaluate(() => window.__cotwEngine!.player.inventory.getAllCarriedItems().length)) > purseBefore
    );
    await closeAll(page);

    // A pact, sealed with the pact keeper (the first on his list is key 1); his hint shows.
    const keeperId = await page.evaluate(() => window.__cotwEngine!.manifest.pactKeeperNpcId!);
    await page.keyboard.press(await standBeside(page, (await findEntity(page, { id: keeperId }))!));
    await expect.poll(() => stackIds(page)).toContain('shop');
    await pressUntil(page, 'Digit1', async () => (await engineState(page)).pacts.length === 1);
    await closeAll(page);
    await expect(page.locator('.sb-hint')).toBeVisible();
    await expect(page.locator('.sb-hint .sb-title')).toContainText('Pacts');
    await page.locator('.sb-hint-next').click();

    // The stairs down, taken with '>'.
    await triage(page, 'teleportToStairs', 'down');
    await pressUntil(page, 'Shift+Period', async () => (await engineState(page)).floor === 1);
    await closeAll(page);

    // A level-up, spent on the Character tab: plan a point of Strength, accept it.
    await triage(page, 'toggleGodMode');
    await triage(page, 'grantLevel');
    const leveled = await engineState(page);
    expect(leveled.unspent).toBeGreaterThan(0);
    await page.keyboard.press('KeyE');
    await expect.poll(() => stackIds(page)).toContain('character-menu');
    await page.keyboard.press('KeyS');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await engineState(page)).str).toBe(leveled.str + 1);
    expect((await engineState(page)).unspent).toBe(leveled.unspent - 1);
    await closeAll(page);

    // A spell through the aim: quick slot 1 opens the reticle, the arrows put it on the rat,
    // Enter casts. The floor's own monsters in sight are cleared first so nothing else is hit.
    const lane = await page.evaluate(() => {
      const e = window.__cotwEngine!;
      for (let y = 2; y < e.map.height - 2; y++) {
        for (let x = 2; x < e.map.width - 6; x++) {
          if ([0, 1, 2, 3, 4].every((d) => e.map.isPassable(x + d, y) && !e.map.getEntityAt(x + d, y))) return { x, y };
        }
      }
      return null;
    });
    expect(lane).not.toBeNull();
    const ratId = await page.evaluate(({ x, y }) => {
      const e = window.__cotwEngine!;
      e.map.moveEntity(e.player, x, y);
      e.updateFov();
      e.diagnostics.killVisibleMonsters();
      const spawned = e.diagnostics.spawnMonster('giant_rat', { position: { x: x + 3, y } });
      e.updateFov();
      window.__cotwRenderer?.render();
      return spawned!.id;
    }, lane!);
    const ratHp = () =>
      page.evaluate((id) => {
        const rat = window.__cotwEngine!.map.getAllEntities().find((m) => m.id === id);
        return rat && rat.isAlive() ? rat.hp / rat.maxHp : 0;
      }, ratId);
    const beforeCast = await engineState(page);
    const castLog = await messageCount(page);
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => window.__cotwRenderer!.targetingOverlay.isOpen)).toBe(true);
    const aim = await page.evaluate(() => {
      const t = window.__cotwRenderer!.targetingOverlay;
      return { x: t.reticleX, y: t.reticleY };
    });
    const rat = { x: lane!.x + 3, y: lane!.y };
    for (let i = 0; i < Math.abs(rat.x - aim.x); i++) await page.keyboard.press(rat.x > aim.x ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.abs(rat.y - aim.y); i++) await page.keyboard.press(rat.y > aim.y ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await engineState(page)).mana).toBeLessThan(beforeCast.mana);
    await expect.poll(ratHp).toBeLessThan(1);
    expect(await messagesSince(page, castLog)).toMatch(/Giant Rat/i);

    // An altar rite: Týr's Oath-Stone on floor 4 binds a glyph from a burnt spell.
    await triage(page, 'jumpToFloor', 4);
    await closeAll(page);
    const altar = await page.evaluate(() => {
      const e = window.__cotwEngine!;
      for (let y = 0; y < e.map.height; y++) {
        for (let x = 0; x < e.map.width; x++) {
          const h = e.map.getTile(x, y)?.interactionHandlerId;
          if (h && e.manifest.magic?.altars?.some((a) => a.id === h && a.rite === 'inscribe')) return { x, y };
        }
      }
      return null;
    });
    expect(altar, 'no inscribe altar on floor 4').not.toBeNull();
    const toAltar = await standBeside(page, altar!);
    // A monster of the floor standing on the altar would turn the step into an attack.
    await triage(page, 'killVisibleMonsters');
    await closeAll(page);
    await page.keyboard.press(toAltar);
    await expect(page.locator('[data-offering]').first()).toBeVisible();
    const spellsBefore = (await engineState(page)).spells;
    const riteLog = await messageCount(page);
    await page.locator('[data-offering="1"]').click();
    await page.locator('[data-slot]:not([data-slot=""])').first().click();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await engineState(page)).spells.length).toBe(spellsBefore.length - 1);
    expect(await messagesSince(page, riteLog)).toContain('glyph is bound');
    await closeAll(page);

    // Save & exit, then Continue: the hero is where and what they were.
    const saved = await engineState(page);
    // Escape opens the menu once nothing else holds the keys (an effect still playing,
    // a window that opened late): press it until the menu shows.
    await expect(async () => {
      if (!(await page.locator('#btn-savequit-save-exit').isVisible())) await page.keyboard.press('Escape');
      await expect(page.locator('#btn-savequit-save-exit')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await page.locator('#btn-savequit-save-exit').click();
    await expect(page.locator('#btn-menu-continue')).toBeEnabled();
    await page.locator('#btn-menu-continue').click();
    await expect.poll(async () => (await engineState(page)).turn).toBe(saved.turn);
    expect(await engineState(page)).toMatchObject({
      floor: 4, x: saved.x, y: saved.y, level: saved.level, str: saved.str, spells: saved.spells, pacts: saved.pacts,
    });

    // The slain ending: kill the serpent, step through the portal to the score screen.
    await arriveAtTheLastFloor(page);
    const boss = await page.evaluate(() => {
      const e = window.__cotwEngine!;
      const id = e.manifest.quest?.bossMonsterId;
      const b = e.map.getAllEntities().find((m) => (m as { definitionId?: string }).definitionId === id);
      return b ? { x: b.x, y: b.y } : null;
    });
    expect(boss).not.toBeNull();
    await standBeside(page, boss!);
    await triage(page, 'killVisibleMonsters');
    await closeAll(page);
    const slain = await takeThePortal(page, 'gateway_valhalla');
    expect(slain.ending.length).toBeGreaterThan(40);
    expect(slain.score).toMatch(/\d/);
    await page.locator('#btn-game-over-return').click();
    await expect(page.locator('#btn-menu-new-game')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('the driven-off ending through the portal home', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await embark(page);
    await arriveAtTheLastFloor(page);

    // Wounded and alone, the serpent flees once it is struck; it seals its root behind it.
    const sealedFlag = await page.evaluate(() => {
      const e = window.__cotwEngine!;
      const q = e.manifest.quest!;
      const b = e.map.getAllEntities().find((m) => (m as { definitionId?: string }).definitionId === q.bossMonsterId)!;
      b.hp = Math.floor(b.maxHp * 0.1);
      for (const g of e.map.getAllEntities().filter((m) => m !== b && m.type !== 'player' && m !== e.companion)) e.removeEntity(g);
      e.map.moveEntity(e.player, b.x, b.y + 4);
      e.updateFov();
      return e.manifest.bossFleeResolutions!.find((r) => r.monsterDefinitionId === q.bossMonsterId)!.sealedFlag;
    });
    for (let i = 0; i < 40 && !(await page.evaluate((f) => Boolean(window.__cotwEngine!.getWorldFlag(f)), sealedFlag)); i++) {
      await page.keyboard.press(i % 2 ? 'ArrowDown' : 'ArrowUp');
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate((f) => Boolean(window.__cotwEngine!.getWorldFlag(f)), sealedFlag)).toBe(true);
    await closeAll(page);

    const home = await takeThePortal(page, 'gateway_home');
    expect(home.ending.length).toBeGreaterThan(40);
    expect(home.score).toMatch(/\d/);
    expect(pageErrors).toEqual([]);
  });

  test('a death, and the fallen hero in the hall', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await embark(page);
    const name = await page.evaluate(() => window.__cotwEngine!.player.name);
    await triage(page, 'jumpToFloor', 3);
    await closeAll(page);

    // One hit point, an ogre beside: a wait is the last thing the hero does.
    await page.evaluate(() => {
      const e = window.__cotwEngine!;
      const p = e.player;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (e.map.isPassable(p.x + dx, p.y + dy) && !e.map.getEntityAt(p.x + dx, p.y + dy)) {
          e.diagnostics.spawnMonster('ogre', { position: { x: p.x + dx, y: p.y + dy } });
          break;
        }
      }
      p.hp = 1;
      e.updateFov();
    });
    for (let i = 0; i < 20 && !(await page.locator('#btn-game-over-return').isVisible()); i++) {
      await page.keyboard.press('Period');
      await page.waitForTimeout(100);
    }
    await expect(page.locator('#btn-game-over-return')).toBeVisible();
    await page.locator('#btn-game-over-return').click();

    await page.locator('#btn-menu-valhalla').click();
    await expect(page.locator('#valhalla-list')).toContainText(name);
    expect(pageErrors).toEqual([]);
  });
});
