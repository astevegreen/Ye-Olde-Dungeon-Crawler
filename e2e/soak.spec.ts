import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { pastTheOpening } from './newHero';
import { SoakPrng } from './soak/prng';
import { decideChaosAction, decidePlayerAction, type DispatchedAction } from './soak/policies';
import { classifyDeath } from './soak/playerBot';
import {
  createInitialOracleState,
  openModes,
  readBoundKeys,
  runOracles,
  tapEngineLog,
  normalizeSignature,
  type ActionContext,
} from './soak/oracles';
import type { Finding, FindingCategory, FindingSeverity, ActionLogEntry, SoakSummary, SoakPolicy, SoakOpening } from './soak/types';

/**
 * One overnight soak run (`SOAK=1`; kept out of the gate suite by playwright.config.ts).
 * A seeded bot plays one hero through real input and checks the game after every action;
 * scripts/soak.mjs loops it over seeds. See .prompts/overnight-playtest-prompt.md.
 */

const BUNDLE = resolve(process.cwd(), 'dist', 'index.html');
const URL = process.env.WHOLE_RUN_URL ?? pathToFileURL(BUNDLE).href;

/** Screenshots and traces per run, at most: one per signature new to the lens's findings.jsonl. */
const MAX_ARTIFACTS = 25;

let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  // not a checkout
}

/**
 * `Date.now()` is a browser run's only entropy (profile-manager.ts `runPrng`, title-screen.ts
 * `rollPrng`), so it reads `seed` until the hero exists, which fixes the dungeon, the rolls
 * and the loot. Then it runs on from `seed` in real time: choice dialogs time their
 * 200 ms key guard with `Date.now()`, and a clock that never moves would hold it shut.
 */
async function seedTheClock(page: Page, seed: number): Promise<void> {
  await page.addInitScript((s: number) => {
    const realNow = Date.now.bind(Date);
    let releasedAt: number | null = null;
    Date.now = () => (releasedAt === null ? s : s + (realNow() - releasedAt));
    (window as any).__soakReleaseClock = () => {
      if (releasedAt === null) releasedAt = realNow();
    };
  }, seed);
}

/** The hero died or won on the last action. The game-over screen is a screen, not a
 *  modal (gameOverDialog.ts), so an empty modal stack doesn't mean Save is reachable. */
const runOver = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine as any;
    return !e?.player?.isAlive() || (e.gameState?.runStatus ?? 'active') !== 'active';
  });

async function exportSaveCode(page: Page): Promise<string> {
  if (await page.evaluate(() => (window.__cotwInputHandler?.modalStack?.size ?? 0) > 0)) return 'modal_open';
  if (await runOver(page)) return 'run_over';
  try {
    await page.locator('#btn-save-title').click({ timeout: 2000 });
    await page.locator('#btn-savequit-copy-code').click({ timeout: 2000 });
    const textarea = page.locator('#savecode-copy-text');
    await textarea.waitFor({ state: 'visible', timeout: 2000 });
    const code = await textarea.inputValue();
    await page.locator('#btn-savecode-close').click({ timeout: 2000 });
    if (await page.locator('#btn-savequit-resume').isVisible()) await page.locator('#btn-savequit-resume').click({ timeout: 2000 });
    return code;
  } catch (err) {
    return `export_error: ${(err as Error).message}`;
  }
}

const digest = (page: Page) =>
  page.evaluate(() => {
    const e = window.__cotwEngine as any;
    const p = e.player;
    let countdown: number | null = null;
    for (const def of e.manifest?.timedEvents ?? []) {
      if (!e.getWorldFlag(def.startFlag) || (def.resolvedFlag && e.getWorldFlag(def.resolvedFlag))) continue;
      const ticked = e.getWorldFlag(`timed_event_started:${def.id}`);
      const start = ticked ? e.getWorldCounter(`timed_event_start:${def.id}`) : e.turnCount;
      countdown = Math.max(0, def.turnLimit - (e.turnCount - start));
      break;
    }
    return {
      pos: `${p.x},${p.y}`,
      hp: p.hp,
      // By name, so an item lost or changed shows; the definition ids are compared on their own.
      inv: p.inventory.getAllCarriedItems().map((i: any) => `${i.name}${i.quantity > 1 ? ' x' + i.quantity : ''}`).sort() as string[],
      defIds: p.inventory.getAllCarriedItems().filter((i: any) => i.definitionId).length as number,
      floor: e.currentFloor,
      turn: e.turnCount,
      lit: Boolean(e.map.lit),
      hpFloor: p.hpFloor ?? 0,
      countdown,
    };
  });

/** Save and exit, Continue, and compare. The raid's dark and HP floor are re-applied on load, not saved. */
async function saveRoundTrip(page: Page, inRaid: boolean): Promise<string | null> {
  try {
    const before = await digest(page);
    await page.locator('#btn-save-title').click({ timeout: 2000 });
    await page.locator('#btn-savequit-save-exit').click({ timeout: 2000 });
    await page.locator('#btn-menu-continue').click({ timeout: 5000 });
    await page.waitForFunction(() => Boolean(window.__cotwEngine?.player) && !window.__cotwInputHandler?.isInputLocked, null, { timeout: 10_000 });
    await tapEngineLog(page);
    const after = await digest(page);
    const diffs: string[] = [];
    for (const k of ['pos', 'hp', 'floor', 'turn'] as const) if (before[k] !== after[k]) diffs.push(`${k} ${before[k]} -> ${after[k]}`);
    if (after.defIds < before.defIds) diffs.push(`items carrying a definitionId ${before.defIds} -> ${after.defIds}`);
    if (JSON.stringify(before.inv) !== JSON.stringify(after.inv)) {
      diffs.push(`inventory lost [${before.inv.filter((i) => !after.inv.includes(i))}] gained [${after.inv.filter((i) => !before.inv.includes(i))}]`);
    }
    if (inRaid) {
      if (after.lit) diffs.push('town lit after continuing mid-raid');
      if (after.hpFloor <= 0) diffs.push('HP floor gone after continuing mid-raid');
      if (before.countdown !== after.countdown) diffs.push(`countdown ${before.countdown} -> ${after.countdown}`);
    }
    return diffs.length ? diffs.join('; ') : null;
  } catch (err) {
    return `round trip did not complete: ${(err as Error).message.split('\n')[0]}`;
  }
}

test.describe('soak @soak', () => {
  test('overnight soak playtest run', async ({ page, context }) => {
    const seed = parseInt(process.env.SOAK_SEED ?? '42', 10);
    const policy = (process.env.SOAK_POLICY ?? 'chaos') as SoakPolicy;
    const maxActions = parseInt(process.env.SOAK_ACTIONS ?? '1500', 10);
    const outBase = process.env.SOAK_OUT ?? resolve(process.cwd(), '.prompts', 'soak', policy);
    const opening: SoakOpening =
      (process.env.SOAK_OPENING as SoakOpening | undefined) ?? (policy === 'chaos' && seed % 2 === 1 ? 'skip' : 'play');

    // About 0.2 s an action, plus round trips; a run that hits this still writes its summary.
    test.setTimeout(120_000 + maxActions * 500);
    if (!process.env.WHOLE_RUN_URL) expect(existsSync(BUNDLE), `${BUNDLE} is missing; run \`npm run build\` first`).toBe(true);

    const seedDir = join(outBase, String(seed));
    mkdirSync(seedDir, { recursive: true });
    const actionsLogPath = join(seedDir, 'actions.jsonl');
    const findingsLogPath = join(outBase, 'findings.jsonl');
    writeFileSync(actionsLogPath, '');
    // Signatures an earlier run already holds evidence for: this run records them, without
    // another screenshot or trace. One night repeats the same few bugs on every seed.
    const evidenced = new Set<string>(
      existsSync(findingsLogPath)
        ? readFileSync(findingsLogPath, 'utf-8').split('\n').filter(Boolean).flatMap((l) => {
            try {
              const f = JSON.parse(l) as Finding;
              return f.screenshot.endsWith('.png') ? [f.sig] : [];
            } catch {
              return [];
            }
          })
        : []
    );

    const consoleErrors: Array<{ type: string; text: string; stack?: string }> = [];
    const pageErrors: Array<{ message: string; stack?: string }> = [];
    page.on('pageerror', (err) => pageErrors.push({ message: err.message, stack: err.stack }));
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type() === 'warning' ? 'warn' : 'error', text: msg.text() });
      }
    });

    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.tracing.startChunk();
    let chunkStartedAt = 0;

    const prng = new SoakPrng(seed);
    await seedTheClock(page, seed);
    await page.goto(URL);

    await page.locator('#btn-menu-new-game').click();
    // The player bot keeps its roll, as a player would: lowering every stat by 6 left it a
    // hero the raid struck down by turn 15 in 19 of 20 runs. Milestones from a 15 wait for
    // the raid to end (d74cbf5). Chaos keeps the roll half the time and plays the weak hero
    // the other half.
    const keepRoll = policy === 'player' || (policy === 'chaos' && prng.next() < 0.5);
    if (!keepRoll) {
      for (const attr of ['str', 'dex', 'con', 'int']) {
        for (let i = 0; i < 6; i++) await page.locator(`#btn-dec-${attr}`).click();
      }
    }
    await page.locator('#btn-create-embark').click();
    await expect.poll(() => page.evaluate(() => Boolean(window.__cotwEngine?.player))).toBe(true);
    await page.evaluate(() => (window as any).__soakReleaseClock());
    await tapEngineLog(page);
    const boundKeys = await readBoundKeys(page);

    if (opening === 'play') {
      await expect(page.locator('#controls-primer')).toBeVisible({ timeout: 5000 });
      if (policy === 'chaos' && prng.next() < 0.5) await page.locator('#controls-primer-hide').click();
      if (prng.next() < 0.5) {
        await page.locator('#controls-primer-begin').click();
      } else {
        await page.locator('#controls-primer-begin').focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('#controls-primer')).toBeHidden();
    } else {
      await pastTheOpening(page);
    }

    const canvas = await page.locator('#game-canvas').boundingBox();
    const oracleState = createInitialOracleState(boundKeys);
    const runStartedAt = Date.now();
    const latencies: number[] = [];
    const runSigs = new Map<string, { category: FindingCategory; severity: FindingSeverity; count: number }>();
    let artifacts = 0;
    let actionsPlayed = 0;
    let messagesSeen = await page.evaluate(() => (window as any).__soakLogTotal ?? 0);
    let causeOfDeath: string | null = null;
    let endedBy = 'action cap';
    let lastHere = '';
    let stillStreak = 0;
    let lastTop: string | null = null;
    let topStreak = 0;

    const repro = (i: number) =>
      `SOAK=1 SOAK_SEED=${seed} SOAK_POLICY=${policy} SOAK_OPENING=${opening} SOAK_ACTIONS=${i + 1} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`;
    const harnessFinding = (i: number, turn: number, floor: number, category: FindingCategory, severity: FindingSeverity, detail: string, frame?: string): Finding => ({
      sig: normalizeSignature(category, detail, frame),
      category,
      severity,
      lens: policy,
      seed,
      opening,
      sha: gitSha,
      action: i,
      turn,
      floor,
      detail,
      lastActions: `${seed}/actions.jsonl#L${Math.max(1, i - 12)}-${i + 1}`,
      screenshot: `${seed}/f${i}.png`,
      trace: `${seed}/f${i}.zip`,
      save: `${seed}/save-${Math.floor(i / 100) * 100}.txt`,
      repro: repro(i),
    });

    /** The first time a signature shows up in this run it is written out with evidence; after that it is counted. */
    const record = async (finding: Finding) => {
      const seen = runSigs.get(finding.sig);
      if (seen) {
        seen.count++;
        return;
      }
      runSigs.set(finding.sig, { category: finding.category, severity: finding.severity, count: 1 });
      // Evidence by weight: a trace (the last <= 30 s) for bugs and softlocks, a screenshot
      // for text, and the detail line alone for player-experience notes.
      const wantsTrace = finding.category === 'bug' || finding.category === 'softlock';
      const wantsShot = wantsTrace || finding.category === 'text';
      if (!wantsShot) {
        finding.screenshot = finding.trace = '(none for this category)';
      } else if (evidenced.has(finding.sig)) {
        finding.screenshot = finding.trace = '(evidence in an earlier run of this signature)';
      } else if (artifacts >= MAX_ARTIFACTS) {
        finding.screenshot = finding.trace = '(artifact cap reached)';
      } else {
        artifacts++;
        await page.screenshot({ path: join(seedDir, `f${finding.action}.png`) }).catch(() => undefined);
        if (wantsTrace) {
          await context.tracing.stopChunk({ path: join(seedDir, `f${finding.action}.zip`) }).catch(() => undefined);
          await context.tracing.startChunk().catch(() => undefined);
          chunkStartedAt = finding.action;
        } else {
          finding.trace = '(screenshot only)';
        }
      }
      if (runSigs.size === 1) writeFileSync(join(seedDir, `save-first-finding.txt`), await exportSaveCode(page));
      appendFileSync(findingsLogPath, JSON.stringify(finding) + '\n');
    };

    const writeSummary = async (partial: boolean) => {
      const sorted = [...latencies].sort((a, b) => a - b);
      const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
      const state = await page
        .evaluate(() => {
          const e = window.__cotwEngine as any;
          return { turn: e?.turnCount ?? 0, floor: e?.currentFloor ?? 0, attack: e?.player?.attack ?? 0, defense: e?.player?.defense ?? 0 };
        })
        .catch(() => ({ turn: -1, floor: -1, attack: 0, defense: 0 }));
      const findingCounts = { bug: 0, softlock: 0, text: 0, ux: 0 };
      for (const s of runSigs.values()) findingCounts[s.category]++;
      const summary: SoakSummary = {
        seed,
        lens: policy,
        opening,
        sha: gitSha,
        partial,
        endedBy,
        turnsPlayed: state.turn,
        deepestFloor: Math.max(state.floor, oracleState.currentFloor),
        causeOfDeath,
        wallTimeMs: Date.now() - runStartedAt,
        actionsPlayed,
        latency: { samples: sorted.length, p50: pct(0.5), p95: pct(0.95), max: sorted[sorted.length - 1] ?? 0 },
        findingCounts,
        findings: Object.fromEntries([...runSigs].map(([sig, s]) => [sig, s.count])),
        raid: {
          ending: oracleState.raidEndedReason ?? 'still running',
          villagersFreed: Object.keys(oracleState.villagersFreed).length,
          villagerTurns: oracleState.villagersFreed,
          turnsUsed: oracleState.raidEndTurn,
          drinkCueShowed: oracleState.drinkCueShowed,
          potionDrunk: oracleState.potionDrunk,
          raidLogLines: oracleState.raidLogLines,
        },
        deadKeys: oracleState.deadKeyCount,
        interruptions: oracleState.interruptions,
        stuckEpisodes: (page as any).__playerStuckEpisodes ?? 0,
        ...(policy === 'player'
          ? {
              gear: { ...((page as any).__playerGear ?? { equips: 0, purchases: 0, sales: 0, townTrip: 'none' }), attack: state.attack, defense: state.defense },
              ...((page as any).__playerTelemetry
                ? {
                    bot: {
                      ...(page as any).__playerTelemetry,
                      deathCause: endedBy === 'death' ? classifyDeath(causeOfDeath, (page as any).__playerTelemetry.last) : undefined,
                    },
                  }
                : {}),
            }
          : {}),
      };
      writeFileSync(join(seedDir, 'summary.json'), JSON.stringify(summary, null, 2));
    };

    try {
      for (let i = 0; i < maxActions; i++) {
        // A trace holds the last 30 actions or fewer (a few MB); by time it grew to 30 MB.
        if (i - chunkStartedAt >= 30) {
          await context.tracing.stopChunk().catch(() => undefined);
          await context.tracing.startChunk().catch(() => undefined);
          chunkStartedAt = i;
        }

        // Effects lock input while they play. More than 5 s is a softlock.
        const lockedSince = Date.now();
        const unlocked = await page
          .waitForFunction(() => !window.__cotwInputHandler?.isInputLocked, null, { timeout: 5000, polling: 50 })
          .then(() => true, () => false);
        if (!unlocked) {
          await record(harnessFinding(i, -1, oracleState.currentFloor, 'softlock', 'S1', `input stayed locked for ${Date.now() - lockedSince} ms`, 'input-handler.ts'));
          endedBy = 'softlock';
          break;
        }

        await tapEngineLog(page);
        const pre = await page.evaluate(() => {
          const w = window as any;
          const e = w.__cotwEngine;
          if (!e?.player) return null;
          const over = document.getElementById('game-over-modal');
          const crash = document.getElementById('crash-modal');
          return {
            crashed: !!crash && window.getComputedStyle(crash).display !== 'none',
            x: e.player.x as number,
            y: e.player.y as number,
            hp: e.player.hp as number,
            mana: e.player.mana as number,
            turn: e.turnCount as number,
            floor: e.currentFloor as number,
            stack: (w.__cotwInputHandler?.modalStack?.getStackIds?.() ?? []) as string[],
            alive: e.player.isAlive() as boolean,
            gameOver: !!over && window.getComputedStyle(over).display !== 'none',
            lastLines: ((w.__soakLogTail ?? []) as string[]).slice(-3),
          };
        });
        if (!pre) {
          await record(harnessFinding(i, -1, oracleState.currentFloor, 'bug', 'S1', 'the engine or its player disappeared'));
          endedBy = 'crash';
          break;
        }
        // A dialog the bot can't leave in 100 tries (Escape and Enter are a third of its keys).
        const top = pre.stack[pre.stack.length - 1] ?? null;
        topStreak = top !== null && top === lastTop ? topStreak + 1 : 0;
        lastTop = top;
        if (topStreak >= 100) {
          await record(harnessFinding(i, pre.turn, pre.floor, 'softlock', 'S1', `100 inputs could not leave <${top}>`, 'modalStack.ts'));
          endedBy = 'softlock';
          break;
        }
        // No progress on the open map: position and turn unchanged for 100 inputs, whatever
        // the log says. Each keypress logging "overburdened and cannot move" hid this from
        // the 25-input check, and a hero stood still for the last 943 actions of a run.
        const here = `${pre.floor}:${pre.x},${pre.y}:${pre.turn}`;
        stillStreak = pre.stack.length === 0 && here === lastHere ? stillStreak + 1 : 0;
        lastHere = here;
        if (stillStreak >= 100) {
          await record(harnessFinding(i, pre.turn, pre.floor, 'softlock', 'S2', `no progress in 100 inputs on the open map; the log says: "${pre.lastLines[pre.lastLines.length - 1] ?? ''}"`));
          endedBy = 'no progress';
          break;
        }
        if (pre.crashed) {
          // The game's own error boundary is up (diagnostic-modal.ts); the pageerror behind it
          // was recorded on the action that raised it. Nothing after this is a real game.
          endedBy = 'crash dialog';
          break;
        }
        if (!pre.alive || pre.gameOver) {
          causeOfDeath = pre.lastLines.join(' | ');
          endedBy = 'death';
          break;
        }

        const modesBefore = await openModes(page);
        let action: DispatchedAction;
        const policyCtx = { page, prng, actionIndex: i, boundKeys, canvas, inDialog: pre.stack.length > 0 || modesBefore.length > 0 };
        if (policy === 'player') action = await decidePlayerAction(policyCtx);
        else action = await decideChaosAction(policyCtx); // ui-sweep is A-sweep's; chaos until then

        // Latency from keypress to the game answering, for map keys on the open map.
        const measuredKey = action.type === 'key' && !policyCtx.inDialog && boundKeys.map.has(action.key) ? action.key : null;
        const pressedAt = Date.now();
        if (action.type === 'key') {
          await page.keyboard.press(action.key);
          if (action.secondaryKey) await page.keyboard.press(action.secondaryKey);
        } else {
          await page.mouse.click(action.x, action.y);
        }
        if (measuredKey) {
          const answered = await page
            .waitForFunction(
              (b) => {
                const w = window as any;
                const e = w.__cotwEngine;
                return !e?.player || e.turnCount !== b.turn || e.player.x !== b.x || e.player.y !== b.y || (w.__soakLogTotal ?? 0) !== b.log;
              },
              { turn: pre.turn, x: pre.x, y: pre.y, log: messagesSeen },
              { timeout: 1000, polling: 10 }
            )
            .then(() => true, () => false);
          if (answered) {
            const ms = Date.now() - pressedAt;
            latencies.push(ms);
            if (ms > 250) await record(harnessFinding(i, pre.turn, pre.floor, 'ux', 'S4', `${measuredKey} took ${ms} ms to answer (over 250 ms)`));
          }
        }

        const entry: ActionLogEntry = {
          i,
          turn: pre.turn,
          key: action.type === 'key' ? action.key + (action.secondaryKey ? ` ${action.secondaryKey}` : '') : undefined,
          click: action.type === 'click' ? { x: action.x, y: action.y } : undefined,
          pos: { x: pre.x, y: pre.y },
          hp: pre.hp,
          floor: pre.floor,
          stack: [...pre.stack, ...modesBefore.map((m) => `mode:${m}`)],
        };
        appendFileSync(actionsLogPath, JSON.stringify(entry) + '\n');
        actionsPlayed++;

        const actionCtx: ActionContext = {
          actionIndex: i,
          seed,
          policy,
          opening,
          sha: gitSha,
          dispatchedInput: action.type === 'key' ? { key: action.key } : { click: { x: action.x, y: action.y } },
          stackBefore: pre.stack,
          modesBefore,
          turnBefore: pre.turn,
          hpBefore: pre.hp,
          manaBefore: pre.mana,
          posBefore: { x: pre.x, y: pre.y },
          messagesSeenCount: messagesSeen,
        };
        const findings = await runOracles(page, actionCtx, oracleState, consoleErrors.splice(0), pageErrors.splice(0));
        messagesSeen = await page.evaluate(() => (window as any).__soakLogTotal ?? 0);
        for (const f of findings) await record(f);

        if (i > 0 && i % 100 === 0) {
          writeFileSync(join(seedDir, `save-${i}.txt`), await exportSaveCode(page));
          await page.screenshot({ path: join(seedDir, `snap-${i}.png`) }).catch(() => undefined);
          await writeSummary(true);
        }

        // Save and continue: once mid-raid, then every 250 actions.
        const inRaid = await page.evaluate(
          () => Boolean(window.__cotwEngine?.getWorldFlag('cotw_prologue_started')) && !window.__cotwEngine?.getWorldFlag('cotw_prologue_ended')
        );
        const raidTrip = inRaid && !oracleState.lastRaidSaveRoundtripDone && i >= 10;
        if (raidTrip || (i > 0 && i % 250 === 0)) {
          if (raidTrip) oracleState.lastRaidSaveRoundtripDone = true;
          // Only from the bare map: the explored map (M) and look mode cover the header's
          // Save button without a modal-stack entry, and so does the game-over screen when
          // this action killed the hero.
          const bare =
            (await page.evaluate(() => (window.__cotwInputHandler?.modalStack?.size ?? 0) === 0)) &&
            (await openModes(page)).length === 0 &&
            !(await runOver(page));
          if (bare) {
            // A rest or click-travel runs on timers; the digest is taken before Save is
            // clicked, so let it finish first, or the save holds later turns than the digest.
            await page
              .waitForFunction(
                () => {
                  const h = window.__cotwInputHandler as any;
                  return !h?.autoRestRunner?.active && !h?.navigationController?.isNavigating;
                },
                null,
                { timeout: 8000 }
              )
              .catch(() => undefined);
            const mismatch = await saveRoundTrip(page, inRaid);
            if (mismatch) await record(harnessFinding(i, pre.turn, pre.floor, 'bug', 'S1', `save and continue changed the game: ${mismatch}`, 'serializer.ts'));
            messagesSeen = await page.evaluate(() => (window as any).__soakLogTotal ?? 0);
          } else if (raidTrip) {
            oracleState.lastRaidSaveRoundtripDone = false; // a dialog is open; try again next action
          }
        }
      }
    } finally {
      await writeSummary(false);
      await context.tracing.stop().catch(() => undefined);
    }
  });
});
