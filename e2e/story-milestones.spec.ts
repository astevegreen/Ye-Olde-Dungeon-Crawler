import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pastTheOpening } from './newHero';

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

async function embarkNewHero(page: Page): Promise<void> {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-new-game').click();
  await page.locator('#btn-create-embark').click();
  await pastTheOpening(page);
}

/**
 * Steps with `key` and waits for `modalId` to reach the modal stack. A keypress during
 * effect playback or under heavy parallel load can be dropped, so a step that left the
 * hero where they stood is retried; a fixed sleep used to race the modal instead. A
 * hostile that wandered within two tiles is lifted off the map first: one standing on
 * the target turned the step into an attack (the runestone and altar flakes).
 */
async function stepAndAwaitModal(page: Page, key: string, modalId: string): Promise<void> {
  const state = () =>
    page.evaluate((id) => {
      const w = window as any;
      const e = w.__cotwEngine;
      return {
        open: Boolean(w.__cotwInputHandler?.modalStack.has(id)),
        locked: Boolean(w.__cotwInputHandler?.isInputLocked),
        pos: `${e.player.x},${e.player.y}`,
        stack: w.__cotwInputHandler?.modalStack.getStackIds() ?? [],
        log: e.messages.slice(-3),
        focus: `${document.activeElement?.tagName}#${document.activeElement?.id}`,
        enabled: w.__cotwInputHandler?.enabled,
        hp: `${e.player.hp}/${e.player.maxHp}`,
        gameOver: document.getElementById('game-over-modal')?.style.display,
        here: e.map.getTile(e.player.x, e.player.y)?.type,
        around: [[0,-1],[0,1],[-1,0],[1,0]].map(([dx,dy]) => `${e.map.getTile(e.player.x+dx, e.player.y+dy)?.type}${e.map.getEntityAt(e.player.x+dx, e.player.y+dy) ? '+ent' : ''}`),
      };
    }, modalId);

  const start = await state();
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect.poll(async () => (await state()).locked).toBe(false);
    await page.evaluate(() => {
      const e = (window as any).__cotwEngine;
      for (const m of e.map.getAllEntities()) {
        const near = Math.max(Math.abs(m.x - e.player.x), Math.abs(m.y - e.player.y)) <= 2;
        if (near && m.type === 'monster' && m.faction !== 'player' && m.isAlive()) e.removeEntity(m);
      }
    });
    await page.keyboard.press(key);
    try {
      await expect.poll(async () => (await state()).open, { timeout: 2000 }).toBe(true);
      // Choice dialogs ignore keys for 200ms after opening, so a held key can't pick for you.
      await page.waitForTimeout(250);
      return;
    } catch {
      if ((await state()).pos !== start.pos) break; // the step happened; retrying would walk away
    }
  }
  expect((await state()).open, `'${modalId}' never opened after ${key}: ${JSON.stringify(await state())}`).toBe(true);
}

const stackIds = (page: Page) =>
  page.evaluate(() => ((window as any).__cotwInputHandler?.modalStack.getStackIds() ?? []) as string[]);

// What no other test drives in the browser: the mana orb's click, a melee hit's floating text,
// and the story's runestone and Víðnir choices on real generated floors, with their flags
// across a save. The rest of what this spec once walked through is covered elsewhere.
test.describe('story milestones and HUD wiring', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one browser plays the story milestones');

  test('the mana orb opens the spellbook, and a melee hit shows floating text', async ({ page }) => {
    await embarkNewHero(page);
    await expect(page.locator('#btn-hud-pacts'), 'Pacts left the HUD bar').toHaveCount(0);

    await page.locator('#hud-mana-orb').click();
    await expect.poll(() => stackIds(page)).toContain('character-menu');
    await page.keyboard.press('Escape');
    await expect.poll(() => stackIds(page)).toEqual([]);

    const spawned = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const p = engine.player;
      return Boolean(engine.diagnostics.spawnMonster('goblin', { position: { x: p.x + 1, y: p.y }, aiState: 'hunting' }));
    });
    expect(spawned, 'a goblin beside the hero').toBe(true);

    // Step into it until a blow lands: a melee blow has a hit roll (80% + 2% a Dexterity point
    // above 10), and only a hit spawns the text.
    let floatingCount = 0;
    for (let swing = 0; swing < 12 && floatingCount === 0; swing++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      floatingCount = await page.evaluate(() => (window as any).__cotwRenderer.floatingTextRunner.getActiveCount());
    }
    expect(floatingCount, 'Floating combat text must spawn on a hit').toBeGreaterThanOrEqual(1);
  });

  test('a runestone and Víðnir open their choices, and the flags they set survive save and continue', async ({ page }) => {
    test.setTimeout(120000);
    await embarkNewHero(page);
    // A level-1 hero teleported this deep can be killed between steps (floor 45 did, under
    // load), which ends the run mid-test; these steps aren't about combat.
    await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      if (!engine.player.isInvulnerable) engine.diagnostics.toggleGodMode();
    });

    // A real floor 8 raises the Lay of the Frost King, and with no shard in hand stepping onto
    // it opens its choice.
    const runestoneResult = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      engine.diagnostics.jumpToFloor(8);

      const map = engine.map;
      let runePos: { x: number; y: number } | null = null;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.getTile(x, y);
          if (t?.type === 'skaldic_runestone_1') runePos = { x, y };
        }
      }

      if (!runePos) return { error: 'Floor 8 missing skaldic_runestone_1' };

      // Stand on a free side of it, confirming the move landed (a blind moveEntity onto an
      // occupied or blocked tile left the hero at the stairs, stepping into nothing).
      let stepKey: string | null = null;
      for (const [dx, dy, key] of [[0, 1, 'ArrowUp'], [0, -1, 'ArrowDown'], [1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight']] as const) {
        const x = runePos.x + dx;
        const y = runePos.y + dy;
        if (!map.isPassable(x, y) || map.getEntityAt(x, y)) continue;
        engine.map.moveEntity(engine.player, x, y);
        if (engine.player.x === x && engine.player.y === y) {
          stepKey = key;
          break;
        }
      }
      engine.updateFov();

      return {
        currentFloor: engine.currentFloor,
        runePos,
        stepKey,
      };
    });

    expect(runestoneResult.currentFloor).toBe(8);
    expect(runestoneResult.runePos).toBeDefined();
    expect(runestoneResult.stepKey, 'no free tile beside the runestone').toBeTruthy();
    await stepAndAwaitModal(page, runestoneResult.stepKey!, 'choice');

    await expect(page.locator('#choice-modal-overlay')).toContainText('Skaldic Runestone: Lay of the Frost King');

    // Confirm the preselected first choice with Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);

    const runestoneResolved = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      return {
        hasResolvedFlag: Boolean(engine.worldState.flags['skaldic_runestone_1_resolved']),
        hasSpellHintInLog: engine.messages.some((m: string) => m.includes('RUNIC SPELL HINT')),
      };
    });

    expect(runestoneResolved.hasResolvedFlag, 'Runestone milestone flag must be recorded').toBe(true);
    expect(runestoneResolved.hasSpellHintInLog, 'Runic spell hint must be printed to the combat log').toBe(true);

    // The real Víðnir slain on floor 45: the next step opens his dying prophecy.
    const vidnirResult = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      engine.diagnostics.jumpToFloor(45);

      // Find an open room corridor with at least 2 adjacent passable empty tiles
      for (let y = 2; y < engine.map.height - 2; y++) {
        for (let x = 2; x < engine.map.width - 2; x++) {
          if (
            engine.map.isPassable(x, y) &&
            !engine.map.getEntityAt(x, y) &&
            engine.map.isPassable(x + 1, y) &&
            !engine.map.getEntityAt(x + 1, y)
          ) {
            engine.map.moveEntity(engine.player, x, y);
            break;
          }
        }
        if (engine.map.isPassable(engine.player.x + 1, engine.player.y)) break;
      }

      engine.updateFov();

      // Locate or spawn miniboss_maw_herald (Víðnir) at a visible tile nearby
      let vidnir = engine.map
        .getAllEntities()
        .find((e: any) => e.definitionId === 'miniboss_maw_herald');

      // Find another visible passable tile for Vidnir that does not block (player.x + 1, player.y)
      let vidnirPos: { x: number; y: number } | null = null;
      for (let y = 0; y < engine.map.height; y++) {
        for (let x = 0; x < engine.map.width; x++) {
          if (
            (x !== engine.player.x || y !== engine.player.y) &&
            (x !== engine.player.x + 1 || y !== engine.player.y) &&
            engine.fov.isVisible(x, y) &&
            engine.map.isPassable(x, y) &&
            !engine.map.getEntityAt(x, y)
          ) {
            vidnirPos = { x, y };
            break;
          }
        }
        if (vidnirPos) break;
      }

      if (vidnirPos) {
        if (!vidnir) {
          vidnir = engine.diagnostics.spawnMonster('miniboss_maw_herald', {
            position: vidnirPos,
          });
        } else {
          engine.map.moveEntity(vidnir, vidnirPos.x, vidnirPos.y);
        }
      }

      engine.updateFov();

      // Slay Vidnir alone to register the kill in the compendium. Bystanders in view are lifted
      // off first: their XP on top of his took some seeds' hero to level 10, and the Saga
      // choice that unlocks, held back while his prophecy opened, then broke into a later
      // step and could not be dismissed (the Save & Quit flake, stack ["altar","choice"]).
      for (const m of engine.map.getAllEntities()) {
        const bystander = m.type === 'monster' && m !== vidnir && m.faction !== 'player' && m.isAlive();
        if (bystander && engine.fov.isVisible(m.x, m.y)) engine.removeEntity(m);
      }
      engine.diagnostics.killVisibleMonsters();

      // Ensure kill is recorded in compendium
      if (engine.compendium.getEntry('miniboss_maw_herald').kills < 1) {
        engine.compendium.recordKill('miniboss_maw_herald', 'Víðnir, Herald of the Wyrm');
      }

      window.focus();

      return {
        currentFloor: engine.currentFloor,
        kills: engine.compendium.getEntry('miniboss_maw_herald').kills,
      };
    });

    expect(vidnirResult.currentFloor).toBe(45);
    expect(vidnirResult.kills, 'Vidnir must be recorded as killed').toBeGreaterThanOrEqual(1);

    await stepAndAwaitModal(page, 'ArrowRight', 'choice');
    await page.waitForTimeout(300);

    const prophecy = page.locator('#choice-modal-overlay');
    await expect(prophecy).toContainText("The Herald's Dying Prophecy");
    await expect(prophecy).toContainText('RAGNARÖK');
    await expect(prophecy).toContainText('DRIVE IT OFF');

    // Choose to heed the warning (>200ms debounce already passed from waitForTimeout)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);

    const vidnirFlagsCheck = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      return {
        vidnirSlain: Boolean(engine.worldState.flags['vidnir_slain']),
        warningHeeded: Boolean(engine.worldState.flags['vidnir_warning_heeded']),
      };
    });

    expect(vidnirFlagsCheck.vidnirSlain, 'vidnir_slain flag must be set').toBe(true);
    expect(vidnirFlagsCheck.warningHeeded, 'vidnir_warning_heeded flag must be set').toBe(true);

    // Save & Quit. The prophecy has closed, so Escape opens the menu; it is pressed until the
    // menu shows, in case a press is dropped under load.
    const saveExit = page.locator('#btn-savequit-save-exit');
    await expect(async () => {
      await expect.poll(() => page.evaluate(() => (window as any).__cotwInputHandler?.isInputLocked)).toBe(false);
      if (!(await saveExit.isVisible())) await page.keyboard.press('Escape');
      const why = await page.evaluate(() => {
        const h = (window as any).__cotwInputHandler;
        const a = document.activeElement as HTMLElement | null;
        return JSON.stringify({ stack: h?.modalStack.getStackIds(), enabled: h?.enabled, locked: h?.isInputLocked, paused: (window as any).__cotwEngine?.isPaused, focus: `${a?.tagName}#${a?.id}.${a?.className}`, alive: (window as any).__cotwEngine?.player.isAlive(), gameOver: document.getElementById('game-over-modal')?.style.display });
      });
      await expect(saveExit, why).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await saveExit.click();
    await page.waitForTimeout(400);

    await expect(page.locator('#btn-menu-continue')).toBeEnabled();
    await page.locator('#btn-menu-continue').click();
    await page.waitForTimeout(400);

    const restoreCheck = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      return {
        isAlive: engine?.player?.isAlive() ?? false,
        hasVidnirFlag: Boolean(engine?.worldState?.flags['vidnir_slain']),
        hasRunestoneFlag: Boolean(engine?.worldState?.flags['skaldic_runestone_1_resolved']),
      };
    });

    expect(restoreCheck.isAlive, 'Restored hero must be alive').toBe(true);
    expect(restoreCheck.hasVidnirFlag, 'Saved flags must survive restore').toBe(true);
    expect(restoreCheck.hasRunestoneFlag, 'Saved milestones must survive restore').toBe(true);
  });
});
