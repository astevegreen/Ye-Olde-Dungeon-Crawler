import type { Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SoakPrng } from './prng';
import type { BoundKeys } from './oracles';
import type { DispatchedAction } from './policies';

/**
 * State of the player bot across action decisions.
 * Maintained hermetically on page.__playerBotState.
 */
export interface PlayerBotState {
  lastPos: string;
  lastTurn: number;
  lastFloor: number;
  stuckDecisions: number;
  unstickStepsRemaining: number;
  stuckEpisodes: number;
  floorEnteredTurn: number;
  lastFloorSeen: number;
  lastRestAttemptTurn: number;
  lastPickupTurn: number;
  lastPickupPos: string;
  droppedTiles: Record<string, boolean>;
  droppedItemsCount: number;
  overburdenedEpisodes: number;
  wasOverburdened: boolean;
  /** Pack items the bot has tried to put on or drop (each once: a failed try isn't repeated). */
  equipTried: string[];
  /** Town merchants (NPC ids) visited this time in town. */
  shopDone: string[];
  /** Decisions spent inside the open shop this visit (a cap against loops). */
  shopDecisions: number;
  /** The one trip back to town to spend dungeon gold (SOAK_SHOP_FLOOR, default 4). */
  trip: 'none' | 'up' | 'down' | 'done';
  equips: number;
  purchases: number;
  sales: number;
}

function saveOverburdenStats(seed: string | undefined, episodes: number, dropped: number, tiles: string[]) {
  if (!seed) return;
  const outDir = process.env.SOAK_OUT ?? '.prompts/soak-review-player';
  const dir = join(outDir, seed);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'overburden.json'),
      JSON.stringify(
        {
          overburdenedEpisodes: episodes,
          droppedItemsCount: dropped,
          droppedTiles: tiles,
        },
        null,
        2
      )
    );
  } catch {
    // Ignore fs errors in soak
  }
}

export function getBotState(page: Page, actionIndex: number): PlayerBotState {
  const p = page as any;
  if (actionIndex === 0 || !p.__playerBotState) {
    p.__playerBotState = {
      lastPos: '',
      lastTurn: -1,
      lastFloor: -1,
      stuckDecisions: 0,
      unstickStepsRemaining: 0,
      stuckEpisodes: 0,
      floorEnteredTurn: 0,
      lastFloorSeen: -1,
      lastRestAttemptTurn: -1,
      lastPickupTurn: -1,
      lastPickupPos: '',
      droppedTiles: {},
      droppedItemsCount: 0,
      overburdenedEpisodes: 0,
      wasOverburdened: false,
      equipTried: [],
      shopDone: [],
      shopDecisions: 0,
      trip: 'none',
      equips: 0,
      purchases: 0,
      sales: 0,
    };
    saveOverburdenStats(process.env.SOAK_SEED, 0, 0, []);
  }
  return p.__playerBotState;
}

/** One decision from the page: the action, where the hero stood, and what the bot noted. */
interface DecisionResult {
  action: DispatchedAction;
  curPos: string;
  curTurn: number;
  curFloor: number;
  restAttempted?: boolean;
  pickupAttempted?: boolean;
  isOverburdened?: boolean;
  itemDropped?: boolean;
  droppedPos?: string;
  droppedFloor?: number;
  equipTried?: string;
  shedTried?: string;
  inShop?: boolean;
  shopFinished?: string;
  bought?: boolean;
  sold?: boolean;
  tripUp?: boolean;
}

export interface PlayerDecisionContext {
  page: Page;
  prng: SoakPrng;
  actionIndex: number;
  boundKeys: BoundKeys;
  canvas: { x: number; y: number; width: number; height: number } | null;
  inDialog: boolean;
}

/**
 * Decides the next action for the goal-seeking player bot.
 * Performs exactly one page.evaluate call per decision to inspect state and plan paths.
 *
 * Gear (Q40): it wears the best piece it carries for each slot (by attack for the weapon
 * hand, defense for the rest), picks up a heavy piece only when it is an upgrade, and
 * drops spare gear once over half its carry limit. In town after Hallvard it sells spare
 * gear and buys upgrades it can afford and carry at the smith, then healing at the
 * alchemist. Once, on finishing floor SOAK_SHOP_FLOOR (default 4) with 800 CP or
 * more, it climbs back to town to spend its dungeon gold, then goes straight back down.
 * It reads true item stats, unidentified or not: a stand-in for a player who tries
 * things on. Every move is a real key press.
 */
export async function decidePlayerAction(ctx: PlayerDecisionContext): Promise<DispatchedAction> {
  const { page, prng, actionIndex, inDialog } = ctx;
  const state = getBotState(page, actionIndex);

  // If in unstick mode, take a seeded random step
  if (state.unstickStepsRemaining > 0) {
    state.unstickStepsRemaining--;
    const key = prng.pick(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    return { type: 'key', key };
  }

  const evalResult: DecisionResult = await page.evaluate(
    (args: {
      inDialog: boolean;
      floorEnteredTurn: number;
      lastRestAttemptTurn: number;
      lastPickupPos: string;
      lastPickupTurn: number;
      droppedTiles: Record<string, boolean>;
      equipTried: string[];
      shopDone: string[];
      shopDecisions: number;
      trip: 'none' | 'up' | 'down' | 'done';
      shopFloor: number;
    }) => {
      const w = window as any;
      const e = w.__cotwEngine;
      const h = w.__cotwInputHandler;
      const r = w.__cotwRenderer;

      if (!e || !e.player) {
        return {
          action: { type: 'key' as const, key: 'Space' },
          curPos: '0,0',
          curTurn: -1,
          curFloor: -1,
        };
      }

      const p = e.player;
      const curPos = `${p.x},${p.y}`;
      const curTurn = e.turnCount as number;
      const curFloor = (e.currentFloor ?? 0) as number;
      const stack: string[] = h?.modalStack?.getStackIds?.() ?? [];
      const openModes = [
        h?.inspectOverlay?.isOpen && 'inspect',
        h?.mapOverlay?.isOpen && 'map',
        h?.shopOverlay?.isOpen && 'shop',
        h?.contextHelp?.isOpen && 'help',
      ].filter(Boolean) as string[];

      const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

      const stepToKey = (dx: number, dy: number): string => {
        if (dx === 0 && dy === -1) return 'ArrowUp';
        if (dx === 0 && dy === 1) return 'ArrowDown';
        if (dx === -1 && dy === 0) return 'ArrowLeft';
        if (dx === 1 && dy === 0) return 'ArrowRight';
        if (dx === -1 && dy === -1) return 'Numpad7';
        if (dx === 1 && dy === -1) return 'Numpad9';
        if (dx === -1 && dy === 1) return 'Numpad1';
        if (dx === 1 && dy === 1) return 'Numpad3';
        return 'Space';
      };

      const hostiles = e.map
        .getAllEntities()
        .filter(
          (m: any) =>
            m &&
            m !== p &&
            m.isAlive?.() &&
            p.isHostileTo?.(m)
        );

      // --- Gear: what a decent player would wear, buy and sell ------------------
      // Wearable pieces judged by the one number that matters for their slot: attack for
      // the weapon hand, defense (plus any attack) for the rest. Two-handers and jewelry
      // are left alone.
      const GEAR = ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gauntlets', 'cloak'];
      const isGear = (it: any): boolean => Boolean(it && GEAR.includes(it.category) && it.slot && !it.twoHanded);
      const scoreOf = (it: any): number => {
        const st = it?.effectiveStats ?? it?.stats ?? {};
        return it?.slot === 'mainHand' ? (st.attackBonus ?? 0) : (st.defenseBonus ?? 0) + (st.attackBonus ?? 0);
      };
      const wornIn = (slot: string): any => p.inventory?.paperdoll?.getItem?.(slot) ?? null;
      const gainOf = (it: any): number => (isGear(it) ? scoreOf(it) - (wornIn(it.slot) ? scoreOf(wornIn(it.slot)) : 0) : 0);
      const packItems: any[] = p.inventory?.primaryPack?.getItems?.() ?? [];
      const equipCandidate = packItems
        .filter((it) => isGear(it) && gainOf(it) > 0 && !args.equipTried.includes(it.id))
        .sort((a, b) => gainOf(b) - gainOf(a) || String(a.id).localeCompare(String(b.id)))[0];
      // Load: a player keeps under half the carry limit (unencumbered), and goes up to
      // three quarters (burdened, 25% slower) only for a real upgrade.
      const maxCarry = Math.max(1, p.strength ?? 10) * 2500;
      const carried: number = p.inventory?.totalWeight?.() ?? 0;
      const weightOf = (it: any): number => (typeof it?.totalWeight === 'function' ? it.totalWeight() : (it?.weight ?? 0));
      const fitsLoad = (addGrams: number, gain: number): boolean =>
        carried + addGrams <= maxCarry * 0.5 || (gain >= 3 && carried + addGrams <= maxCarry * 0.75);
      const shedCandidate =
        carried > maxCarry * 0.5
          ? packItems
              .filter((it) => isGear(it) && gainOf(it) <= 0 && !args.equipTried.includes(it.id))
              .sort((a, b) => weightOf(b) - weightOf(a) || String(a.id).localeCompare(String(b.id)))[0]
          : undefined;
      const isHealing = (it: any): boolean =>
        Boolean(it && (it.potionType === 'health' || it.effects?.some?.((f: any) => f.type === 'restore_hp')));
      const COIN: Record<string, number> = { copper: 1, silver: 10, gold: 100 };
      const funds = (): number => {
        let cp = 0;
        for (const c of [p.inventory?.purse, p.inventory?.primaryPack]) {
          for (const it of c?.getItems?.() ?? []) {
            if (it.category !== 'currency') continue;
            const name = String(it.name).toLowerCase();
            const denom = it.denomination ?? (['silver', 'copper'].find((d) => name.includes(d)) ?? 'gold');
            const count = it.count ?? Number(name.match(/(\d+)/)?.[1] ?? 1);
            cp += (COIN[denom] ?? 1) * count;
          }
        }
        return cp;
      };
      const findStairs = (dir: 'up' | 'down'): { x: number; y: number } | null => {
        for (let y = 0; y < e.map.height; y++) {
          for (let x = 0; x < e.map.width; x++) {
            const t = e.map.getTile(x, y);
            const hit = dir === 'up' ? t && (t.isStairsUp || t.type === 'stairs_up') : t && (t.isStairsDown || t.type === 'stairs_down');
            if (hit && e.fov.isExplored(x, y)) return { x, y };
          }
        }
        return null;
      };

      // --- 1. Dialogs and modes first -----------------------------------------
      const picker = document.querySelector('.potion-picker');
      if (picker && (stack.includes('potion-picker') || h?.modalStack?.has?.('potion-picker'))) {
        const row = picker.querySelector('.potion-picker-row:not(.potion-picker-clear)') as HTMLElement;
        if (row) {
          const rect = row.getBoundingClientRect();
          return {
            action: {
              type: 'click' as const,
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2),
            },
            curPos,
            curTurn,
            curFloor,
          };
        }
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      const targetingOpen = stack.includes('targeting') || Boolean(r?.targetingOverlay?.isOpen);
      if (targetingOpen) {
        const t = r?.targetingOverlay;
        const aimX = t?.reticleX ?? p.x + 1;
        const aimY = t?.reticleY ?? p.y;

        const snipeCandidates = hostiles
          .filter(
            (m: any) =>
              e.fov.isVisible(m.x, m.y) &&
              cheb(m, p) >= 2 &&
              cheb(m, p) <= 6 &&
              (m.aiState === 'fleeing' || m.hp <= m.maxHp / 2)
          )
          .sort((a: any, b: any) => a.hp - b.hp || a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));

        const target = snipeCandidates[0];
        if (target) {
          if (aimX === target.x && aimY === target.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const rdx = Math.sign(target.x - aimX);
          const rdy = Math.sign(target.y - aimY);
          if (rdx !== 0) return { action: { type: 'key' as const, key: rdx > 0 ? 'ArrowRight' : 'ArrowLeft' }, curPos, curTurn, curFloor };
          if (rdy !== 0) return { action: { type: 'key' as const, key: rdy > 0 ? 'ArrowDown' : 'ArrowUp' }, curPos, curTurn, curFloor };
        }

        const hostileAtAim = hostiles.find((m: any) => m.x === aimX && m.y === aimY && e.fov.isVisible(m.x, m.y));
        if (hostileAtAim) {
          return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
        }
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      const controlsPrimer = document.getElementById('controls-primer');
      if ((controlsPrimer && window.getComputedStyle(controlsPrimer).display !== 'none') || stack.includes('controls-primer')) {
        return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
      }

      if (stack.includes('choice')) {
        const choiceOverlay = document.getElementById('choice-modal-overlay');
        const focused = choiceOverlay?.querySelector('.ui-option.is-focused');
        if (!focused) {
          return { action: { type: 'key' as const, key: 'ArrowDown', secondaryKey: 'Enter' }, curPos, curTurn, curFloor };
        }
        return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
      }

      // Character menu handling (for overburden recovery and general dismissal)
      const characterMenuOpen = stack.includes('character-menu') || Boolean(h?.characterMenuModal?.isOpen);
      if (characterMenuOpen) {
        const modal = h?.characterMenuModal;
        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';

        if (!isOverburdened) {
          // Put on the better piece: the backpack panel, its cell, then E.
          const invTabE = modal?.tabs?.find?.((t: any) => t.id === 'inventory');
          const ce = invTabE?.controller;
          const groupsE: any[] = ce?.groups?.('backpack') ?? [];
          // In the dungeon a spare piece is dropped when the load is heavy; in town it is sold.
          const shed = curFloor > 0 ? shedCandidate : undefined;
          const want = equipCandidate ?? shed;
          const targetIdx = want ? groupsE.findIndex((g: any) => g.leadItem?.id === want.id) : -1;
          if (targetIdx < 0) {
            return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
          }
          if (modal && modal.activeTabId !== 'inventory') {
            return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
          }
          if (ce.inspector?.focusedPanel !== 'backpack') {
            return { action: { type: 'key' as const, key: 'Tab' }, curPos, curTurn, curFloor };
          }
          const at = ce.inspector.focusedIndex ?? 0;
          if (at !== targetIdx) {
            return { action: { type: 'key' as const, key: at < targetIdx ? 'ArrowRight' : 'ArrowLeft' }, curPos, curTurn, curFloor };
          }
          if (equipCandidate) {
            return { action: { type: 'key' as const, key: 'KeyE' }, curPos, curTurn, curFloor, equipTried: equipCandidate.id as string };
          }
          // Each piece is tried once, so a refused drop can't hold the bot in the menu.
          return { action: { type: 'key' as const, key: 'KeyD' }, curPos, curTurn, curFloor, itemDropped: true, droppedPos: curPos, droppedFloor: curFloor, shedTried: want.id as string };
        }

        if (modal && modal.activeTabId !== 'inventory') {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        const invTab = modal?.getActiveTab?.()?.id === 'inventory'
          ? modal.getActiveTab()
          : modal?.tabs?.find((t: any) => t.id === 'inventory');
        const c = invTab?.controller;

        if (!c) {
          return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        const groups = c.groups?.('backpack') ?? [];
        if (groups.length === 0) {
          return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        let heaviestIdx = 0;
        let maxWt = -1;
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          const wt = g.totalWeight ?? (typeof g.leadItem?.totalWeight === 'function' ? g.leadItem.totalWeight() : g.leadItem?.weight) ?? 0;
          if (wt > maxWt || (wt === maxWt && String(g.displayName).localeCompare(String(groups[heaviestIdx]?.displayName)) < 0)) {
            maxWt = wt;
            heaviestIdx = i;
          }
        }

        if (c.inspector?.focusedPanel !== 'backpack') {
          return { action: { type: 'key' as const, key: 'Tab' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        const curIdx = c.inspector.focusedIndex ?? 0;
        if (curIdx < heaviestIdx) {
          return { action: { type: 'key' as const, key: 'ArrowRight' }, curPos, curTurn, curFloor, isOverburdened: true };
        }
        if (curIdx > heaviestIdx) {
          return { action: { type: 'key' as const, key: 'ArrowLeft' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        return {
          action: { type: 'key' as const, key: 'KeyD' },
          curPos,
          curTurn,
          curFloor,
          isOverburdened: true,
          itemDropped: true,
          droppedPos: curPos,
          droppedFloor: curFloor,
        };
      }

      if (stack.includes('shop') || openModes.includes('shop') || h?.shopOverlay?.isOpen) {
        // A merchant: sell the spare gear, then buy the best upgrade per slot that the purse
        // covers, and healing potions. Everything by keys: B/S for the tab, arrows, Enter.
        const so = h?.shopOverlay;
        const npcId: string = so?.activeNpc?.id ?? 'npc';
        const leave = { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor, shopFinished: npcId };
        if (!so?.merchant || args.shopDecisions >= 80) return leave;
        const toRow = (tab: 'buy' | 'sell', index: number, extra: Record<string, unknown>) => {
          if (so.activeTab !== tab) return { action: { type: 'key' as const, key: tab === 'buy' ? 'KeyB' : 'KeyS' }, curPos, curTurn, curFloor, inShop: true };
          const at = tab === 'buy' ? so.selectedBuyIndex : so.selectedSellIndex;
          if (at !== index) return { action: { type: 'key' as const, key: at < index ? 'ArrowDown' : 'ArrowUp' }, curPos, curTurn, curFloor, inShop: true };
          return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor, inShop: true, ...extra };
        };
        const buyRows: any[][] = so.rowsFor(e, 'buy');
        const sellRows: any[][] = so.rowsFor(e, 'sell');
        const dealsInGear = buyRows.some((row) => isGear(row[0]));

        if (dealsInGear) {
          const spare = sellRows.findIndex((row) => isGear(row[0]) && gainOf(row[0]) <= 0);
          if (spare >= 0) return toRow('sell', spare, { sold: true });
        }

        // Buy prices, read the way the dialog reads them on its Buy tab.
        const tabNow = so.activeTab;
        so.activeTab = 'buy';
        const prices = new Map<any, number>(buyRows.map((row) => [row[0], so.priceOf(row[0], e) as number]));
        so.activeTab = tabNow;
        const cash = funds();
        const bestHeld = (slot: string): number =>
          Math.max(wornIn(slot) ? scoreOf(wornIn(slot)) : 0, ...packItems.filter((it) => isGear(it) && it.slot === slot).map(scoreOf));
        let pick = -1;
        let pickGain = 0;
        buyRows.forEach((row, i) => {
          const it = row[0];
          if (!isGear(it) || (prices.get(it) ?? Infinity) > cash) return;
          const g = scoreOf(it) - bestHeld(it.slot);
          // Worn in place of the old piece, which is then sold: count only the difference.
          const old = wornIn(it.slot);
          if (!fitsLoad(weightOf(it) - (old ? weightOf(old) : 0), g)) return;
          if (g > pickGain) {
            pick = i;
            pickGain = g;
          }
        });
        if (pick >= 0) return toRow('buy', pick, { bought: true });

        const healingCarried = (p.inventory?.getAllCarriedItems?.() ?? [])
          .filter(isHealing)
          .reduce((n: number, it: any) => n + (it.quantity ?? 1), 0);
        const potion = buyRows.findIndex((row) => isHealing(row[0]) && (prices.get(row[0]) ?? Infinity) <= cash);
        if (potion >= 0 && healingCarried < 8) return toRow('buy', potion, { bought: true });

        return leave;
      }

      if (stack.length > 0 || (args.inDialog && openModes.length > 0)) {
        return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
      }

      // --- Helpers for map action choices --------------------------------------
      const findHealingPotionKey = (): string | null => {
        const cue = document.querySelector('.potion-slot.hud-cue');
        if (cue && cue.parentElement) {
          const slotIdx = [...cue.parentElement.children].indexOf(cue) + 1;
          if (slotIdx >= 1 && slotIdx <= 4) return `Shift+Digit${slotIdx}`;
        }

        const slots = document.querySelectorAll('.potion-slot');
        for (let i = 0; i < Math.min(slots.length, 4); i++) {
          const slotEl = slots[i];
          if (slotEl.classList.contains('potion-slot-empty') || slotEl.classList.contains('potion-slot-out')) continue;
          return `Shift+Digit${i + 1}`;
        }

        // If slots are out/dimmed (e.g. serialize bug dropped definitionId),
        // pressing Shift+Digit2 opens potion-picker to re-pin it if potions are carried:
        const carriedPotions = p.inventory.getAllCarriedItems().filter(
          (it: any) => it && (it.potionType === 'health' || it.effects?.some((f: any) => f.type === 'restore_hp'))
        );
        if (carriedPotions.length > 0) {
          return 'Shift+Digit2';
        }
        return null;
      };

      const adjHostiles = hostiles
        .filter((m: any) => cheb(m, p) === 1)
        .sort((a: any, b: any) => a.hp - b.hp || a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));

      const canCast = p.mana >= 3 && (p.spellsKnown?.includes('magic_arrow') || p.quickSpells?.[0] === 'magic_arrow');
      const snipeCandidates = canCast
        ? hostiles
            .filter(
              (m: any) =>
                e.fov.isVisible(m.x, m.y) &&
                cheb(m, p) >= 2 &&
                cheb(m, p) <= 6 &&
                (m.aiState === 'fleeing' || m.hp <= m.maxHp / 2)
            )
            .sort((a: any, b: any) => a.hp - b.hp || cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)))
        : [];
      const snipeTarget = snipeCandidates[0];

      let snipeAction: { type: 'key'; key: string; secondaryKey?: string } | null = null;
      if (snipeTarget) {
        const visibleEnemies = e.map
          .getAllEntities()
          .filter((ent: any) => ent && ent.isAlive?.() && ent.isHostileTo?.(p) && e.fov.isVisible(ent.x, ent.y));
        const autoTargetsDirectly = visibleEnemies[0]?.id === snipeTarget.id;
        snipeAction = { type: 'key', key: 'Digit1', secondaryKey: autoTargetsDirectly ? 'Enter' : undefined };
      }

      const bfsStepToGoal = (
        start: { x: number; y: number },
        goal: { x: number; y: number },
        isDungeonFloor: boolean
      ): { x: number; y: number } | null => {
        if (cheb(start, goal) === 1) return goal;
        const width = e.map.width;
        const height = e.map.height;
        const key = (x: number, y: number) => y * width + x;
        const startKey = key(start.x, start.y);
        const goalKey = key(goal.x, goal.y);
        const cameFrom = new Int32Array(width * height).fill(-2);
        const queue: number[] = [startKey];
        cameFrom[startKey] = -1;
        let qHead = 0;

        const DIRS8 = [
          [0, -1], [1, 0], [0, 1], [-1, 0],
          [1, -1], [1, 1], [-1, 1], [-1, -1],
        ];

        while (qHead < queue.length) {
          const curKey = queue[qHead++];
          if (curKey === goalKey) {
            let k = curKey;
            let last = k;
            while (cameFrom[k] !== startKey && cameFrom[k] !== -1) {
              last = k;
              k = cameFrom[k];
            }
            const stepKey = cameFrom[k] === -1 ? last : k;
            return { x: stepKey % width, y: Math.floor(stepKey / width) };
          }

          const cx = curKey % width;
          const cy = Math.floor(curKey / width);

          for (let i = 0; i < 8; i++) {
            const nx = cx + DIRS8[i][0];
            const ny = cy + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            const nKey = ny * width + nx;
            if (cameFrom[nKey] !== -2) continue;

            const tile = e.map.getTile(nx, ny);
            const isDest = nKey === goalKey;

            if (!isDest) {
              if (isDungeonFloor) {
                const passable =
                  tile &&
                  (tile.passable ||
                    tile.isClosedDoor ||
                    tile.isOpenDoor ||
                    tile.type === 'door_closed' ||
                    tile.type === 'door_open');
                if (!passable) continue;
                // Walking into a townsperson talks to them: path around.
                const npcHere = e.map.getEntityAt(nx, ny);
                if (npcHere && npcHere.type === 'npc') continue;
              } else {
                if (!tile || !tile.passable || tile.isClosedDoor || tile.isOpenDoor) continue;
                const ent = e.map.getEntityAt(nx, ny);
                if (ent && ent.type === 'npc') continue;
              }
            }

            cameFrom[nKey] = curKey;
            queue.push(nKey);
          }
        }
        return null;
      };

      const bfsStepToFrontier = (start: { x: number; y: number }): { x: number; y: number } | null => {
        const width = e.map.width;
        const height = e.map.height;
        const key = (x: number, y: number) => y * width + x;
        const startKey = key(start.x, start.y);
        const cameFrom = new Int32Array(width * height).fill(-2);
        const queue: number[] = [startKey];
        cameFrom[startKey] = -1;
        let qHead = 0;

        const DIRS8 = [
          [0, -1], [1, 0], [0, 1], [-1, 0],
          [1, -1], [1, 1], [-1, 1], [-1, -1],
        ];

        const isFrontier = (x: number, y: number): boolean => {
          if (e.fov.getVisibility(x, y) === 0) return false;
          const t = e.map.getTile(x, y);
          if (
            !t ||
            (!t.passable && !t.isClosedDoor && !t.isOpenDoor && t.type !== 'door_closed' && t.type !== 'door_open')
          ) {
            return false;
          }

          for (let i = 0; i < 8; i++) {
            const nx = x + DIRS8[i][0];
            const ny = y + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            if (e.fov.getVisibility(nx, ny) === 0) {
              const nt = e.map.getTile(nx, ny);
              if (
                nt &&
                (nt.passable || nt.isClosedDoor || nt.isOpenDoor || nt.type === 'door_closed' || nt.type === 'door_open')
              ) {
                return true;
              }
            }
          }
          return false;
        };

        while (qHead < queue.length) {
          const curKey = queue[qHead++];
          const cx = curKey % width;
          const cy = Math.floor(curKey / width);

          if (curKey !== startKey && isFrontier(cx, cy)) {
            let k = curKey;
            let last = k;
            while (cameFrom[k] !== startKey && cameFrom[k] !== -1) {
              last = k;
              k = cameFrom[k];
            }
            const stepKey = cameFrom[k] === -1 ? last : k;
            return { x: stepKey % width, y: Math.floor(stepKey / width) };
          }

          for (let i = 0; i < 8; i++) {
            const nx = cx + DIRS8[i][0];
            const ny = cy + DIRS8[i][1];
            if (!e.map.inBounds(nx, ny)) continue;
            const nKey = ny * width + nx;
            if (cameFrom[nKey] !== -2) continue;

            const tile = e.map.getTile(nx, ny);
            const passable =
              tile &&
              (tile.passable ||
                tile.isClosedDoor ||
                tile.isOpenDoor ||
                tile.type === 'door_closed' ||
                tile.type === 'door_open');
            if (!passable) continue;

            cameFrom[nKey] = curKey;
            queue.push(nKey);
          }
        }
        return null;
      };

      // --- 2. The Raid Phase ---------------------------------------------------
      const isRaid = Boolean(e.getWorldFlag('cotw_prologue_started')) && !e.getWorldFlag('cotw_prologue_ended');
      if (isRaid) {
        if (p.hp <= Math.max(p.maxHp * 0.45, 12)) {
          const potKey = findHealingPotionKey();
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor };
        }

        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';
        if (isOverburdened) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        if (adjHostiles.length > 0) {
          const m = adjHostiles[0];
          return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (snipeAction) {
          return { action: snipeAction, curPos, curTurn, curFloor };
        }

        const VILLAGER_IDS = ['prologue-eir', 'prologue-sigrun', 'prologue-brandr'];
        const remainingVillagers = VILLAGER_IDS.filter((id) => !e.getWorldFlag(`${id}_saved`))
          .map((id) => e.map.getEntityById(id))
          .filter(Boolean);

        let goal: any = null;
        if (remainingVillagers.length > 0) {
          const ordered = remainingVillagers.sort(
            (a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id))
          );
          const v = ordered[0];
          const captor = hostiles
            .filter((m: any) => cheb(m, v) <= 1)
            .sort((a: any, b: any) => a.hp - b.hp || String(a.id).localeCompare(String(b.id)))[0];
          goal = captor ?? v;
        } else {
          const warlocks = hostiles
            .filter((m: any) => m.definitionId === 'prologue_coven_warlock')
            .sort((a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)));
          goal =
            warlocks[0] ??
            hostiles.sort((a: any, b: any) => cheb(a, p) - cheb(b, p) || String(a.id).localeCompare(String(b.id)))[0];
        }

        if (goal) {
          if (cheb(p, goal) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(goal.x - p.x, goal.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, goal, false);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
      }

      // --- 3. The town after the raid ------------------------------------------
      const isTown = curFloor === 0 && Boolean(e.getWorldFlag('cotw_prologue_ended'));
      if (isTown) {
        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';
        if (isOverburdened) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        const hallvardHeard = Boolean(e.getWorldFlag('cotw_prologue_gateward_heard'));
        if (!hallvardHeard) {
          const hallvard = e.map.getEntityById('prologue-hallvard') ?? { x: 31, y: 9 };
          if (cheb(p, hallvard) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(hallvard.x - p.x, hallvard.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, hallvard, false);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        } else if (equipCandidate) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
        } else if (['npc-gunther', 'npc-astrid'].some((id) => !args.shopDone.includes(id) && e.map.getEntityById(id))) {
          // The smith, then the alchemist: walk up and bump to trade.
          const id = ['npc-gunther', 'npc-astrid'].find((n) => !args.shopDone.includes(n) && e.map.getEntityById(n))!;
          const npc = e.map.getEntityById(id);
          if (cheb(p, npc) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(npc.x - p.x, npc.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, npc, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
          return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor, shopFinished: id };
        } else {
          // Walk to cellar stairs at (31, 7) or tile with isStairsDown
          let stairs = { x: 31, y: 7 };
          for (let y = 0; y < e.map.height; y++) {
            for (let x = 0; x < e.map.width; x++) {
              const t = e.map.getTile(x, y);
              if (t && (t.isStairsDown || t.type === 'stairs_down')) {
                stairs = { x, y };
                break;
              }
            }
          }

          if (p.x === stairs.x && p.y === stairs.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          if (cheb(p, stairs) === 1) {
            return { action: { type: 'key' as const, key: stepToKey(stairs.x - p.x, stairs.y - p.y) }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, stairs, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }
        return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
      }

      // --- 4. A dungeon floor --------------------------------------------------
      if (curFloor > 0) {
        if (p.hp <= Math.max(p.maxHp * 0.45, 12)) {
          const potKey = findHealingPotionKey();
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor };
        }

        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';
        if (isOverburdened) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        if (adjHostiles.length > 0) {
          const m = adjHostiles[0];
          return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (snipeAction) {
          return { action: snipeAction, curPos, curTurn, curFloor };
        }

        const visibleHostiles = hostiles.filter((m: any) => e.fov.isVisible(m.x, m.y));
        if (p.hp < p.maxHp * 0.6 && visibleHostiles.length === 0) {
          if (args.lastRestAttemptTurn !== curTurn) {
            return { action: { type: 'key' as const, key: 'KeyR' }, curPos, curTurn, curFloor, restAttempted: true };
          }
        }

        // Put on a better piece found on the way, once nothing is in sight.
        if (visibleHostiles.length === 0 && (equipCandidate || shedCandidate)) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
        }

        // The trip back to town: up every floor's stairs, then straight back down.
        if (args.trip === 'up') {
          const up = findStairs('up');
          if (up) {
            if (p.x === up.x && p.y === up.y) return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
            const step = bfsStepToGoal(p, up, true);
            if (step) return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }
        if (args.trip === 'down' && curFloor <= args.shopFloor) {
          const down = findStairs('down');
          if (down) {
            if (p.x === down.x && p.y === down.y) return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
            const step = bfsStepToGoal(p, down, true);
            if (step) return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        const itemsHere = e.map.getItemsAt(p.x, p.y);
        if (itemsHere.length > 0) {
          const tileKey = `${curFloor}:${curPos}`;
          const droppedHere = Boolean(args.droppedTiles && args.droppedTiles[tileKey]);
          const topItem = itemsHere[itemsHere.length - 1];
          const isContainer = Boolean(
            topItem && (
              topItem.category === 'container' ||
              topItem.containerType !== undefined ||
              typeof topItem.getItems === 'function'
            )
          );

          const currentWeight = p.inventory?.totalWeight?.() ?? 0;
          const itemWeight = topItem ? (typeof topItem.totalWeight === 'function' ? topItem.totalWeight() : (topItem.weight ?? 0)) : 0;
          const maxCarryWeight = Math.max(1, p.strength ?? 10) * 2500;

          const isHealthPotion = Boolean(
            topItem && (
              topItem.potionType === 'health' ||
              topItem.effects?.some((f: any) => f.type === 'restore_hp') ||
              topItem.name?.toLowerCase().includes('health potion')
            )
          );
          const isPotion = Boolean(
            topItem && (
              topItem.category === 'consumable' ||
              topItem.potionType !== undefined ||
              topItem.name?.toLowerCase().includes('potion')
            )
          );
          const isScroll = Boolean(
            topItem && (
              topItem.category === 'scroll' ||
              topItem.name?.toLowerCase().includes('scroll')
            )
          );
          const isCoin = Boolean(topItem && topItem.category === 'currency');
          const isGemOrJewel = Boolean(
            topItem && (
              topItem.category === 'gem' ||
              topItem.category === 'ring' ||
              topItem.category === 'amulet'
            )
          );
          const isWandOrBook = Boolean(
            topItem && (
              topItem.category === 'wand' ||
              topItem.category === 'book'
            )
          );
          const isLight = itemWeight <= 1000;

          const isPreferred = isPotion || isScroll || isCoin || isGemOrJewel || isWandOrBook || isLight;

          const wouldOverburden = isHealthPotion || isCoin
            ? (currentWeight + itemWeight > maxCarryWeight)
            : (currentWeight + itemWeight > maxCarryWeight * 0.85);

          const isUpgrade = isGear(topItem) && gainOf(topItem) > 0 && fitsLoad(itemWeight, gainOf(topItem));
          const canPick = !droppedHere && !isContainer && ((isPreferred && !wouldOverburden) || isUpgrade);

          if (canPick) {
            if (args.lastPickupPos !== curPos || args.lastPickupTurn !== curTurn) {
              return { action: { type: 'key' as const, key: 'KeyG' }, curPos, curTurn, curFloor, pickupAttempted: true };
            }
          }
        }

        let seenStairsDown: { x: number; y: number } | null = null;
        for (let y = 0; y < e.map.height; y++) {
          for (let x = 0; x < e.map.width; x++) {
            const t = e.map.getTile(x, y);
            if (t && (t.isStairsDown || t.type === 'stairs_down') && e.fov.isExplored(x, y)) {
              seenStairsDown = { x, y };
              break;
            }
          }
        }

        const turnsOnFloor = curTurn - args.floorEnteredTurn;
        const timeout = turnsOnFloor >= 400;
        const frontierStep = bfsStepToFrontier(p);

        if ((!frontierStep || timeout) && seenStairsDown) {
          // Done with this floor: at the shopping floor, with money to spend, go home first.
          if (args.trip === 'none' && curFloor === args.shopFloor && funds() >= 800) {
            return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor, tripUp: true };
          }
          if (p.x === seenStairsDown.x && p.y === seenStairsDown.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, seenStairsDown, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        if (frontierStep) {
          return { action: { type: 'key' as const, key: stepToKey(frontierStep.x - p.x, frontierStep.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (seenStairsDown) {
          if (p.x === seenStairsDown.x && p.y === seenStairsDown.y) {
            return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor };
          }
          const step = bfsStepToGoal(p, seenStairsDown, true);
          if (step) {
            return { action: { type: 'key' as const, key: stepToKey(step.x - p.x, step.y - p.y) }, curPos, curTurn, curFloor };
          }
        }

        return { action: { type: 'key' as const, key: 'KeyS' }, curPos, curTurn, curFloor };
      }

      return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor };
    },
    {
      inDialog,
      floorEnteredTurn: state.floorEnteredTurn,
      lastRestAttemptTurn: state.lastRestAttemptTurn,
      lastPickupPos: state.lastPickupPos,
      lastPickupTurn: state.lastPickupTurn,
      droppedTiles: state.droppedTiles,
      equipTried: state.equipTried,
      shopDone: state.shopDone,
      shopDecisions: state.shopDecisions,
      trip: state.trip,
      shopFloor: Number(process.env.SOAK_SHOP_FLOOR ?? 4),
    }
  );

  // Update bot state tracking in Node
  const { action, curPos, curTurn, curFloor, restAttempted, pickupAttempted } = evalResult;

  if (curFloor !== state.lastFloorSeen) {
    state.lastFloorSeen = curFloor;
    state.floorEnteredTurn = curTurn;
    if (curFloor === 0) {
      // A new stay in town: every merchant again.
      state.shopDone = [];
      state.shopDecisions = 0;
      if (state.trip === 'up') {
        state.trip = 'down';
        console.log(`[soak:player] Back in town to shop, turn ${curTurn}`);
      }
    }
    if (state.trip === 'down' && curFloor > Number(process.env.SOAK_SHOP_FLOOR ?? 4)) state.trip = 'done';
  }
  if (evalResult.tripUp && state.trip === 'none') {
    state.trip = 'up';
    console.log(`[soak:player] Heading back to town to shop from floor ${curFloor}, turn ${curTurn}`);
  }
  if (evalResult.equipTried) {
    state.equipTried.push(evalResult.equipTried);
    state.equips++;
  }
  if (evalResult.shedTried) state.equipTried.push(evalResult.shedTried);
  if (evalResult.inShop) state.shopDecisions++;
  if (evalResult.shopFinished && !state.shopDone.includes(evalResult.shopFinished)) state.shopDone.push(evalResult.shopFinished);
  if (evalResult.bought) state.purchases++;
  if (evalResult.sold) state.sales++;

  if (restAttempted) {
    state.lastRestAttemptTurn = curTurn;
  }
  if (pickupAttempted) {
    state.lastPickupPos = curPos;
    state.lastPickupTurn = curTurn;
  }

  if (evalResult.itemDropped) {
    const tileKey = `${evalResult.droppedFloor ?? curFloor}:${evalResult.droppedPos ?? curPos}`;
    state.droppedTiles[tileKey] = true;
    state.droppedItemsCount++;
    console.log(`[soak:player] Dropped item #${state.droppedItemsCount} at ${tileKey}`);
    saveOverburdenStats(
      process.env.SOAK_SEED,
      state.overburdenedEpisodes,
      state.droppedItemsCount,
      Object.keys(state.droppedTiles)
    );
  }

  if (evalResult.isOverburdened) {
    if (!state.wasOverburdened) {
      state.wasOverburdened = true;
      state.overburdenedEpisodes++;
      console.log(
        `[soak:player] Overburdened episode #${state.overburdenedEpisodes} at ${curPos}, floor ${curFloor}, turn ${curTurn}`
      );
      saveOverburdenStats(
        process.env.SOAK_SEED,
        state.overburdenedEpisodes,
        state.droppedItemsCount,
        Object.keys(state.droppedTiles)
      );
    }
    state.stuckDecisions = 0;
    state.unstickStepsRemaining = 0;
  } else {
    state.wasOverburdened = false;
  }

  // --- 5. Stuck handling ----------------------------------------------------
  const sameState = curPos === state.lastPos && curTurn === state.lastTurn && curFloor === state.lastFloor;
  state.lastPos = curPos;
  state.lastTurn = curTurn;
  state.lastFloor = curFloor;

  // Trading and the inventory take no turns: only a stall on the map counts as stuck.
  if (sameState && !evalResult.isOverburdened && !inDialog) {
    state.stuckDecisions++;
    if (state.stuckDecisions >= 15) {
      state.stuckEpisodes++;
      state.unstickStepsRemaining = 5;
      state.stuckDecisions = 0;
      console.log(
        `[soak:player] Stuck episode #${state.stuckEpisodes} at ${curPos}, floor ${curFloor}, turn ${curTurn} (15 unchanged decisions). Taking 5 seeded random steps.`
      );
    }
  } else {
    state.stuckDecisions = 0;
  }

  (page as any).__playerStuckEpisodes = state.stuckEpisodes;
  (page as any).__playerOverburdenedCount = state.overburdenedEpisodes;
  (page as any).__playerItemsDropped = state.droppedItemsCount;
  (page as any).__playerGear = { equips: state.equips, purchases: state.purchases, sales: state.sales, townTrip: state.trip };

  return action;
}
