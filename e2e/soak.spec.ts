import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { pastTheOpening } from './newHero';
import { SoakPrng } from './soak/prng';
import { decideChaosAction, decidePlayerAction, type DispatchedAction } from './soak/policies';
import {
  createInitialOracleState,
  runOracles,
  normalizeSignature,
  type ActionContext,
} from './soak/oracles';
import type { Finding, ActionLogEntry, SoakSummary, SoakPolicy, SoakOpening } from './soak/types';

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');
const URL = process.env.WHOLE_RUN_URL ?? pathToFileURL(BUNDLE).href;

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  // ignore
}

async function exportSaveCode(page: Page): Promise<string> {
  const hasModal = await page.evaluate(() => Boolean((window as any).__cotwInputHandler?.modalStack?.size > 0));
  if (hasModal) return 'modal_open';

  try {
    const menuBtn = page.locator('#btn-save-title');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      const codeBtn = page.locator('#btn-savequit-copy-code');
      await codeBtn.waitFor({ state: 'visible', timeout: 2000 });
      await codeBtn.click();
      const textarea = page.locator('#savecode-copy-text');
      await textarea.waitFor({ state: 'visible', timeout: 2000 });
      const code = await textarea.inputValue();
      await page.locator('#btn-savecode-close').click();
      return code;
    }
  } catch (err) {
    return `export_error: ${(err as Error).message}`;
  }
  return 'no_menu_button';
}

async function runSaveRoundTrip(page: Page, isRaid: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const before = await page.evaluate(() => {
      const w = window as any;
      const e = w.__cotwEngine;
      const p = e.player;
      let countdown: number | null = null;
      if (e.manifest?.timedEvents) {
        for (const def of e.manifest.timedEvents) {
          if (e.getWorldFlag(def.startFlag) && (!def.resolvedFlag || !e.getWorldFlag(def.resolvedFlag))) {
            const start = e.getWorldCounter(`timed_event_start:${def.id}`);
            countdown = Math.max(0, def.turnLimit - (e.turnCount - start));
            break;
          }
        }
      }
      return {
        x: p.x,
        y: p.y,
        hp: p.hp,
        inv: p.inventory.getAllCarriedItems().map((i: any) => i.definitionId).sort(),
        floor: e.currentFloor,
        turn: e.turnCount,
        lit: Boolean(e.map.lit),
        hpFloor: p.hpFloor ?? 0,
        countdown,
      };
    });

    // Save and exit
    const menuBtn = page.locator('#btn-save-title');
    await menuBtn.click();
    const saveExitBtn = page.locator('#btn-savequit-save-exit');
    await saveExitBtn.waitFor({ state: 'visible', timeout: 2000 });
    await saveExitBtn.click();

    // Continue
    const continueBtn = page.locator('#btn-menu-continue');
    await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await continueBtn.click();

    // Wait for engine restore
    await page.waitForFunction(
      () => {
        const w = window as any;
        return Boolean(w.__cotwEngine?.player) && !w.__cotwInputHandler?.isInputLocked;
      },
      { timeout: 10000 }
    );

    const after = await page.evaluate(() => {
      const w = window as any;
      const e = w.__cotwEngine;
      const p = e.player;
      let countdown: number | null = null;
      if (e.manifest?.timedEvents) {
        for (const def of e.manifest.timedEvents) {
          if (e.getWorldFlag(def.startFlag) && (!def.resolvedFlag || !e.getWorldFlag(def.resolvedFlag))) {
            const start = e.getWorldCounter(`timed_event_start:${def.id}`);
            countdown = Math.max(0, def.turnLimit - (e.turnCount - start));
            break;
          }
        }
      }
      return {
        x: p.x,
        y: p.y,
        hp: p.hp,
        inv: p.inventory.getAllCarriedItems().map((i: any) => i.definitionId).sort(),
        floor: e.currentFloor,
        turn: e.turnCount,
        lit: Boolean(e.map.lit),
        hpFloor: p.hpFloor ?? 0,
        countdown,
      };
    });

    if (before.x !== after.x || before.y !== after.y) {
      return { success: false, error: `Position changed from ${before.x},${before.y} to ${after.x},${after.y}` };
    }
    if (before.hp !== after.hp) {
      return { success: false, error: `HP changed from ${before.hp} to ${after.hp}` };
    }
    if (before.floor !== after.floor) {
      return { success: false, error: `Floor changed from ${before.floor} to ${after.floor}` };
    }
    if (before.turn !== after.turn) {
      return { success: false, error: `Turn changed from ${before.turn} to ${after.turn}` };
    }
    if (JSON.stringify(before.inv) !== JSON.stringify(after.inv)) {
      return { success: false, error: 'Inventory changed after reload' };
    }
    if (isRaid) {
      if (after.lit) {
        return { success: false, error: 'Town is not dark after raid reload' };
      }
      if (after.hpFloor <= 0) {
        return { success: false, error: 'HP floor not re-applied after raid reload' };
      }
      if (before.countdown !== after.countdown) {
        return {
          success: false,
          error: `Countdown mismatch after raid reload: was ${before.countdown}, now ${after.countdown}`,
        };
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

test.describe('soak @soak', () => {
  test('overnight soak playtest run', async ({ page, context }) => {
    test.setTimeout(300_000); // 5 minutes per test invocation

    expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

    const seed = parseInt(process.env.SOAK_SEED ?? '42', 10);
    const policy = (process.env.SOAK_POLICY ?? 'chaos') as SoakPolicy;
    const maxActions = parseInt(process.env.SOAK_ACTIONS ?? '1500', 10);
    const outBase = process.env.SOAK_OUT ?? resolve(process.cwd(), '.prompts', 'soak', policy);
    const defaultOpening: SoakOpening = policy === 'chaos' ? (seed % 2 === 0 ? 'play' : 'skip') : 'play';
    const opening: SoakOpening = (process.env.SOAK_OPENING as SoakOpening) ?? defaultOpening;

    const seedDir = join(outBase, String(seed));
    mkdirSync(seedDir, { recursive: true });

    const actionsLogPath = join(seedDir, 'actions.jsonl');
    const findingsLogPath = join(outBase, 'findings.jsonl');
    const summaryPath = join(seedDir, 'summary.json');

    // Reset log files for this seed
    writeFileSync(actionsLogPath, '');

    const consoleErrors: Array<{ type: string; text: string; stack?: string }> = [];
    const pageErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ type: 'error', text: msg.text() });
      } else if (msg.type() === 'warn') {
        consoleErrors.push({ type: 'warn', text: msg.text() });
      }
    });

    // Start tracing in chunks
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.tracing.startChunk();
    let lastChunkTime = Date.now();

    // 1. Set fixed time BEFORE goto (ARCHITECTURE §7.2 determinism)
    await page.clock.setFixedTime(seed);
    const prng = new SoakPrng(seed);

    await page.goto(URL);

    // 2. Embark
    await page.locator('#btn-menu-new-game').click();
    // Reduce rolled attributes so milestone does not take keyboard mid-character-creation
    for (const attr of ['str', 'dex', 'con', 'int']) {
      for (let i = 0; i < 6; i++) {
        await page.locator(`#btn-dec-${attr}`).click();
      }
    }
    await page.locator('#btn-create-embark').click();

    if (opening === 'play') {
      // Answer controls note with button or key
      await expect(page.locator('#controls-primer')).toBeVisible({ timeout: 5000 });
      if (policy === 'chaos') {
        const toggleHide = prng.next() < 0.5;
        if (toggleHide) {
          await page.locator('#controls-primer-hide').click();
        }
      }
      const closeWithButton = prng.next() < 0.5;
      if (closeWithButton) {
        await page.locator('#controls-primer-begin').click();
      } else {
        await page.locator('#controls-primer-hide').blur();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('#controls-primer')).toBeHidden();
    } else {
      await pastTheOpening(page);
    }

    const oracleState = createInitialOracleState();
    const latencies: number[] = [];
    let actionsPlayed = 0;
    let causeOfDeath: string | null = null;
    let runTerminated = false;
    let firstFindingObserved = false;
    let messagesSeenCount = 0;

    const recordFindingAndArtifacts = async (finding: Finding) => {
      // Append finding line
      appendFileSync(findingsLogPath, JSON.stringify(finding) + '\n');

      // Screenshot
      const shotPath = join(seedDir, `f${finding.action}.png`);
      try {
        await page.screenshot({ path: shotPath });
      } catch {
        // ignore if page crashed
      }

      // Trace chunk
      const tracePath = join(seedDir, `f${finding.action}.zip`);
      try {
        await context.tracing.stopChunk({ path: tracePath });
        await context.tracing.startChunk();
        lastChunkTime = Date.now();
      } catch {
        // ignore
      }

      if (!firstFindingObserved) {
        firstFindingObserved = true;
        // Take save code snapshot at first finding
        const saveCode = await exportSaveCode(page);
        writeFileSync(join(seedDir, `save-${finding.action}.txt`), saveCode);
      }
    };

    // Main action loop
    for (let i = 0; i < maxActions; i++) {
      if (runTerminated) break;

      // Rotate tracing chunk every 30s so trace chunk holds the last <= 30s
      if (Date.now() - lastChunkTime > 30_000) {
        try {
          await context.tracing.stopChunk();
          await context.tracing.startChunk();
          lastChunkTime = Date.now();
        } catch {
          // ignore
        }
      }

      // Check input lock (5s cap -> softlock)
      const lockStartTime = Date.now();
      let inputLocked = true;
      try {
        await expect
          .poll(() => page.evaluate(() => Boolean((window as any).__cotwInputHandler?.isInputLocked)), {
            timeout: 5000,
            intervals: [50],
          })
          .toBe(false);
        inputLocked = false;
      } catch {
        inputLocked = true;
      }

      if (inputLocked) {
        const softlockFinding: Finding = {
          sig: normalizeSignature('softlock', 'Input stayed locked for more than 5s', 'inputHandler.ts'),
          category: 'softlock',
          severity: 'S1',
          lens: policy,
          seed,
          opening,
          sha: gitSha,
          action: i,
          turn: oracleState.lastNoOpState?.turn ?? 0,
          floor: oracleState.currentFloor,
          detail: `Input stayed locked for ${Date.now() - lockStartTime}ms`,
          lastActions: `${seed}/actions.jsonl#L${Math.max(1, i - 12)}-${i}`,
          screenshot: `${seed}/f${i}.png`,
          trace: `${seed}/f${i}.zip`,
          save: `${seed}/save-${Math.max(0, Math.floor(i / 100) * 100)}.txt`,
          repro: `SOAK=1 SOAK_SEED=${seed} SOAK_POLICY=${policy} SOAK_OPENING=${opening} SOAK_ACTIONS=${i + 1} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`,
        };
        await recordFindingAndArtifacts(softlockFinding);
        runTerminated = true;
        break;
      }

      // Fetch pre-action state
      const preState = await page.evaluate(() => {
        const w = window as any;
        const e = w.__cotwEngine;
        if (!e || !e.player) return null;
        return {
          x: e.player.x,
          y: e.player.y,
          hp: e.player.hp,
          mana: e.player.mana,
          turn: e.turnCount,
          floor: e.currentFloor,
          stack: w.__cotwInputHandler?.modalStack?.getStackIds?.() ?? [],
          carried: e.player.inventory?.getAllCarriedItems?.()?.length ?? 0,
          isAlive: e.player.isAlive(),
          gameOver: Boolean(document.getElementById('game-over-modal')?.style?.display === 'flex'),
        };
      });

      if (!preState || !preState.isAlive || preState.gameOver) {
        causeOfDeath = preState ? (preState.isAlive ? null : 'fallen') : 'crash';
        runTerminated = true;
        break;
      }

      // Choose action under policy
      let action: DispatchedAction;
      if (policy === 'chaos') {
        action = await decideChaosAction({ page, prng, actionIndex: i });
      } else if (policy === 'player') {
        action = await decidePlayerAction({ page, prng, actionIndex: i });
      } else {
        // ui-sweep handles its own sweep or falls back to chaos
        action = await decideChaosAction({ page, prng, actionIndex: i });
      }

      // Dispatch action and measure latency
      const dispatchStart = Date.now();
      if (action.type === 'key') {
        await page.keyboard.press(action.key);
        if (action.secondaryKey) {
          await page.keyboard.press(action.secondaryKey);
        }
      } else if (action.type === 'click') {
        await page.mouse.click(action.x, action.y);
      }
      const latencyMs = Date.now() - dispatchStart;
      latencies.push(latencyMs);

      // Log action to actions.jsonl
      const logEntry: ActionLogEntry = {
        i,
        turn: preState.turn,
        key: action.type === 'key' ? action.key : undefined,
        click: action.type === 'click' ? { x: action.x, y: action.y } : undefined,
        pos: { x: preState.x, y: preState.y },
        hp: preState.hp,
        floor: preState.floor,
        stack: preState.stack,
      };
      appendFileSync(actionsLogPath, JSON.stringify(logEntry) + '\n');
      actionsPlayed++;

      // Run oracles
      const actionCtx: ActionContext = {
        actionIndex: i,
        seed,
        policy,
        opening,
        sha: gitSha,
        dispatchedInput: action.type === 'key' ? { key: action.key } : { click: { x: action.x, y: action.y } },
        latencyMs,
        stackBefore: preState.stack,
        turnBefore: preState.turn,
        hpBefore: preState.hp,
        manaBefore: preState.mana,
        posBefore: { x: preState.x, y: preState.y },
        carriedBefore: preState.carried,
        messagesSeenCount,
      };

      const findings = await runOracles(page, actionCtx, oracleState, consoleErrors, pageErrors);
      consoleErrors.length = 0; // drain captured errors
      pageErrors.length = 0;

      // Update messages seen count
      messagesSeenCount = await page.evaluate(() => (window as any).__cotwEngine?.messages?.length ?? 0);

      // Record any findings
      for (const finding of findings) {
        await recordFindingAndArtifacts(finding);
      }

      // Periodic snapshots: every 100 actions
      if (i > 0 && i % 100 === 0) {
        const saveCode = await exportSaveCode(page);
        writeFileSync(join(seedDir, `save-${i}.txt`), saveCode);
        await page.screenshot({ path: join(seedDir, `snap-${i}.png`) });
      }

      // Save round-trip: every 250 actions, and during raid
      const isRaid = preState.floor === 0 && !oracleState.raidEndedObserved;
      const shouldDoRaidRoundtrip = isRaid && !oracleState.lastRaidSaveRoundtripDone && i >= 10;
      const shouldDo250Roundtrip = i > 0 && i % 250 === 0;

      if (shouldDo250Roundtrip || shouldDoRaidRoundtrip) {
        if (shouldDoRaidRoundtrip) oracleState.lastRaidSaveRoundtripDone = true;
        const roundtripRes = await runSaveRoundTrip(page, isRaid);
        if (!roundtripRes.success) {
          const saveBugFinding: Finding = {
            sig: normalizeSignature('bug', `save round-trip digest mismatch: ${roundtripRes.error}`, 'serializer.ts'),
            category: 'bug',
            severity: 'S1',
            lens: policy,
            seed,
            opening,
            sha: gitSha,
            action: i,
            turn: preState.turn,
            floor: preState.floor,
            detail: `Save round-trip failed: ${roundtripRes.error}`,
            lastActions: `${seed}/actions.jsonl#L${Math.max(1, i - 12)}-${i}`,
            screenshot: `${seed}/f${i}.png`,
            trace: `${seed}/f${i}.zip`,
            save: `${seed}/save-${Math.max(0, Math.floor(i / 100) * 100)}.txt`,
            repro: `SOAK=1 SOAK_SEED=${seed} SOAK_POLICY=${policy} SOAK_OPENING=${opening} SOAK_ACTIONS=${i + 1} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`,
          };
          await recordFindingAndArtifacts(saveBugFinding);
        }
      }
    }

    // Calculate latency percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    const maxLatency = latencies[latencies.length - 1] ?? 0;

    // Count findings by category
    const findingCounts = { bug: 0, softlock: 0, text: 0, ux: 0 };
    for (const sig of oracleState.seenSignatures) {
      if (sig.startsWith('bug|')) findingCounts.bug++;
      else if (sig.startsWith('softlock|')) findingCounts.softlock++;
      else if (sig.startsWith('text|')) findingCounts.text++;
      else if (sig.startsWith('ux|')) findingCounts.ux++;
    }

    const turnsPlayed = await page.evaluate(() => (window as any).__cotwEngine?.turnCount ?? 0);
    const deepestFloor = await page.evaluate(
      () => (window as any).__cotwEngine?.gameState?.deepestFloor ?? (window as any).__cotwEngine?.currentFloor ?? 0
    );

    const summary: SoakSummary = {
      seed,
      lens: policy,
      opening,
      sha: gitSha,
      turnsPlayed,
      deepestFloor,
      causeOfDeath,
      wallTimeMs: latencies.reduce((a, b) => a + b, 0),
      actionsPlayed,
      latency: {
        p50,
        p95,
        max: maxLatency,
      },
      findingCounts,
      raid: {
        ending: oracleState.raidEndedReason,
        villagersFreed: Object.keys(oracleState.villagersFreed).length,
        villagerTurns: oracleState.villagersFreed,
        turnsUsed: Math.min(72, turnsPlayed),
        drinkCueShowed: oracleState.drinkCueShowed,
        potionDrunk: oracleState.potionDrunk,
        raidLogLines: messagesSeenCount,
      },
      deadKeys: oracleState.deadKeyCount,
      unexpectedInterruptions: oracleState.spontaneousModalCount,
    };

    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    try {
      await context.tracing.stop();
    } catch {
      // ignore
    }
  });
});
