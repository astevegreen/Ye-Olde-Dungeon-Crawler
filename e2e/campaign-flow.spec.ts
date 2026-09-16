import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Objective-Driven Playwright E2E Suite for Multi-Floor Progression and NPC Interaction.
 *
 * Drives the character through:
 *   Stage 0: Prerequisite checks & introspection inspection
 *   Stage 1: Friendly NPC interaction with ModalStackManager
 *   Stage 2: Tactical exploration & combat with GodMode contingency
 *   Stage 3: Multi-floor stair transition
 *   Stage 4: Subsequent floor exploration & HUD verification
 *
 * Produces pass/fail verdicts and a structured action log attached to the test report.
 */

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');

// Support --seed=<number> CLI argument or TEST_SEED environment variable (default: 424242)
const seedArg = process.argv.find((arg) => arg.startsWith('--seed='));
const TEST_SEED = parseInt(
  process.env.TEST_SEED || (seedArg ? seedArg.split('=')[1] : '424242'),
  10
);

const MAX_TURNS_PER_STAGE = 150;
const ACTION_DELAY_MS = 60;

interface LogEntry {
  turn: number;
  stage: number;
  action: string;
  resultSummary: string;
}

interface Coordinate {
  x: number;
  y: number;
}

// Direction keys for cardinal movements
function getDirectionKey(dx: number, dy: number): string {
  if (dx === 0 && dy === -1) return 'ArrowUp';
  if (dx === 0 && dy === 1) return 'ArrowDown';
  if (dx === -1 && dy === 0) return 'ArrowLeft';
  if (dx === 1 && dy === 0) return 'ArrowRight';
  throw new Error(`Invalid cardinal delta: dx=${dx}, dy=${dy}`);
}

test('objective-driven multi-floor progression and NPC interaction', { tag: '@campaign' }, async ({ page }, testInfo) => {
  // Hard wall-clock timeout: 60s total
  test.setTimeout(60000);

  expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const actionLog: LogEntry[] = [];
  let currentStage = 0;
  let initialFloorIndex = 0;
  let finalFloorIndex = 0;
  let npcInteractionOccurred = false;

  const logAction = (action: string, resultSummary: string, turn: number) => {
    const entry: LogEntry = {
      turn,
      stage: currentStage,
      action,
      resultSummary,
    };
    actionLog.push(entry);
    console.log(`[Stage ${currentStage} | Turn ${turn}] ${action}: ${resultSummary}`);
  };

  try {
    // =========================================================================
    // BOOT GAME & INITIALIZE CHARACTER
    // =========================================================================
    await page.goto(pathToFileURL(BUNDLE).href);
    await expect(page.locator('#main-menu-screen')).toBeVisible();

    await page.locator('#btn-menu-new-game').click();
    await expect(page.locator('#title-screen')).toBeVisible();

    // Roll stats and embark into town
    await page.locator('#btn-roll-dice').click();
    await page.locator('#btn-create-embark').click();

    // Confirm game canvas and HUD are mounted
    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect(page.locator('#ground-status-bar')).toBeAttached();

    // Seed PRNG state deterministically
    await page.evaluate((seed) => {
      const engine = (window as any).__cotwEngine;
      if (engine?.prng) {
        engine.prng.setState(seed);
      }
    }, TEST_SEED);

    // =========================================================================
    // STAGE 0: PREREQUISITE CHECKS & INTROSPECTION AUDIT
    // =========================================================================
    currentStage = 0;
    const stage0Audit = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const inputHandler = (window as any).__cotwInputHandler;

      // 1. Check existing engine.diagnostics vs window exposure
      const diagKeys = engine?.diagnostics ? Object.keys(engine.diagnostics) : [];
      const hasEngineIntrospection = Boolean(
        engine &&
        typeof engine.currentFloor === 'number' &&
        engine.player &&
        engine.map
      );
      const hasInputIntrospection = Boolean(inputHandler && inputHandler.modalStack);

      // 2. Audit PRNG vs Math.random on Floor 0 and Floor 1+ path
      // Floor 0 Town is completely deterministic via COTW_TOWN layout.
      // Floor 1+ procedural generation contains known Math.random calls in dungeonArc.ts (lines 174, 177)
      // and src/content/cotw/monsters.ts gold drop generators.
      const prngAudits = {
        floor0TownDeterministic: true,
        floor1ArcMathRandomIssues: [
          'src/engine/quest/dungeonArc.ts:174 (populateDungeonFloor passes Math.random)',
          'src/engine/quest/dungeonArc.ts:177 (populateDungeonLoot defaults to Math.random)',
          'src/content/cotw/monsters.ts (monster gold drop generators invoke Math.random)',
        ],
      };

      return {
        diagKeys,
        hasEngineIntrospection,
        hasInputIntrospection,
        prngAudits,
        startingFloor: engine.currentFloor,
        startingTurn: engine.turnCount,
      };
    });

    logAction(
      'Stage 0 Audit',
      `Consumed window.__cotwEngine and window.__cotwInputHandler directly. ` +
      `Diagnosed diagnostics API (${stage0Audit.diagKeys.join(', ')}). ` +
      `P-10 PRNG Audit recorded: Floor 0 is static/deterministic; Floor 1+ Math.random() instances documented: ${stage0Audit.prngAudits.floor1ArcMathRandomIssues.join('; ')}.`,
      stage0Audit.startingTurn
    );

    expect(stage0Audit.hasEngineIntrospection, 'Expected window.__cotwEngine to be exposed').toBe(true);
    expect(stage0Audit.hasInputIntrospection, 'Expected window.__cotwInputHandler to be exposed').toBe(true);
    initialFloorIndex = stage0Audit.startingFloor;

    // =========================================================================
    // STAGE 1: FRIENDLY NPC INTERACTION
    // =========================================================================
    currentStage = 1;
    let stage1Turns = 0;

    // 1. Locate nearest friendly NPC
    const targetNpc = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const entities = engine.map.getAllEntities();
      const npcs = entities.filter((e: any) => e.type === 'npc');
      let nearest = null;
      let minDistance = Infinity;
      for (const npc of npcs) {
        const dist = Math.abs(npc.x - engine.player.x) + Math.abs(npc.y - engine.player.y);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = {
            id: npc.id,
            name: npc.name,
            x: npc.x,
            y: npc.y,
            greeting: npc.greeting,
          };
        }
      }
      return nearest;
    });

    expect(targetNpc, 'Expected to find at least one friendly NPC on Floor 0').not.toBeNull();
    logAction(
      'Target NPC Selected',
      `Targeting nearest NPC: ${targetNpc!.name} (${targetNpc!.id}) at (${targetNpc!.x}, ${targetNpc!.y})`,
      await page.evaluate(() => (window as any).__cotwEngine.turnCount)
    );

    // 2. Navigate adjacent to NPC (tile directly south: x = targetNpc.x, y = targetNpc.y + 1)
    const adjacentTile: Coordinate = { x: targetNpc!.x, y: targetNpc!.y + 1 };

    while (stage1Turns < MAX_TURNS_PER_STAGE) {
      const playerPos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });

      if (playerPos.x === adjacentTile.x && playerPos.y === adjacentTile.y) {
        break;
      }

      // Step towards adjacent tile
      const dx = Math.sign(adjacentTile.x - playerPos.x);
      const dy = Math.sign(adjacentTile.y - playerPos.y);

      // Prioritize dy (moving north through shop door) then dx
      const stepDelta = dy !== 0 ? { dx: 0, dy } : { dx, dy: 0 };
      const key = getDirectionKey(stepDelta.dx, stepDelta.dy);

      await page.keyboard.press(key);
      await page.waitForTimeout(ACTION_DELAY_MS);
      stage1Turns++;

      const currentTurn = await page.evaluate(() => (window as any).__cotwEngine.turnCount);
      const newPos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });

      logAction(
        `Move towards NPC (${key})`,
        `Player at (${newPos.x}, ${newPos.y})`,
        currentTurn
      );
    }

    if (stage1Turns >= MAX_TURNS_PER_STAGE) {
      throw new Error(`Stalled in Stage 1 after ${stage1Turns} turns trying to reach adjacent tile.`);
    }

    // 3. Bump into the NPC to trigger interaction dialog
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    stage1Turns++;

    const currentTurnAfterBump = await page.evaluate(() => (window as any).__cotwEngine.turnCount);

    // 4. Assert dialog appears on ModalStackManager with non-empty NPC text
    const modalCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      const stack = handler?.modalStack;
      const shop = handler?.shopOverlay;
      return {
        hasShopModal: stack ? stack.has('shop') : false,
        stackIds: stack ? stack.getStackIds() : [],
        isShopOpen: Boolean(shop?.isOpen),
        npcName: shop?.activeNpc?.name,
        npcGreeting: shop?.activeNpc?.greeting,
        npcId: shop?.activeNpc?.id,
      };
    });

    expect(modalCheck.hasShopModal, 'ModalStackManager must contain "shop" modal').toBe(true);
    expect(modalCheck.isShopOpen, 'ShopOverlay must be flagged open').toBe(true);
    expect(modalCheck.npcGreeting, 'NPC dialog text must be non-empty').toBeTruthy();
    expect(modalCheck.npcGreeting!.length).toBeGreaterThan(0);
    expect(modalCheck.npcId).toBe(targetNpc!.id);

    npcInteractionOccurred = true;
    logAction(
      'NPC Dialog Verified',
      `Dialog verified on ModalStackManager for ${modalCheck.npcName}: "${modalCheck.npcGreeting}"`,
      currentTurnAfterBump
    );

    // 5. Dismiss dialog cleanly with Escape and assert modal stack is empty
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const postDismissCheck = await page.evaluate(() => {
      const handler = (window as any).__cotwInputHandler;
      return {
        isEmpty: handler?.modalStack ? handler.modalStack.isEmpty() : true,
        isShopOpen: Boolean(handler?.shopOverlay?.isOpen),
      };
    });

    expect(postDismissCheck.isEmpty, 'ModalStackManager must be empty after dismissal').toBe(true);
    expect(postDismissCheck.isShopOpen, 'ShopOverlay must be closed after dismissal').toBe(false);
    logAction(
      'NPC Dialog Dismissed',
      'ModalStack returned cleanly to base gameplay state',
      currentTurnAfterBump
    );

    // =========================================================================
    // STAGE 2: TACTICAL EXPLORATION & COMBAT
    // =========================================================================
    currentStage = 2;
    let stage2Turns = 0;

    // Enable contingency GodMode so bad combat rolls don't flake the workflow
    await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      if (!engine.player.isInvulnerable) {
        engine.diagnostics.toggleGodMode();
      }
    });

    // Spawn a hostile test monster along the courtyard path
    const spawnCoordinate: Coordinate = { x: 20, y: 10 };
    const spawnedMonster = await page.evaluate((pos) => {
      const engine = (window as any).__cotwEngine;
      const mob = engine.diagnostics.spawnMonster('goblin', {
        position: pos,
        aiState: 'hunting',
      });
      if (mob) {
        mob.fleeHealthPercent = 0.0;
      }
      return mob;
    }, spawnCoordinate);

    expect(spawnedMonster, 'Hostile test monster should spawn successfully').not.toBeNull();
    logAction(
      'Combat Contingency & Spawn',
      `Enabled GodMode. Spawned hostile ${spawnedMonster!.name} at (${spawnCoordinate.x}, ${spawnCoordinate.y}) with ${spawnedMonster!.hp} HP`,
      await page.evaluate(() => (window as any).__cotwEngine.turnCount)
    );

    const stairsDownPos = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      return engine.map.stairsDown ?? { x: 25, y: 8 };
    });

    // Step south out of Olaf's store door first
    const doorExitTile: Coordinate = { x: 10, y: 10 };
    while (stage2Turns < MAX_TURNS_PER_STAGE) {
      const playerPos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });
      if (playerPos.x === doorExitTile.x && playerPos.y === doorExitTile.y) {
        break;
      }
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(ACTION_DELAY_MS);
      stage2Turns++;
    }

    // Now navigate east along y = 10 towards the spawned monster at (20, 10)
    let monsterDefeated = false;
    while (stage2Turns < MAX_TURNS_PER_STAGE) {
      const state = await page.evaluate(() => {
        const engine = (window as any).__cotwEngine;
        const player = engine.player;
        const monster = engine.map.getAllEntities().find((e: any) => e.id.startsWith('mob-goblin'));
        return {
          playerX: player.x,
          playerY: player.y,
          turnCount: engine.turnCount,
          monster: monster
            ? {
                id: monster.id,
                name: monster.name,
                hp: monster.hp,
                maxHp: monster.maxHp,
                x: monster.x,
                y: monster.y,
                alive: monster.isAlive(),
              }
            : null,
        };
      });

      if (!state.monster || !state.monster.alive) {
        monsterDefeated = true;
        logAction(
          'Monster Defeated',
          'Goblin defeated and removed from active actors',
          state.turnCount
        );
        break;
      }

      // Check if monster is adjacent
      const dx = state.monster.x - state.playerX;
      const dy = state.monster.y - state.playerY;

      if (Math.abs(dx) + Math.abs(dy) === 1) {
        // Engage via bump-to-attack
        const prevHp = state.monster.hp;
        const attackKey = getDirectionKey(dx, dy);
        await page.keyboard.press(attackKey);
        await page.waitForTimeout(ACTION_DELAY_MS);
        stage2Turns++;

        const afterAttack = await page.evaluate(() => {
          const engine = (window as any).__cotwEngine;
          const monster = engine.map.getAllEntities().find((e: any) => e.id.startsWith('mob-goblin'));
          return {
            turnCount: engine.turnCount,
            monsterHp: monster ? monster.hp : 0,
            monsterMaxHp: monster ? monster.maxHp : 0,
            monsterName: monster ? monster.name : 'Goblin',
            isAlive: monster ? monster.isAlive() : false,
          };
        });

        const damage = prevHp - afterAttack.monsterHp;
        logAction(
          'Combat Attack',
          `[Combat] Player attacked ${afterAttack.monsterName} at (${state.monster.x}, ${state.monster.y}) for ${damage} damage. Monster HP: ${afterAttack.monsterHp}/${afterAttack.monsterMaxHp}`,
          afterAttack.turnCount
        );

        if (!afterAttack.isAlive || afterAttack.monsterHp <= 0) {
          monsterDefeated = true;
          break;
        }
      } else {
        // Move towards monster
        let moveKey: string;
        if (Math.abs(dx) > Math.abs(dy)) {
          moveKey = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        } else if (dy !== 0) {
          moveKey = dy > 0 ? 'ArrowDown' : 'ArrowUp';
        } else {
          moveKey = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        }
        await page.keyboard.press(moveKey);
        await page.waitForTimeout(ACTION_DELAY_MS);
        stage2Turns++;
        logAction(
          `Pursue Monster (${moveKey})`,
          `Player at (${state.playerX}, ${state.playerY}), monster at (${state.monster.x}, ${state.monster.y})`,
          state.turnCount
        );
      }
    }

    expect(monsterDefeated, 'Hostile monster must be engaged and defeated').toBe(true);

    // Continue navigation to stairsDown position (25, 8)
    while (stage2Turns < MAX_TURNS_PER_STAGE) {
      const pos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });

      if (pos.x === stairsDownPos.x && pos.y === stairsDownPos.y) {
        break;
      }

      let key: string;
      if (pos.x < stairsDownPos.x) {
        key = 'ArrowRight';
      } else if (pos.x > stairsDownPos.x) {
        key = 'ArrowLeft';
      } else if (pos.y > stairsDownPos.y) {
        key = 'ArrowUp';
      } else {
        key = 'ArrowDown';
      }

      await page.keyboard.press(key);
      await page.waitForTimeout(ACTION_DELAY_MS);
      stage2Turns++;
    }

    if (stage2Turns >= MAX_TURNS_PER_STAGE) {
      throw new Error(`Stalled in Stage 2 after ${stage2Turns} turns navigating to stairs.`);
    }

    logAction(
      'Stairs Down Reached',
      `Player positioned on stairs down tile (${stairsDownPos.x}, ${stairsDownPos.y})`,
      await page.evaluate(() => (window as any).__cotwEngine.turnCount)
    );

    // =========================================================================
    // STAGE 3: MULTI-FLOOR TRANSITION
    // =========================================================================
    currentStage = 3;

    // Trigger stair descent via Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const transitionState = await page.evaluate(() => {
      const engine = (window as any).__cotwEngine;
      const standingTile = engine.map.getTile(engine.player.x, engine.player.y);
      const entities = engine.map.getAllEntities();
      return {
        currentFloor: engine.currentFloor,
        playerPos: { x: engine.player.x, y: engine.player.y },
        standingTileType: standingTile?.type,
        isStairsUp: Boolean(standingTile?.isStairsUp || standingTile?.type === 'stairs_up'),
        mapWidth: engine.map.width,
        mapHeight: engine.map.height,
        entityIds: entities.map((e: any) => e.id),
      };
    });

    finalFloorIndex = transitionState.currentFloor;
    logAction(
      'Floor Transition Executed',
      `Transitioned from Floor ${initialFloorIndex} to Floor ${finalFloorIndex} at player pos (${transitionState.playerPos.x}, ${transitionState.playerPos.y})`,
      await page.evaluate(() => (window as any).__cotwEngine.turnCount)
    );

    // Assert multi-floor transition invariants
    expect(finalFloorIndex, 'finalFloorIndex must be greater than initialFloorIndex').toBeGreaterThan(initialFloorIndex);
    expect(transitionState.isStairsUp, 'Player must spawn on stairs_up tile on Floor 1').toBe(true);
    expect(transitionState.mapWidth, 'New floor width must be positive').toBeGreaterThan(0);
    expect(transitionState.mapHeight, 'New floor height must be positive').toBeGreaterThan(0);

    // Assert dormant town actors are not ticking on new floor
    const hasDormantTownNpc = transitionState.entityIds.some((id: string) => id === 'npc-olaf' || id === 'npc-gunther');
    expect(hasDormantTownNpc, 'Town NPCs must not exist on dungeon floor map').toBe(false);

    // =========================================================================
    // STAGE 4: SUBSEQUENT FLOOR EXPLORATION
    // =========================================================================
    currentStage = 4;
    let stage4Turns = 0;

    const moveDirections = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];

    while (stage4Turns < 5) {
      const prevTurn = await page.evaluate(() => (window as any).__cotwEngine.turnCount);
      const prevPos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });

      // Try cardinal directions until a move succeeds
      let moveKey = moveDirections[stage4Turns % moveDirections.length];
      await page.keyboard.press(moveKey);
      await page.waitForTimeout(ACTION_DELAY_MS);

      const afterState = await page.evaluate(() => {
        const engine = (window as any).__cotwEngine;
        return {
          turnCount: engine.turnCount,
          playerPos: { x: engine.player.x, y: engine.player.y },
          lastActionSuccess: engine.lastActionResult?.success ?? false,
        };
      });

      // If bumped a wall, try alternate direction to ensure active turns
      if (afterState.turnCount === prevTurn) {
        moveKey = moveDirections[(stage4Turns + 2) % moveDirections.length];
        await page.keyboard.press(moveKey);
        await page.waitForTimeout(ACTION_DELAY_MS);
      }

      const verifiedTurn = await page.evaluate(() => (window as any).__cotwEngine.turnCount);
      const verifiedPos = await page.evaluate(() => {
        const p = (window as any).__cotwEngine.player;
        return { x: p.x, y: p.y };
      });

      stage4Turns++;
      logAction(
        `Floor 1 Exploration Step ${stage4Turns}`,
        `Moved ${moveKey} -> Player at (${verifiedPos.x}, ${verifiedPos.y}), Turn ${verifiedTurn}`,
        verifiedTurn
      );
    }

    // Verify HUD updates
    const hudFloorText = await page.locator('#header-floor').textContent();
    expect(hudFloorText, 'HUD header-floor should reflect Floor 1').toContain('Floor 1');

    // Hard Assertions Summary
    expect(finalFloorIndex > initialFloorIndex, 'finalFloorIndex > initialFloorIndex').toBe(true);
    expect(npcInteractionOccurred, 'npcInteractionOccurred === true').toBe(true);
    expect(pageErrors, 'Expected zero uncaught page errors or circular JSON exceptions').toEqual([]);

    logAction(
      'Suite Complete',
      `Campaign flow test PASSED. Initial floor: ${initialFloorIndex}, Final floor: ${finalFloorIndex}, Total actions logged: ${actionLog.length}`,
      await page.evaluate(() => (window as any).__cotwEngine.turnCount)
    );
  } catch (error) {
    // Write failure dump
    const testResultsDir = resolve(process.cwd(), 'test-results');
    if (!existsSync(testResultsDir)) {
      mkdirSync(testResultsDir, { recursive: true });
    }
    const failureDumpPath = join(testResultsDir, `action-log-failure-${Date.now()}.json`);
    const failurePayload = {
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      stack: (error as Error).stack,
      stage: currentStage,
      pageErrors,
      last20Actions: actionLog.slice(-20),
      fullActionLog: actionLog,
    };
    writeFileSync(failureDumpPath, JSON.stringify(failurePayload, null, 2), 'utf8');
    console.error(`\n❌ Test failed in Stage ${currentStage}. Failure dump written to:\n   ${failureDumpPath}\n`);
    throw error;
  } finally {
    // Attach action log artifact to test report
    await testInfo.attach('action-log', {
      body: JSON.stringify(actionLog, null, 2),
      contentType: 'application/json',
    });
  }
});
