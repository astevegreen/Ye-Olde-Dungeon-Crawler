import type { Page } from '@playwright/test';
import type { Finding, FindingCategory, FindingSeverity, SoakOpening } from './types';

export interface ActionContext {
  actionIndex: number;
  seed: number;
  policy: string;
  opening: SoakOpening;
  sha: string;
  dispatchedInput: { key?: string; click?: { x: number; y: number } };
  latencyMs: number;
  stackBefore: string[];
  turnBefore: number;
  hpBefore: number;
  manaBefore: number;
  posBefore: { x: number; y: number };
  carriedBefore: number;
  messagesSeenCount: number;
}

export interface OracleState {
  lastCountdown: number | null;
  consecutiveNoOps: number;
  lastNoOpState: { pos: string; turn: number; log: string; stack: string } | null;
  raidEndedObserved: boolean;
  firstMoveAfterRaidDone: boolean;
  heldMilestonesOpened: number;
  villagersFreed: Record<string, number>;
  raidEndedReason?: string;
  drinkCueShowed: boolean;
  potionDrunk: boolean;
  turnsOnCurrentFloor: number;
  currentFloor: number;
  stairsFoundOnFloor: boolean;
  spontaneousModalCount: number;
  deadKeyCount: number;
  lastRaidSaveRoundtripDone: boolean;
  seenSignatures: Set<string>;
}

export function createInitialOracleState(): OracleState {
  return {
    lastCountdown: null,
    consecutiveNoOps: 0,
    lastNoOpState: null,
    raidEndedObserved: false,
    firstMoveAfterRaidDone: false,
    heldMilestonesOpened: 0,
    villagersFreed: {},
    drinkCueShowed: false,
    potionDrunk: false,
    turnsOnCurrentFloor: 0,
    currentFloor: 0,
    stairsFoundOnFloor: false,
    spontaneousModalCount: 0,
    deadKeyCount: 0,
    lastRaidSaveRoundtripDone: false,
    seenSignatures: new Set<string>(),
  };
}

export function normalizeSignature(category: FindingCategory, message: string, topFrame?: string): string {
  const norm = message
    .replace(/\b\d+\b/g, '#')
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<id>')
    .replace(/\b(prologue|monster|item|npc)-[a-z0-9_-]+/g, '<id>')
    .replace(/\s+/g, ' ')
    .trim();
  const frame = topFrame ? topFrame.replace(/.*[\\/]/, '') : 'unknown';
  return `${category}|${norm}|${frame}`;
}

export async function runOracles(
  page: Page,
  ctx: ActionContext,
  state: OracleState,
  consoleErrors: Array<{ type: string; text: string; stack?: string }>,
  pageErrors: string[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  const addFinding = (
    category: FindingCategory,
    severity: FindingSeverity,
    detail: string,
    topFrame?: string
  ) => {
    const sig = normalizeSignature(category, detail, topFrame);
    const finding: Finding = {
      sig,
      category,
      severity,
      lens: ctx.policy,
      seed: ctx.seed,
      opening: ctx.opening,
      sha: ctx.sha,
      action: ctx.actionIndex,
      turn: ctx.turnBefore, // updated below once state fetched
      floor: ctx.currentFloor ?? 0,
      detail,
      lastActions: `${ctx.seed}/actions.jsonl#L${Math.max(1, ctx.actionIndex - 12)}-${ctx.actionIndex}`,
      screenshot: `${ctx.seed}/f${ctx.actionIndex}.png`,
      trace: `${ctx.seed}/f${ctx.actionIndex}.zip`,
      save: `${ctx.seed}/save-${Math.max(0, Math.floor(ctx.actionIndex / 100) * 100)}.txt`,
      repro: `SOAK=1 SOAK_SEED=${ctx.seed} SOAK_POLICY=${ctx.policy} SOAK_OPENING=${ctx.opening} SOAK_ACTIONS=${ctx.actionIndex + 1} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`,
    };
    findings.push(finding);
    state.seenSignatures.add(sig);
  };

  // 1. Crash & Console Errors / Warnings
  for (const pErr of pageErrors) {
    addFinding('bug', 'S1', `pageerror: ${pErr}`);
  }
  for (const cErr of consoleErrors) {
    if (cErr.type === 'error') {
      addFinding('bug', 'S1', `console.error: ${cErr.text}`, cErr.stack);
    } else if (cErr.type === 'warn') {
      addFinding('bug', 'S3', `console.warn: ${cErr.text}`, cErr.stack);
    }
  }

  // 2. Fetch live state from page in single evaluate
  const live = await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    const h = w.__cotwInputHandler;
    if (!e || !e.player) return null;

    const p = e.player;
    const stack = h?.modalStack?.getStackIds?.() ?? [];

    // Check visible dialogs and canvas overlays
    const isTargetingOpen = Boolean(w.__cotwRenderer?.targetingOverlay?.isOpen);
    const isRadialOpen = Boolean(w.__cotwRenderer?.radialMenuOverlay?.isOpen);

    const dialogSelectors = [
      '.ui-dialog',
      '#game-over-modal',
      '#choice-modal-overlay',
      '#save-quit-modal',
      '#save-code-modal',
      '#character-menu-modal',
      '#controls-primer',
      '#shop-modal',
      '#shop-dialog',
      '#diagnostics-modal',
      '#feedback-modal',
      '#altar-modal',
      '#mastery-choice-modal',
      '#command-palette-overlay',
      '#rune-discovery-modal',
    ];
    const visibleDialogs: string[] = [];
    if (isTargetingOpen) visibleDialogs.push('targeting');
    if (isRadialOpen) visibleDialogs.push('radial-menu');

    for (const sel of dialogSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetWidth > 0) {
          visibleDialogs.push(sel);
        }
      }
    }

    // Active element focus check
    const activeEl = document.activeElement;
    const activeElTag = activeEl ? `${activeEl.tagName}#${activeEl.id}.${activeEl.className}` : 'null';
    let focusEscaped = false;
    if (stack.length > 0) {
      const topId = stack[stack.length - 1];
      if (topId === 'targeting' || topId === 'radial-menu') {
        // Canvas overlays don't have DOM modals; focus should remain on body or canvas
        if (activeEl && activeEl !== document.body && activeEl !== document.documentElement && activeEl.id !== 'game-canvas') {
          focusEscaped = true;
        }
      } else {
        const modalEl =
          document.getElementById(topId) ??
          document.getElementById(`${topId}-modal`) ??
          document.querySelector(`[id*="${topId}"]`) ??
          document.querySelector('.ui-dialog');
        if (activeEl && activeEl !== document.body && activeEl !== document.documentElement) {
          if (modalEl && !modalEl.contains(activeEl)) {
            focusEscaped = true;
          }
        }
      }
    }

    // Two entities share a tile check
    const allEntities = e.map.getAllEntities();
    const posCounts = new Map<string, string[]>();
    for (const ent of allEntities) {
      if (ent.isAlive ? ent.isAlive() : true) {
        const key = `${ent.x},${ent.y}`;
        const existing = posCounts.get(key) ?? [];
        existing.push(ent.id);
        posCounts.set(key, existing);
      }
    }
    const overlappingTiles: Array<{ pos: string; entities: string[] }> = [];
    for (const [pos, ents] of posCounts.entries()) {
      if (ents.length > 1) overlappingTiles.push({ pos, entities: ents });
    }

    // Check clipped text
    let clippedText: string | null = null;
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      clippedText = `Document scrollWidth (${document.documentElement.scrollWidth}) > innerWidth (${window.innerWidth})`;
    } else {
      const textEls = document.querySelectorAll('.ui-dialog-title, .ui-dialog-body, .sb-cond-name, .hud-key, .ui-note');
      for (const el of Array.from(textEls)) {
        if ((el as HTMLElement).offsetWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
          const style = window.getComputedStyle(el);
          if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') {
            clippedText = `Clipped text in ${el.className || el.tagName}: scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`;
            break;
          }
        }
      }
    }

    // Check raid countdown
    let countdownVal: number | null = null;
    if (e.manifest?.timedEvents) {
      for (const def of e.manifest.timedEvents) {
        if (e.getWorldFlag(def.startFlag) && (!def.resolvedFlag || !e.getWorldFlag(def.resolvedFlag))) {
          const start = e.getWorldCounter(`timed_event_start:${def.id}`);
          countdownVal = Math.max(0, def.turnLimit - (e.turnCount - start));
          break;
        }
      }
    }

    // Check raid entities
    const raidMonstersLeft = allEntities.filter(
      (m: any) => typeof m.id === 'string' && m.id.startsWith('prologue-monster-')
    ).length;
    const raidNpcsLeft = allEntities.filter(
      (n: any) => typeof n.id === 'string' && ['prologue-eir', 'prologue-dagr', 'prologue-alva'].includes(n.id)
    ).length;

    // Check potion cue
    const potionCue = document.querySelector('.potion-slot.hud-cue') !== null;

    // Current tile passable
    const currentTile = e.map.getTile(p.x, p.y);
    const tilePassable = currentTile ? currentTile.passable : true;

    return {
      turn: e.turnCount,
      floor: e.currentFloor,
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.maxHp,
      hpFloor: p.hpFloor ?? 0,
      mana: p.mana,
      maxMana: p.maxMana,
      gold: p.gold ?? 0,
      isAlive: p.isAlive(),
      stack,
      visibleDialogs,
      focusEscaped,
      activeElTag,
      overlappingTiles,
      clippedText,
      prologueEnded: Boolean(e.getWorldFlag('cotw_prologue_ended')),
      townLit: Boolean(e.map.lit),
      countdownVal,
      raidMonstersLeft,
      raidNpcsLeft,
      potionCue,
      tilePassable,
      messages: e.messages,
      eirSaved: Boolean(e.getWorldFlag('prologue-eir_saved')),
      dagrSaved: Boolean(e.getWorldFlag('prologue-dagr_saved')),
      alvaSaved: Boolean(e.getWorldFlag('prologue-alva_saved')),
    };
  });

  if (!live) {
    addFinding('bug', 'S1', 'window.__cotwEngine or player missing during oracle evaluation');
    return findings;
  }

  // Update context floor and turn
  for (const f of findings) {
    f.turn = live.turn;
    f.floor = live.floor;
  }

  // Check 1: Turn count moved while modal stack was non-empty before input
  if (ctx.stackBefore.length > 0 && live.turn !== ctx.turnBefore) {
    addFinding(
      'bug',
      'S2',
      `turn advanced under modal <${ctx.stackBefore.join(',')}> from ${ctx.turnBefore} to ${live.turn}`,
      'inputHandler.ts'
    );
  }

  // Check 2: Modal stack disagrees with DOM
  if (live.stack.length > 0 && live.visibleDialogs.length === 0) {
    addFinding(
      'bug',
      'S2',
      `modal stack has [${live.stack.join(',')}] but no visible dialog in DOM`,
      'modalStack.ts'
    );
  } else if (live.stack.length === 0 && live.visibleDialogs.some((d) => d.includes('.ui-dialog') || d.includes('game-over'))) {
    addFinding(
      'bug',
      'S2',
      `empty modal stack but visible dialog in DOM: ${live.visibleDialogs.join(',')}`,
      'modalStack.ts'
    );
  }

  // Check 3: Focus escaped modal
  if (live.focusEscaped) {
    addFinding(
      'bug',
      'S2',
      `focus escaped modal; active element is ${live.activeElTag}`,
      'modalStack.ts'
    );
  }

  // Check 4: Escape pressed with non-empty stack
  if (ctx.dispatchedInput.key === 'Escape' && ctx.stackBefore.length > 0) {
    const topModalBefore = ctx.stackBefore[ctx.stackBefore.length - 1];
    // Known exceptions: choice modal when non-cancelable or in 200ms debounce
    const isSpecialModal = topModalBefore.includes('choice') || topModalBefore.includes('game-over');
    if (!isSpecialModal && live.stack.length !== ctx.stackBefore.length - 1) {
      addFinding(
        'bug',
        'S2',
        `Escape was pressed on modal <${topModalBefore}> but stack went from ${ctx.stackBefore.length} to ${live.stack.length}`,
        'modalStack.ts'
      );
    }
  }

  // Check 5: Player state range
  if (Number.isNaN(live.hp) || (live.isAlive && live.hp < 0) || live.hp > live.maxHp) {
    addFinding('bug', 'S2', `player HP out of range: ${live.hp}/${live.maxHp}`);
  }
  if (Number.isNaN(live.mana) || live.mana < 0 || live.mana > live.maxMana) {
    addFinding('bug', 'S2', `player mana out of range: ${live.mana}/${live.maxMana}`);
  }
  if (live.gold < 0) {
    addFinding('bug', 'S2', `player gold is negative: ${live.gold}`);
  }
  if (!live.tilePassable) {
    addFinding('bug', 'S2', `hero stands on impassable tile at ${live.x},${live.y}`);
  }
  if (live.overlappingTiles.length > 0) {
    for (const ov of live.overlappingTiles) {
      addFinding('bug', 'S2', `two entities share tile at ${ov.pos}: [${ov.entities.join(',')}]`);
    }
  }

  // Check 6: The Opening Oracles
  if (!live.prologueEnded && live.floor === 0) {
    // Raid is running
    if (live.countdownVal !== null) {
      if (state.lastCountdown !== null) {
        if (live.countdownVal > state.lastCountdown) {
          addFinding('bug', 'S2', `raid countdown increased from ${state.lastCountdown} to ${live.countdownVal}`);
        } else if (state.lastCountdown - live.countdownVal > Math.max(1, live.turn - ctx.turnBefore)) {
          addFinding(
            'bug',
            'S2',
            `raid countdown decreased too fast: was ${state.lastCountdown}, now ${live.countdownVal}`
          );
        }
      }
      state.lastCountdown = live.countdownVal;
    }
    if (live.hp < 1) {
      addFinding('bug', 'S1', `hero HP dropped below 1 during raid: ${live.hp}`);
    }
    if (ctx.dispatchedInput.key === 'KeyR' && live.turn > ctx.turnBefore && live.hp > ctx.hpBefore) {
      addFinding('bug', 'S2', 'rest succeeded during active raid countdown');
    }
    if (live.potionCue) {
      state.drinkCueShowed = true;
    }
    if (state.drinkCueShowed && ctx.dispatchedInput.key?.includes('Digit') && live.hp > ctx.hpBefore) {
      state.potionDrunk = true;
    }
    // Villagers freed
    if (live.eirSaved && !state.villagersFreed.eir) state.villagersFreed.eir = live.turn;
    if (live.dagrSaved && !state.villagersFreed.dagr) state.villagersFreed.dagr = live.turn;
    if (live.alvaSaved && !state.villagersFreed.alva) state.villagersFreed.alva = live.turn;
  } else {
    // Raid has ended
    if (!state.raidEndedObserved) {
      state.raidEndedObserved = true;
      if (live.hpFloor > 0) {
        addFinding('bug', 'S1', `HP floor (${live.hpFloor}) not lifted after raid ended`);
      }
      if (live.floor === 0 && !live.townLit) {
        addFinding('bug', 'S2', 'town is dark after raid ended');
      }
      if (live.raidMonstersLeft > 0) {
        addFinding('bug', 'S2', `${live.raidMonstersLeft} raid monsters remain after raid ended`);
      }
      if (live.raidNpcsLeft > 0) {
        addFinding('bug', 'S2', `${live.raidNpcsLeft} raid captive NPCs remain after raid ended`);
      }
      if (live.countdownVal !== null && live.countdownVal > 0) {
        addFinding('bug', 'S2', 'countdown badge still active after raid ended');
      }
    }

    if (live.floor > 0 && live.hpFloor > 0) {
      addFinding('bug', 'S1', `HP floor followed hero into dungeon on floor ${live.floor}`);
    }
  }

  // Check 7: Softlocks
  if (live.stack.length === 0) {
    const currentStateKey = {
      pos: `${live.x},${live.y}`,
      turn: live.turn,
      log: live.messages.slice(-1)[0] ?? '',
      stack: live.stack.join(','),
    };
    if (
      state.lastNoOpState &&
      state.lastNoOpState.pos === currentStateKey.pos &&
      state.lastNoOpState.turn === currentStateKey.turn &&
      state.lastNoOpState.log === currentStateKey.log &&
      state.lastNoOpState.stack === currentStateKey.stack
    ) {
      state.consecutiveNoOps++;
      if (state.consecutiveNoOps >= 25) {
        addFinding(
          'softlock',
          'S1',
          '25 consecutive inputs with no modal open left position, turn, log, and stack all unchanged'
        );
      }
    } else {
      state.consecutiveNoOps = 0;
      state.lastNoOpState = currentStateKey;
    }
  } else {
    state.consecutiveNoOps = 0;
  }

  // Check 8: Text Oracles
  const newMessages = live.messages.slice(ctx.messagesSeenCount);
  for (let mIdx = 0; mIdx < newMessages.length; mIdx++) {
    const msg = newMessages[mIdx];
    // Forbidden debug tokens
    if (msg.includes('undefined') || msg.includes('NaN') || msg.includes('[object') || msg.includes('${') || msg.includes('{{')) {
      addFinding('text', 'S3', `raw token in log line: "${msg}"`);
    }
    // Doubled word
    if (/\b([A-Za-z]+)\s+\1\b/i.test(msg)) {
      addFinding('text', 'S3', `doubled word in log line: "${msg}"`);
    }
    // Leading lowercase letter
    if (/^[a-z]/.test(msg.trim())) {
      addFinding('text', 'S3', `leading lowercase letter in log line: "${msg}"`);
    }
    // "The " before proper name
    if (/\bThe\s+(Hallvard|Eir|Dagr|Alva|Bjarnarhaven|Níðhögg|Víðnir|Gálmr|Svartr|Sköll|Týr|Odin|Thor|Freya|Loki|Ivalda|Haugbui)\b/.test(msg)) {
      addFinding('text', 'S3', `sentence starts "The " before proper name: "${msg}"`);
    }
    // Raw content ID (snake_case)
    if (/\b[a-z]{2,}_[a-z0-9_]+\b/.test(msg)) {
      addFinding('text', 'S3', `raw snake_case content id in log line: "${msg}"`);
    }
    // Spam (same log line emitted > 3 times in a row)
    const history = live.messages.slice(Math.max(0, ctx.messagesSeenCount + mIdx - 3), ctx.messagesSeenCount + mIdx + 1);
    if (history.length >= 4 && history.every((line: string) => line === msg)) {
      addFinding('text', 'S3', `spam: same log line emitted > 3 times in a row: "${msg}"`);
    }
  }

  // Clipped text or horizontal scroll
  if (live.clippedText) {
    addFinding('text', 'S3', live.clippedText);
  }

  // Check 9: UX / Player experience
  // Dead key check
  const stateChanged =
    live.x !== ctx.posBefore.x ||
    live.y !== ctx.posBefore.y ||
    live.hp !== ctx.hpBefore ||
    live.mana !== ctx.manaBefore ||
    live.turn !== ctx.turnBefore ||
    newMessages.length > 0 ||
    live.stack.length > 0;

  if (!stateChanged && ctx.dispatchedInput.key) {
    const isRestRefusal = ctx.dispatchedInput.key === 'KeyR' && newMessages.some((m: string) => m.toLowerCase().includes('cannot rest') || m.toLowerCase().includes('refuse'));
    if (!isRestRefusal) {
      state.deadKeyCount++;
      addFinding('ux', 'S4', `dead key "${ctx.dispatchedInput.key}" produced no feedback or state change`);
    }
  }

  // Latency > 250ms
  if (ctx.latencyMs > 250) {
    addFinding('ux', 'S4', `action latency ${ctx.latencyMs}ms exceeded 250ms threshold`);
  }

  // Floor progression tracking
  if (live.floor !== state.currentFloor) {
    state.currentFloor = live.floor;
    state.turnsOnCurrentFloor = 0;
    state.stairsFoundOnFloor = false;
  } else {
    state.turnsOnCurrentFloor += Math.max(0, live.turn - ctx.turnBefore);
    if (state.turnsOnCurrentFloor > 300 && !state.stairsFoundOnFloor) {
      addFinding('ux', 'S4', `spent > 300 turns on floor ${live.floor} without finding stairs`);
    }
  }

  // Death in first 200 turns after raid
  if (!live.isAlive && live.prologueEnded && live.turn < 200) {
    const last20 = live.messages.slice(-20).join(' | ');
    addFinding('ux', 'S4', `death in first 200 turns after raid (turn ${live.turn}): ${last20}`);
  }

  return findings;
}
