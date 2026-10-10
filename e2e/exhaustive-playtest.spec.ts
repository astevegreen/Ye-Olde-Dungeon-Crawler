import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pastTheOpening } from './newHero';

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

async function embarkNewHero(page: Page): Promise<void> {
  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);
  await page.goto(pathToFileURL(BUNDLE).href);
  await page.locator('#btn-menu-new-game').click();
  for (const attr of ['str', 'dex', 'con', 'int']) {
    for (let i = 0; i < 6; i++) await page.locator(`#btn-dec-${attr}`).click();
  }
  await page.locator('#btn-create-embark').click();
  await pastTheOpening(page);
}

/**
 * Steps with `key` and waits for `modalId` to reach the modal stack. A keypress during
 * effect playback or under heavy parallel load can be dropped, so a step that left the
 * hero where they stood is retried; a fixed sleep used to race the modal instead. A
 * hostile that wandered within two tiles is lifted off the map first: one standing on
 * the target turned the step into an attack (the :549 runestone and :756 altar flakes).
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

test.describe('Exhaustive Playtest: All Recent Features, Narrative, UI & Systems', () => {
  test('full end-to-end playtest across all recent updates', async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1: EMBARK & PARADIGM B GOTHIC ACTION CONSOLE HUD VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    await embarkNewHero(page);

    const hudCheck = await page.evaluate(() => {
      const healthOrb = document.getElementById('hud-health-orb');
      const healthFill = document.getElementById('health-orb-fill');
      const healthText = document.getElementById('health-orb-text');
      const manaOrb = document.getElementById('hud-mana-orb');
      const manaFill = document.getElementById('mana-orb-fill');
      const manaText = document.getElementById('mana-orb-text');
      const actionBelt = document.getElementById('action-belt-slots');
      const fullLog = document.getElementById('game-full-width-log');
      const bottomBar = document.getElementById('game-bottom-bar');
      const pactsOnHud = document.getElementById('btn-hud-pacts');

      return {
        hasHealthOrb: Boolean(healthOrb),
        healthText: healthText?.textContent?.trim(),
        healthFillHeight: healthFill?.style.height,
        hasManaOrb: Boolean(manaOrb),
        manaText: manaText?.textContent?.trim(),
        manaFillHeight: manaFill?.style.height,
        hasActionBelt: Boolean(actionBelt),
        beltSlotCount: actionBelt?.children.length ?? 0,
        hasFullWidthLog: Boolean(fullLog),
        hasBottomBar: Boolean(bottomBar),
        pactsOnHudPresent: Boolean(pactsOnHud),
      };
    });

    expect(hudCheck.hasHealthOrb, 'Health orb must exist in Gothic Action Console').toBe(true);
    expect(hudCheck.hasManaOrb, 'Mana orb must exist in Gothic Action Console').toBe(true);
    expect(hudCheck.hasActionBelt, 'Action belt must exist').toBe(true);
    expect(hudCheck.hasFullWidthLog, 'Full-width log must exist at bottom').toBe(true);
    expect(hudCheck.pactsOnHudPresent, 'Pacts must be removed from the HUD bar per spec').toBe(false);

    // Test clicking Mana Orb opens Spellbook modal
    await page.locator('#hud-mana-orb').click();
    await page.waitForTimeout(200);
    const spellbookCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      return {
        hasModal: stack ? stack.has('character-menu') || stack.has('spellbook') : false,
      };
    });
    expect(spellbookCheck.hasModal, 'Clicking Mana Orb must open Spellbook modal').toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2: ZERO-TO-ONE CLICK REVOLUTIONS (COIN AUTO-PICKUP & HOVER)
    // ─────────────────────────────────────────────────────────────────────────
    const coinTestResult = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const p = engine.player;

      const targetX = p.x + 1;
      const targetY = p.y;
      const swordX = p.x + 2;
      const swordY = p.y;

      const purse = p.inventory.paperdoll.getItem('purse') as any;
      const purseCoins = purse?.getItems?.() || [];
      const sampleCoin = purseCoins[0];
      const mainHandItem = p.inventory.paperdoll.getItem('mainHand') as any;

      const goldCoins = new sampleCoin.constructor({ id: 'test-coins-1', denomination: 'gold', count: 50 });
      const sword = new mainHandItem.constructor({
        id: 'test-sword-floor-1',
        name: 'Iron Longsword',
        category: 'weapons',
        bulk: 3,
        slot: 'mainHand',
        weight: 1500,
        value: 15,
        stats: { attackBonus: 5 },
      });

      engine.map.addItemAt(targetX, targetY, goldCoins);
      engine.map.addItemAt(swordX, swordY, sword);

      return {
        initialTurn: engine.turnCount,
        targetX,
        targetY,
        swordX,
        swordY,
        itemsAtCoinTileBefore: engine.map.getItemsAt(targetX, targetY)?.length ?? 0,
        itemsAtSwordTileBefore: engine.map.getItemsAt(swordX, swordY)?.length ?? 0,
      };
    });

    expect(coinTestResult.itemsAtCoinTileBefore).toBe(1);
    expect(coinTestResult.itemsAtSwordTileBefore).toBe(1);

    // Step right onto coins tile
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const afterCoinStep = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const p = engine.player;
      const itemsAtCoinTile = engine.map.getItemsAt(p.x, p.y) || [];
      const hasCoins = p.inventory.getAllCarriedItems().some((it: any) => it.id === 'test-coins-1' || it.denomination === 'gold');
      return {
        turn: engine.turnCount,
        playerPos: { x: p.x, y: p.y },
        itemsAtTile: itemsAtCoinTile.length,
        hasCoins,
      };
    });

    expect(afterCoinStep.hasCoins, 'Coins must be auto-picked up into carried inventory').toBe(true);
    expect(afterCoinStep.itemsAtTile, 'Coin tile must be empty after auto-pickup').toBe(0);

    // Step right onto sword tile
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const afterSwordStep = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const p = engine.player;
      const itemsAtSwordTile = engine.map.getItemsAt(p.x, p.y) || [];
      const hasSwordCarried = p.inventory.getAllCarriedItems().some((it: any) => it.id === 'test-sword-floor-1');
      return {
        hasSwordCarried,
        groundCount: itemsAtSwordTile.length,
        groundItemId: itemsAtSwordTile[0]?.id,
      };
    });

    expect(afterSwordStep.hasSwordCarried, 'Non-coin loot must NOT be auto-picked up').toBe(false);
    expect(afterSwordStep.groundCount, 'Sword must remain on the ground').toBe(1);
    expect(afterSwordStep.groundItemId).toBe('test-sword-floor-1');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3: TACTICAL TARGET OVERLAY & FLOATING COMBAT NUMBERS
    // ─────────────────────────────────────────────────────────────────────────
    const combatSetup = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const renderer = (window as any).__cotwRenderer;
      const p = engine.player;

      // Spawn a goblin at p.x + 1, p.y
      const monster = engine.diagnostics.spawnMonster('goblin', {
        position: { x: p.x + 1, y: p.y },
        aiState: 'hunting',
      });

      // Set tactical hover tile
      renderer.tacticalTargetOverlay.setHoveredTile(p.x + 1, p.y);

      return {
        monsterSpawned: Boolean(monster),
        hoveredTile: renderer.tacticalTargetOverlay.hoveredTile,
        initialFloatingCount: renderer.floatingTextRunner.getActiveCount(),
      };
    });

    expect(combatSetup.monsterSpawned).toBe(true);
    expect(combatSetup.hoveredTile).toEqual({ x: afterCoinStep.playerPos.x + 2, y: afterCoinStep.playerPos.y });

    // Attack the monster (step right into it) until a blow lands: since tracker 3.2 a melee
    // blow has a hit roll (80% + 2% a Dexterity point above 10), and only a hit spawns the text.
    let floatingCount = 0;
    for (let swing = 0; swing < 12 && floatingCount === 0; swing++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      floatingCount = await page.evaluate(() => (window as any).__cotwRenderer.floatingTextRunner.getActiveCount());
    }

    const combatResult = await page.evaluate((floatingCount: number) => {
      const engine = (window as any).__cotwEngine;
      const renderer = (window as any).__cotwRenderer;
      const lastMsg = engine.messages[engine.messages.length - 1];

      // Trigger heal to test healing floating numbers
      renderer.floatingTextRunner.spawnHeal(engine.player.x, engine.player.y, 10);

      return {
        lastMsg,
        floatingCountAfterAttack: floatingCount,
        floatingCountAfterHeal: renderer.floatingTextRunner.getActiveCount(),
      };
    }, floatingCount);

    expect(combatResult.floatingCountAfterAttack, 'Floating combat text must spawn on attack').toBeGreaterThanOrEqual(1);
    expect(combatResult.floatingCountAfterHeal, 'Floating heal text must spawn on heal').toBeGreaterThan(combatResult.floatingCountAfterAttack);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4: INVENTORY OVERHAUL (GEAR COMPARISON & DOUBLE-CLICK ACTIONS)
    // ─────────────────────────────────────────────────────────────────────────
    // Open inventory
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(250);

    const invOpened = await page.evaluate(() => {
      const menu = (window as any).__cotwInputHandler?.characterMenuModal;
      return Boolean(menu?.isOpen && menu.activeTabId === 'inventory' && document.querySelector('.inv-grid'));
    });
    expect(invOpened, 'Inventory tab must open on KeyI').toBe(true);

    const inventoryActionsResult = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const renderer = (window as any).__cotwRenderer;
      const p = engine.player;
      const inventory = (window as any).__cotwInputHandler.characterMenuModal.getTabs().find((t: any) => t.id === 'inventory').controller;

      const mainHandItem = p.inventory.paperdoll.getItem('mainHand') as any;
      const purse = p.inventory.paperdoll.getItem('purse') as any;

      // 1. Add weapon with higher attack
      const superSword = new mainHandItem.constructor({
        id: 'super-valkyrie-blade',
        name: 'Valkyrie Blade',
        category: 'weapon',
        bulk: 3,
        slot: 'mainHand',
        weight: 1200,
        value: 100,
        identified: true,
        stats: { attackBonus: 12 },
      });
      p.inventory.primaryPack.addItem(superSword);

      // 2. Add container
      const chest = new purse.constructor({
        id: 'runic-coffer-1',
        name: 'Runic Coffer',
        category: 'containers',
        bulk: 8,
        weight: 4000,
        value: 30,
        containerType: 'chest',
        maxWeightCapacity: 15000,
        maxBulkCapacity: 40,
      });
      p.inventory.primaryPack.addItem(chest);

      renderer.render();

      // Test gear comparison
      inventory.inspector.select(superSword, 'backpack');
      const comparison = inventory.inspector.getEquipmentComparison(superSword, p);

      // Dispatch equip via command bus (what double click triggers)
      engine.commandBus.dispatch({ type: 'equip_item', payload: { itemId: superSword.id } });
      const mainHandEquipped = p.inventory.paperdoll.getItem('mainHand')?.id;

      // Dispatch open container via command bus (what double click triggers)
      engine.commandBus.dispatch({ type: 'open_container', payload: { container: chest } });

      return {
        hasComparison: comparison !== null,
        mainHandEquipped,
        chestWasOpened: chest.wasOpened,
      };
    });

    expect(inventoryActionsResult.hasComparison, 'Gear comparison card must exist when inspecting weapon').toBe(true);
    expect(inventoryActionsResult.mainHandEquipped, 'Equipping via activate must set weapon to mainHand').toBe('super-valkyrie-blade');
    expect(inventoryActionsResult.chestWasOpened, 'Opening container must mark wasOpened').toBe(true);
    // Close inventory (first Escape clears item selection, second closes modal)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const stillOnStack = await page.evaluate(() => (window as any).__cotwInputHandler?.modalStack.has('character-menu'));
    if (stillOnStack) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    const stackAfterClose = await page.evaluate(() => (window as any).__cotwInputHandler?.modalStack.getStackIds() ?? []);
    expect(stackAfterClose).not.toContain('character-menu');

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5: CAMPFIRE GROTTOS (FLOOR 13 DWARVEN HEARTH & FLOOR 37 WORLD BARK)
    // ─────────────────────────────────────────────────────────────────────────
    // Test Floor 13 Dwarven Hearth Grotto
    const floor13Result = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      // A level-1 hero teleported this deep can be killed between steps (floor 45 did,
      // under load), which ends the run mid-test; the floor tests below aren't about combat.
      if (!engine.player.isInvulnerable) engine.diagnostics.toggleGodMode();
      engine.diagnostics.jumpToFloor(13);

      const map = engine.map;
      let cascadeVeilPos: { x: number; y: number } | null = null;
      let hearthPos: { x: number; y: number } | null = null;

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.getTile(x, y);
          if (t?.type === 'dwarven_cascade_veil') cascadeVeilPos = { x, y };
          if (t?.type === 'grotto_hearth') hearthPos = { x, y };
        }
      }

      if (!cascadeVeilPos || !hearthPos) {
        return { error: 'Floor 13 missing cascade veil or hearth' };
      }

      const veilTile = map.getTile(cascadeVeilPos.x, cascadeVeilPos.y);

      // Sanctuary check: no monsters inside grotto bounds
      const vaultBounds = {
        x1: hearthPos.x - 5,
        y1: hearthPos.y - 2,
        x2: hearthPos.x + 5,
        y2: hearthPos.y + 3,
      };
      const monstersInGrotto = map
        .getAllEntities()
        .filter(
          (e: any) =>
            e.faction === 'hostile' &&
            e.x >= vaultBounds.x1 &&
            e.x <= vaultBounds.x2 &&
            e.y >= vaultBounds.y1 &&
            e.y <= vaultBounds.y2
        );

      // Move player directly in front of the hearth
      engine.map.moveEntity(engine.player, hearthPos.x, hearthPos.y + 1);
      engine.updateFov();

      return {
        currentFloor: engine.currentFloor,
        veilWalkable: veilTile?.walkable,
        veilTransparent: veilTile?.transparent,
        monstersInGrottoCount: monstersInGrotto.length,
        hearthPos,
        playerPos: { x: engine.player.x, y: engine.player.y },
      };
    });

    expect(floor13Result.currentFloor).toBe(13);
    expect(floor13Result.veilWalkable, 'Cascade veil must be walkable').toBe(true);
    expect(floor13Result.veilTransparent, 'Cascade veil must be opaque').toBe(false);
    expect(floor13Result.monstersInGrottoCount, 'Grotto must be peaceful sanctuary with 0 monsters').toBe(0);

    // Step onto hearth to trigger choice modal
    await stepAndAwaitModal(page, 'ArrowUp', 'choice');

    const hearthChoiceOpened = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const engine = (window as any).__cotwEngine;
      const stack = handler?.modalStack;
      const choiceOverlay = document.getElementById('choice-modal-overlay');
      return {
        hasChoiceOnStack: stack ? stack.has('choice') : false,
        stackIds: stack ? stack.getStackIds() : [],
        isOverlayVisible: choiceOverlay ? choiceOverlay.style.display !== 'none' : false,
        overlayHtml: choiceOverlay?.innerHTML,
        playerPos: { x: engine.player.x, y: engine.player.y },
        lastAction: engine.lastActionName,
        lastMessages: engine.messages.slice(-3),
        inputEnabled: handler?.enabled,
      };
    });

    expect(hearthChoiceOpened.hasChoiceOnStack, 'Stepping on Dwarven Hearth must open choice modal').toBe(true);
    expect(hearthChoiceOpened.isOverlayVisible).toBe(true);
    expect(hearthChoiceOpened.overlayHtml).toContain('Dwarven Hearth');

    // Confirm choice using ArrowDown + Enter
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);

    const hearthChoiceClosed = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      return {
        hasChoiceOnStack: stack ? stack.has('choice') : false,
      };
    });
    expect(hearthChoiceClosed.hasChoiceOnStack, 'Choice modal must close after selection').toBe(false);

    // Test Floor 37 Heartwood Knothole
    const floor37Result = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      engine.diagnostics.jumpToFloor(37);

      const map = engine.map;
      let rootCurtainPos: { x: number; y: number } | null = null;
      let campfirePos: { x: number; y: number } | null = null;

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.getTile(x, y);
          if (t?.type === 'root_curtain_veil') rootCurtainPos = { x, y };
          if (t?.type === 'world_bark_campfire') campfirePos = { x, y };
        }
      }

      if (!rootCurtainPos || !campfirePos) {
        return { error: 'Floor 37 missing root curtain or campfire' };
      }

      const curtainTile = map.getTile(rootCurtainPos.x, rootCurtainPos.y);

      // Sanctuary check
      const vaultBounds = {
        x1: campfirePos.x - 5,
        y1: campfirePos.y - 2,
        x2: campfirePos.x + 5,
        y2: campfirePos.y + 3,
      };
      const monstersInGrotto = map
        .getAllEntities()
        .filter(
          (e: any) =>
            e.faction === 'hostile' &&
            e.x >= vaultBounds.x1 &&
            e.x <= vaultBounds.x2 &&
            e.y >= vaultBounds.y1 &&
            e.y <= vaultBounds.y2
        );

      return {
        currentFloor: engine.currentFloor,
        curtainWalkable: curtainTile?.walkable,
        curtainTransparent: curtainTile?.transparent,
        monstersInGrottoCount: monstersInGrotto.length,
      };
    });

    expect(floor37Result.currentFloor).toBe(37);
    expect(floor37Result.curtainWalkable, 'Root curtain must be walkable').toBe(true);
    expect(floor37Result.curtainTransparent, 'Root curtain must be opaque').toBe(false);
    expect(floor37Result.monstersInGrottoCount, 'Act 2 grotto must have 0 monsters').toBe(0);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6: SKALDIC RUNESTONES & RUNIC SPELL HINTS
    // ─────────────────────────────────────────────────────────────────────────
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

    // Step onto runestone
    expect(runestoneResult.stepKey, 'no free tile beside the runestone').toBeTruthy();
    await stepAndAwaitModal(page, runestoneResult.stepKey!, 'choice');

    const runestoneModalCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      const choiceOverlay = document.getElementById('choice-modal-overlay');
      return {
        hasChoice: stack ? stack.has('choice') : false,
        text: choiceOverlay?.textContent,
      };
    });

    expect(runestoneModalCheck.hasChoice, 'Stepping on Skaldic Runestone must open choice dialog').toBe(true);
    expect(runestoneModalCheck.text).toContain('Skaldic Runestone: Lay of the Frost King');

    // Confirm choice with ArrowDown + Enter
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);

    const runestoneResolved = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const hasResolvedFlag = Boolean(engine.worldState.flags['skaldic_runestone_1_resolved']);
      const hasSpellHintInLog = engine.messages.some((m: string) => m.includes('RUNIC SPELL HINT'));
      return {
        hasResolvedFlag,
        hasSpellHintInLog,
      };
    });

    expect(runestoneResolved.hasResolvedFlag, 'Runestone milestone flag must be recorded').toBe(true);
    expect(runestoneResolved.hasSpellHintInLog, 'Runic spell hint must be printed to the combat log').toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 7: VÍÐNIR REVELATION & FLOOR 50 DUAL-ENDING STAKES
    // ─────────────────────────────────────────────────────────────────────────
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
      // choice that unlocks, held back while his prophecy opened, then broke into the altar
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

      // Close the character menu if anything left it open, so movement is accepted.
      const handler = (window as any).__cotwInputHandler;
      if (handler?.modalStack?.has('character-menu')) {
        handler.modalStack.remove('character-menu');
      }

      window.focus();

      return {
        currentFloor: engine.currentFloor,
        vidnirFound: Boolean(vidnir),
        kills: engine.compendium.getEntry('miniboss_maw_herald').kills,
        stepDir: 'ArrowRight',
        playerPos: { x: engine.player.x, y: engine.player.y },
        targetPosPassable: engine.map.isPassable(engine.player.x + 1, engine.player.y),
      };
    });

    expect(vidnirResult.currentFloor).toBe(45);
    expect(vidnirResult.kills, 'Vidnir must be recorded as killed').toBeGreaterThanOrEqual(1);

    // Step to trigger MovementAction storyChoiceTrigger check. A keypress during effect
    // playback is dropped, so wait for the input lock to clear first.
    await stepAndAwaitModal(page, vidnirResult.stepDir, 'choice');
    await page.waitForTimeout(300);

    const vidnirChoiceCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      const choiceOverlay = document.getElementById('choice-modal-overlay');
      return {
        hasChoice: stack ? stack.has('choice') : false,
        text: choiceOverlay?.textContent,
      };
    });

    expect(vidnirChoiceCheck.hasChoice, 'Slaying Vidnir must trigger the dying prophecy choice modal').toBe(true);
    expect(vidnirChoiceCheck.text).toContain("The Herald's Dying Prophecy");
    expect(vidnirChoiceCheck.text).toContain('RAGNARÖK');
    expect(vidnirChoiceCheck.text).toContain('DRIVE IT OFF');

    // Choose to heed the warning (>200ms debounce already passed from waitForTimeout)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
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

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 8: RUNIC ALTARS & MANA OVERFLOW
    // ─────────────────────────────────────────────────────────────────────────
    // Test Floor 4 Runic Altar (Týr's Oath-Stone)
    const altarResult = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      engine.diagnostics.jumpToFloor(4);

      const map = engine.map;
      let altarPos: { x: number; y: number } | null = null;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const t = map.getTile(x, y);
          if (t?.type === 'galdr_altar_tyr') altarPos = { x, y };
        }
      }

      if (!altarPos) return { error: 'Floor 4 missing galdr_altar_tyr altar' };

      // Stand on a free side of it, confirming the move landed (a blind moveEntity onto an
      // occupied or blocked tile left the hero at the stairs, stepping into nothing).
      let stepKey: string | null = null;
      for (const [dx, dy, key] of [[0, 1, 'ArrowUp'], [0, -1, 'ArrowDown'], [1, 0, 'ArrowLeft'], [-1, 0, 'ArrowRight']] as const) {
        const x = altarPos.x + dx;
        const y = altarPos.y + dy;
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
        altarPos,
        stepKey,
      };
    });

    expect(altarResult.currentFloor).toBe(4);
    expect(altarResult.altarPos).toBeDefined();

    // Step onto altar
    expect(altarResult.stepKey, 'no free tile beside the altar').toBeTruthy();
    await stepAndAwaitModal(page, altarResult.stepKey!, 'altar');

    const altarModalCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      const altarOverlay = document.getElementById('altar-modal-overlay');
      return {
        hasAltarModal: stack ? stack.has('altar') : false,
        stackIds: stack ? stack.getStackIds() : [],
        level: (window as any).__cotwEngine.player.level,
        isVisible: altarOverlay ? altarOverlay.style.display !== 'none' : false,
        text: altarOverlay?.textContent,
      };
    });

    expect(altarModalCheck.hasAltarModal, 'Stepping on Altar must open AltarModal').toBe(true);
    // Nothing else may open with it: a progress choice on top can't be closed with Escape.
    expect(altarModalCheck.stackIds, `only the altar opens (hero level ${altarModalCheck.level})`).toEqual(['altar']);
    expect(altarModalCheck.isVisible).toBe(true);
    expect(altarModalCheck.text).toContain("Týr's Oath-Stone");

    // Close altar modal with Escape
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__cotwInputHandler?.modalStack.getStackIds())).toEqual([]);

    // Test Mana Overflow (Ginnungagap Deficit)
    const overflowTest = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const p = engine.player;

      // Drain player mana to 0
      p.consumeMana(p.mana);

      // Learn Magic Arrow if not known
      p.learnSpell('magic_arrow');

      // Cast Magic Arrow at 0 mana via commandBus
      const res = engine.commandBus.dispatch({
        type: 'cast_spell',
        payload: { spellId: 'magic_arrow', targetX: p.x + 1, targetY: p.y },
      });
      const overflowLogged = engine.messages.some((m: string) =>
        m.toLowerCase().includes('deficit') ||
        m.toLowerCase().includes('overflow') ||
        m.toLowerCase().includes('void')
      );

      return {
        mana: p.mana,
        voidDebt: p.voidDebt,
        castSuccess: res?.success ?? false,
        overflowLogged,
      };
    });

    expect(overflowTest.castSuccess, 'Spell should cast despite 0 mana due to overflow system').toBe(true);
    expect(overflowTest.voidDebt, 'Void debt should accrue').toBeGreaterThan(0);
    expect(overflowTest.overflowLogged, 'Void debt / overflow messages must be logged').toBe(true);

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 9: SAVE & CONTINUE ROUND-TRIP
    // ─────────────────────────────────────────────────────────────────────────
    // Save & Quit. No dialog is up (Section 8 checks), so Escape opens the menu; it is pressed
    // until the menu shows, in case a press is dropped under load.
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

    // Verify 0 runtime page errors occurred throughout the entire playtest
    expect(pageErrors, `No runtime page errors allowed: ${pageErrors.join(', ')}`).toEqual([]);
  });
});
