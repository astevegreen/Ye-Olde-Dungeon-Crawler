import type { Page } from '@playwright/test';
import type { Finding, FindingCategory, FindingSeverity, SoakOpening } from './types';

export interface ActionContext {
  actionIndex: number;
  seed: number;
  policy: string;
  opening: SoakOpening;
  sha: string;
  dispatchedInput: { key?: string; click?: { x: number; y: number } };
  stackBefore: string[];
  /** Open modes (see `openModes`) before the input. */
  modesBefore: string[];
  turnBefore: number;
  hpBefore: number;
  manaBefore: number;
  posBefore: { x: number; y: number };
  messagesSeenCount: number;
}

/**
 * Modes that own the keyboard without a modal-stack entry: look mode (L/X), the explored
 * map (M), a shop, F1 help. Arrows move a cursor in them, so they are judged like dialogs.
 */
export const openModes = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const h = window.__cotwInputHandler as any;
    if (!h) return [];
    const modes: Array<[string, unknown]> = [
      ['inspect', h.inspectOverlay?.isOpen],
      ['map', h.mapOverlay?.isOpen],
      ['shop', h.shopOverlay?.isOpen],
      ['help', h.contextHelp?.isOpen],
    ];
    return modes.filter(([, open]) => open === true).map(([name]) => name);
  });

/** Keys the game binds, read from the page's settings once the hero exists. */
export interface BoundKeys {
  /** Every bound key, in the settings' own `Shift+Digit1` form, which is also Playwright's. */
  all: Set<string>;
  /** Keys that act on the map: movement and wait. Inside a dialog they must never spend a turn. */
  map: Set<string>;
  /** Keys bound to wait, for the passive-spam check. */
  wait: Set<string>;
}

export async function readBoundKeys(page: Page): Promise<BoundKeys> {
  const binds = await page.evaluate(
    () => (window.__cotwInputHandler as any)?.settingsManager?.getSettings?.().keybinds ?? {}
  ) as Record<string, string[]>;
  const all = new Set<string>();
  const map = new Set<string>();
  const wait = new Set<string>();
  for (const [actionId, codes] of Object.entries(binds)) {
    for (const code of codes) {
      all.add(code);
      if (actionId.startsWith('move_') || actionId === 'wait') map.add(code);
      if (actionId === 'wait') wait.add(code);
    }
  }
  return { all, map, wait };
}

/**
 * Counts every line the engine logs. `engine.messages` keeps only the last 150, so its
 * length stops moving; this tap wraps `engine.log` (reading, never changing, what it
 * logs) and is re-installed whenever Continue builds a new engine.
 */
export async function tapEngineLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    const e = w.__cotwEngine;
    if (!e || e.__soakTapped) return;
    w.__soakLogTotal ??= 0;
    w.__soakLogTail ??= [];
    const original = e.log.bind(e);
    e.log = (message: string) => {
      const result = original(message);
      // What the engine stored, which is what the player reads.
      w.__soakLogTotal++;
      w.__soakLogTail.push(e.messages[e.messages.length - 1] ?? message);
      if (w.__soakLogTail.length > 200) w.__soakLogTail.shift();
      return result;
    };
    e.__soakTapped = true;
  });
}

export interface OracleState {
  boundKeys: BoundKeys;
  lastCountdown: number | null;
  /** The turn `lastCountdown` was read on. Click-to-move keeps stepping between reads. */
  lastCountdownTurn: number;
  consecutiveNoOps: number;
  lastNoOpState: { pos: string; turn: number; log: string } | null;
  raidEndedObserved: boolean;
  raidEndedReason?: string;
  raidEndTurn: number | null;
  raidEndChecked: boolean;
  raidLogLines: number | null;
  villagersFreed: Record<string, number>;
  drinkCueShowed: boolean;
  potionDrunk: boolean;
  currentFloor: number;
  turnsOnCurrentFloor: number;
  stairsFoundOnFloor: boolean;
  interruptions: Record<string, number>;
  deadKeyCount: number;
  passiveSpam: { line: string; count: number } | null;
  lastRaidSaveRoundtripDone: boolean;
}

export function createInitialOracleState(boundKeys: BoundKeys): OracleState {
  return {
    boundKeys,
    lastCountdown: null,
    lastCountdownTurn: 0,
    consecutiveNoOps: 0,
    lastNoOpState: null,
    raidEndedObserved: false,
    raidEndTurn: null,
    raidEndChecked: false,
    raidLogLines: null,
    villagersFreed: {},
    drinkCueShowed: false,
    potionDrunk: false,
    currentFloor: 0,
    turnsOnCurrentFloor: 0,
    stairsFoundOnFloor: false,
    interruptions: {},
    deadKeyCount: 0,
    passiveSpam: null,
    lastRaidSaveRoundtripDone: false,
  };
}

/** The three held villagers (`PROLOGUE_VILLAGERS` in src/content/cotw/prologue.ts). */
const VILLAGERS = ['prologue-eir', 'prologue-sigrun', 'prologue-brandr'] as const;

/** Stack entries drawn on the canvas, with no DOM element of their own. */
const CANVAS_OVERLAYS = ['targeting', 'radial-menu'];

/** Dialogs the game opens on its own and the prompt expects: not interruptions. */
const EXPECTED_OPENERS = ['controls-primer'];

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

/** The first frame under src/ in a stack trace, for the signature. */
function srcFrame(stack?: string): string | undefined {
  return stack?.split('\n').find((l) => /[\\/]src[\\/]/.test(l))?.trim();
}

export async function runOracles(
  page: Page,
  ctx: ActionContext,
  state: OracleState,
  consoleErrors: Array<{ type: string; text: string; stack?: string }>,
  pageErrors: Array<{ message: string; stack?: string }>
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const modesAfter = await openModes(page);
  const inDialogBefore = ctx.stackBefore.length > 0 || ctx.modesBefore.length > 0;
  let curTurn = ctx.turnBefore;
  let curFloor = state.currentFloor;

  const addFinding = (category: FindingCategory, severity: FindingSeverity, detail: string, topFrame?: string) => {
    findings.push({
      sig: normalizeSignature(category, detail, topFrame),
      category,
      severity,
      lens: ctx.policy,
      seed: ctx.seed,
      opening: ctx.opening,
      sha: ctx.sha,
      action: ctx.actionIndex,
      turn: curTurn,
      floor: curFloor,
      detail,
      lastActions: `${ctx.seed}/actions.jsonl#L${Math.max(1, ctx.actionIndex - 12)}-${ctx.actionIndex + 1}`,
      screenshot: `${ctx.seed}/f${ctx.actionIndex}.png`,
      trace: `${ctx.seed}/f${ctx.actionIndex}.zip`,
      save: `${ctx.seed}/save-${Math.floor(ctx.actionIndex / 100) * 100}.txt`,
      repro: `SOAK=1 SOAK_SEED=${ctx.seed} SOAK_POLICY=${ctx.policy} SOAK_OPENING=${ctx.opening} SOAK_ACTIONS=${ctx.actionIndex + 1} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`,
    });
  };

  const live = await page.evaluate(
    ({ canvasOverlays, villagers }) => {
      const w = window as any;
      const e = w.__cotwEngine;
      const h = w.__cotwInputHandler;
      if (!e || !e.player) return null;
      const p = e.player;
      const stack: string[] = h?.modalStack?.getStackIds?.() ?? [];

      const shown = (el: Element | null): boolean => {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        const r = (el as HTMLElement).getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      // Every DOM surface a stack entry can own: dialog scrims, the character menu and the
      // potion picker (a popover over the potion row).
      const surfaces = [
        ...document.querySelectorAll('.ui-scrim, #character-menu-modal, .potion-picker, #context-help-overlay'),
      ].filter(shown);
      const surfaceIds = surfaces.map((el) => el.id || `.${(el as HTMLElement).className.split(' ')[0]}`);

      const top = stack[stack.length - 1];
      const topOnCanvas = top !== undefined && canvasOverlays.includes(top);
      const activeEl = document.activeElement;
      const focusInert = !activeEl || activeEl === document.body || activeEl === document.documentElement;
      const focusEscaped =
        stack.length > 0 && !topOnCanvas && surfaces.length > 0 && !focusInert && !surfaces.some((s) => s.contains(activeEl));
      const activeElTag = activeEl
        ? `${activeEl.tagName}${activeEl.id ? '#' + activeEl.id : ''} "${(activeEl.textContent ?? '').trim().slice(0, 24)}"`
        : 'null';

      const allEntities = e.map.getAllEntities();
      const posCounts = new Map<string, string[]>();
      for (const ent of allEntities) {
        if (ent.isAlive && !ent.isAlive()) continue;
        const key = `${ent.planeId ?? 'physical'}:${ent.x},${ent.y}`;
        posCounts.set(key, [...(posCounts.get(key) ?? []), ent.id]);
      }
      const overlappingTiles = [...posCounts.entries()].filter(([, ids]) => ids.length > 1).map(([pos, ids]) => ({ pos, ids }));

      let clippedText: string | null = null;
      if (document.documentElement.scrollWidth > window.innerWidth + 1) {
        clippedText = `document scrolls horizontally (scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth})`;
      } else {
        for (const el of document.querySelectorAll('.ui-dialog-title, .ui-dialog-body, .ui-fact, .sb-cond-name, .hud-key, .ui-note, #console-objective')) {
          if (!shown(el) || el.scrollWidth <= el.clientWidth + 1) continue;
          const ox = window.getComputedStyle(el).overflowX;
          if (ox === 'auto' || ox === 'scroll') continue;
          clippedText = `clipped text in ${el.id ? '#' + el.id : '.' + (el as HTMLElement).className.split(' ')[0]}`;
          break;
        }
      }

      let countdownVal: number | null = null;
      for (const def of e.manifest?.timedEvents ?? []) {
        if (!e.getWorldFlag(def.startFlag) || (def.resolvedFlag && e.getWorldFlag(def.resolvedFlag))) continue;
        const ticked = e.getWorldFlag(`timed_event_started:${def.id}`);
        const start = ticked ? e.getWorldCounter(`timed_event_start:${def.id}`) : e.turnCount;
        countdownVal = Math.max(0, def.turnLimit - (e.turnCount - start));
        break;
      }

      const prologueNpcIds: string[] = (e.manifest?.prologue?.npcs ?? []).map((n: any) => n.id).filter(Boolean);
      const raidMonstersLeft = allEntities.filter((m: any) => String(m.id).startsWith('prologue-monster-') && (!m.isAlive || m.isAlive())).length;
      const raidNpcsLeft = allEntities.filter((n: any) => [...villagers, ...prologueNpcIds].includes(n.id)).length;

      // Stairs down seen on this floor (the FOV grid's Unexplored is what an out-of-range read returns).
      let stairsSeen = false;
      if (e.currentFloor > 0) {
        const unexplored = e.fov.getVisibility(-1, -1);
        for (let y = 0; y < e.map.height && !stairsSeen; y++) {
          for (let x = 0; x < e.map.width; x++) {
            if (e.map.getTile(x, y)?.type === 'stairs_down' && e.fov.getVisibility(x, y) !== unexplored) {
              stairsSeen = true;
              break;
            }
          }
        }
      }

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
        surfaceIds,
        topOnCanvas,
        focusEscaped,
        activeElTag,
        overlappingTiles,
        clippedText,
        prologueRunning: Boolean(e.getWorldFlag('cotw_prologue_started')) && !e.getWorldFlag('cotw_prologue_ended'),
        prologueEnded: Boolean(e.getWorldFlag('cotw_prologue_ended')),
        struckDown: Boolean(e.getWorldFlag('cotw_prologue_struck_down')),
        covenFled: Boolean(e.getWorldFlag('cotw_prologue_coven_fled')),
        townLit: Boolean(e.map.lit),
        countdownVal,
        raidMonstersLeft,
        raidNpcsLeft,
        potionCue: document.querySelector('.potion-slot.hud-cue') !== null,
        tilePassable: e.map.getTile(p.x, p.y)?.passable ?? true,
        messageCount: (w.__soakLogTotal ?? 0) as number,
        messages: ((w.__soakLogTail ?? []) as string[]).slice(-40),
        saved: Object.fromEntries(villagers.map((id) => [id, Boolean(e.getWorldFlag(`${id}_saved`))])) as Record<string, boolean>,
        stairsSeen,
      };
    },
    { canvasOverlays: CANVAS_OVERLAYS, villagers: [...VILLAGERS] }
  );

  for (const err of pageErrors) addFinding('bug', 'S1', `pageerror: ${err.message}`, srcFrame(err.stack));
  for (const c of consoleErrors) {
    addFinding('bug', c.type === 'error' ? 'S2' : 'S3', `console.${c.type}: ${c.text}`, srcFrame(c.stack));
  }

  if (!live) {
    addFinding('bug', 'S1', 'window.__cotwEngine or its player is missing');
    return findings;
  }
  curTurn = live.turn;
  curFloor = live.floor;
  const key = ctx.dispatchedInput.key;
  const newMessages = live.messages.slice(Math.max(0, live.messages.length - (live.messageCount - ctx.messagesSeenCount)));

  // --- Modal isolation ---------------------------------------------------------------
  // An arrow, number-pad or Period key pressed inside a dialog must never spend a turn.
  // Keys a dialog acts on may: Enter on "drink", Space on a focused button, a confirmed
  // target, and letters, which double as dialog shortcuts (D moves east on the map and
  // drops in the inventory).
  const nonLetterMapKey = key !== undefined && state.boundKeys.map.has(key) && /^(Arrow|Numpad)|^Period$/.test(key);
  if (key && nonLetterMapKey && inDialogBefore && live.turn !== ctx.turnBefore) {
    addFinding('bug', 'S2', `map key ${key} spent a turn under <${[...ctx.stackBefore, ...ctx.modesBefore].join(',')}> (${ctx.turnBefore} -> ${live.turn})`, 'input-handler.ts');
  }
  if (live.stack.length > 0 && !live.topOnCanvas && live.surfaceIds.length === 0) {
    addFinding('bug', 'S2', `modal stack has [${live.stack.join(',')}] but nothing is shown`, 'modalStack.ts');
  } else if (live.stack.length === 0 && !modesAfter.some((m) => m === 'shop' || m === 'help' || m === 'map')) {
    // The game-over screen is a screen, not a modal: input is off when it shows (gameOverDialog.ts).
    const strays = live.surfaceIds.filter((id) => id !== 'game-over-modal');
    if (strays.length > 0) addFinding('bug', 'S2', `a dialog is shown (${strays.join(',')}) with an empty modal stack`, 'modalStack.ts');
  }
  if (live.focusEscaped) {
    // Keys go to the window's handler whatever has focus, so this is S3: it matters when
    // Enter or Space reaches a button behind the dialog, and for keyboard-only players.
    addFinding('bug', 'S3', `focus left modal <${live.stack[live.stack.length - 1]}> for ${live.activeElTag}`, 'modalStack.ts');
  }
  if (key === 'Escape' && ctx.stackBefore.length > 0) {
    const topBefore = ctx.stackBefore[ctx.stackBefore.length - 1];
    // Choices and the game-over screen swallow Escape on purpose. The character menu's tab
    // may use it first to back out of a selection (characterMenuModal.ts handleKeyDown), so
    // there it may close nothing, but never more than itself.
    const swallows = ['choice', 'mastery-choice', 'game-over'].some((id) => topBefore.includes(id));
    const backsOut = topBefore.includes('character-menu') && live.stack.length === ctx.stackBefore.length;
    if (!swallows && !backsOut && live.stack.length !== ctx.stackBefore.length - 1) {
      addFinding('bug', 'S2', `Escape on <${topBefore}> took the stack from ${ctx.stackBefore.length} to ${live.stack.length}`, 'modalStack.ts');
    }
  }
  if (key && !inDialogBefore && live.stack.length > 0 && state.boundKeys.map.has(key)) {
    const opened = live.stack[live.stack.length - 1];
    if (!EXPECTED_OPENERS.includes(opened)) state.interruptions[opened] = (state.interruptions[opened] ?? 0) + 1;
  }

  // --- Player state ---------------------------------------------------------------------
  if (Number.isNaN(live.hp) || (live.isAlive && live.hp <= 0) || live.hp > live.maxHp) {
    addFinding('bug', 'S2', `player HP out of range: ${live.hp}/${live.maxHp}`);
  }
  if (Number.isNaN(live.mana) || live.mana < 0 || live.mana > live.maxMana) {
    addFinding('bug', 'S2', `player mana out of range: ${live.mana}/${live.maxMana}`);
  }
  if (live.gold < 0) addFinding('bug', 'S2', `player gold is negative: ${live.gold}`);
  if (!live.tilePassable) addFinding('bug', 'S2', `hero stands on an impassable tile at ${live.x},${live.y}`);
  for (const ov of live.overlappingTiles) addFinding('bug', 'S2', `two entities share tile ${ov.pos}: [${ov.ids.join(',')}]`);

  // --- The opening ----------------------------------------------------------------------
  if (live.prologueRunning) {
    if (live.countdownVal !== null) {
      if (state.lastCountdown !== null) {
        if (live.countdownVal > state.lastCountdown) {
          addFinding('bug', 'S2', `raid countdown rose from ${state.lastCountdown} to ${live.countdownVal}`);
        } else if (state.lastCountdown - live.countdownVal > Math.max(0, live.turn - state.lastCountdownTurn)) {
          addFinding('bug', 'S2', `raid countdown fell faster than turns passed: ${state.lastCountdown} -> ${live.countdownVal} over ${live.turn - state.lastCountdownTurn} turns`);
        }
      }
      state.lastCountdown = live.countdownVal;
      state.lastCountdownTurn = live.turn;
    }
    if (live.hp < 1) addFinding('bug', 'S1', `hero HP fell below 1 during the raid: ${live.hp}`);
    if (live.stack.some((id) => id === 'choice' || id === 'mastery-choice') && !ctx.stackBefore.includes('choice')) {
      // Milestones are held until the raid is over (d74cbf5). A choice opening now is either
      // a milestone breaking in or a raid scene's own; the triage replay tells which.
      addFinding('bug', 'S3', `a choice dialog opened during the raid: <${live.stack.join(',')}>`);
    }
    if (live.potionCue) state.drinkCueShowed = true;
    if (state.drinkCueShowed && key?.startsWith('Shift+Digit') && live.hp > ctx.hpBefore) state.potionDrunk = true;
    for (const id of VILLAGERS) if (live.saved[id] && state.villagersFreed[id] === undefined) state.villagersFreed[id] = live.turn;
  } else if (!state.raidEndedObserved && (live.prologueEnded || ctx.opening === 'skip')) {
    state.raidEndedObserved = true;
    state.raidEndTurn = live.turn;
    state.raidLogLines = live.messageCount;
    state.raidEndedReason =
      ctx.opening === 'skip' ? 'skipped (triage)' : live.struckDown ? 'struck down' : live.covenFled ? 'countdown' : 'warlocks slain';
  } else if (state.raidEndedObserved && !state.raidEndChecked && state.raidEndTurn !== null && live.turn > state.raidEndTurn) {
    // One turn after the end: the pack's own hooks (the countdown's stop flag among them)
    // run on the step after the raid ends, so checking on the ending action itself is early.
    state.raidEndChecked = true;
    if (live.hpFloor > 0) addFinding('bug', 'S1', `HP floor (${live.hpFloor}) still set after the raid ended`);
    if (live.floor === 0 && !live.townLit) addFinding('bug', 'S2', 'town still dark after the raid ended');
    if (live.raidMonstersLeft > 0) addFinding('bug', 'S2', `${live.raidMonstersLeft} raid monsters remain after the raid ended`);
    if (live.raidNpcsLeft > 0) addFinding('bug', 'S2', `${live.raidNpcsLeft} raid NPCs remain after the raid ended`);
    if (live.countdownVal !== null && live.countdownVal > 0) addFinding('bug', 'S2', 'raid countdown still running after the raid ended');
  }
  if (live.floor > 0 && live.hpFloor > 0) addFinding('bug', 'S1', `HP floor followed the hero to floor ${live.floor}`);

  // --- Softlocks ------------------------------------------------------------------------
  if (live.stack.length === 0 && modesAfter.length === 0) {
    const now = { pos: `${live.x},${live.y}`, turn: live.turn, log: live.messages[live.messages.length - 1] ?? '' };
    const prev = state.lastNoOpState;
    if (prev && prev.pos === now.pos && prev.turn === now.turn && prev.log === now.log && live.messageCount === ctx.messagesSeenCount) {
      state.consecutiveNoOps++;
      if (state.consecutiveNoOps === 25) {
        addFinding('softlock', 'S1', '25 inputs in a row with no dialog open changed nothing (position, turn, log)');
      }
    } else {
      state.consecutiveNoOps = 0;
      state.lastNoOpState = now;
    }
  } else {
    state.consecutiveNoOps = 0;
  }

  // --- Text -----------------------------------------------------------------------------
  const counts = new Map<string, number>();
  for (const msg of newMessages) {
    counts.set(msg, (counts.get(msg) ?? 0) + 1);
    if (/undefined|NaN|\[object|\$\{|\{\{/.test(msg)) addFinding('text', 'S3', `raw token in log line: "${msg}"`);
    const doubled = /\b([A-Za-z]{2,})\s+\1\b/i.exec(msg);
    if (doubled) addFinding('text', 'S3', `doubled word "${doubled[0]}" in log line: "${msg}"`);
    if (/^[a-z]/.test(msg.trim())) addFinding('text', 'S3', `log line starts lowercase: "${msg}"`);
    if (/\b[a-z]{2,}_[a-z0-9_]+\b/.test(msg)) addFinding('text', 'S3', `raw snake_case id in log line: "${msg}"`);
  }
  // Four goblins hitting for 3 each write four identical lines: the game working, but a
  // log a player has to read, so a player-experience note rather than a text bug.
  for (const [msg, n] of counts) if (n >= 3) addFinding('ux', 'S4', `one action logged the same line ${n} times: "${msg}"`);
  // Spam while the hero only waits: something logs every turn on its own (a monster's
  // "waits a moment", a status ticking). A hero walking into walls is the bot, not spam.
  if (key && state.boundKeys.wait.has(key) && newMessages.length > 0) {
    const line = newMessages[newMessages.length - 1];
    state.passiveSpam = state.passiveSpam?.line === line ? { line, count: state.passiveSpam.count + 1 } : { line, count: 1 };
    if (state.passiveSpam.count === 4) addFinding('text', 'S3', `the same line on 4 waits in a row: "${line}"`);
  } else if (key && !state.boundKeys.wait.has(key)) {
    state.passiveSpam = null;
  }
  if (live.clippedText) addFinding('text', 'S3', live.clippedText);

  // --- Player experience ----------------------------------------------------------------
  // A bound key pressed on the open map that changed nothing and said nothing. Unbound keys
  // and clicks are excluded: a neighbouring-tile click with the Hover Ring off is intended.
  const changed =
    live.x !== ctx.posBefore.x ||
    live.y !== ctx.posBefore.y ||
    live.hp !== ctx.hpBefore ||
    live.mana !== ctx.manaBefore ||
    live.turn !== ctx.turnBefore ||
    live.messageCount !== ctx.messagesSeenCount ||
    live.stack.length > 0 ||
    modesAfter.length > 0;
  if (key && !inDialogBefore && state.boundKeys.all.has(key) && !changed) {
    state.deadKeyCount++;
    addFinding('ux', 'S4', `bound key ${key} on the open map gave no feedback and changed nothing`);
  }

  if (live.floor !== state.currentFloor) {
    state.currentFloor = live.floor;
    state.turnsOnCurrentFloor = 0;
    state.stairsFoundOnFloor = false;
  } else {
    state.turnsOnCurrentFloor += Math.max(0, live.turn - ctx.turnBefore);
  }
  if (live.stairsSeen) state.stairsFoundOnFloor = true;
  if (live.floor > 0 && state.turnsOnCurrentFloor > 300 && !state.stairsFoundOnFloor) {
    addFinding('ux', 'S4', `more than 300 turns on floor ${live.floor} without seeing the stairs down`);
  }

  if (!live.isAlive && state.raidEndTurn !== null && live.turn - state.raidEndTurn < 200) {
    addFinding('ux', 'S4', `died ${live.turn - state.raidEndTurn} turns after the raid: ${live.messages.slice(-20).join(' | ')}`);
  }

  return findings;
}
