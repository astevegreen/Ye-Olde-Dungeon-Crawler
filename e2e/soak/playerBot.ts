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
  /** Town services ("npcId:act") done or found to change nothing this time in town. */
  serviceTried: string[];
  /** The last service key pressed, and what the panel showed before it (to see if it did anything). */
  lastService: { key: string; fp: string } | null;
  /** Decisions spent in the character menu since it opened (a cap against loops). */
  charMenuDecisions: number;
  /** Attribute keys pressed so far: picks the next one in the fixed build's rotation. */
  statPresses: number;
  /** Unspent points when the bot last pressed an attribute key, and how many presses changed nothing. */
  lastUnspent: number;
  statFailures: number;
  telemetry: BotTelemetry;
}

/** What the bot did and saw over a run, for summary.json (step 1 of the soak-bot plan). */
export interface BotTelemetry {
  potionsDrunk: number;
  /** Decisions taken standing on a tile a monster's telegraphed attack will hit. */
  telegraphTurns: number;
  dodges: number;
  /** In a telegraph with no safe tile to step to. */
  cornered: number;
  statPointsSpent: number;
  perksTaken: number;
  chestsLooted: number;
  /** Town services that changed something, by "npcId:act". */
  services: Record<string, number>;
  /** Most loose coins seen in the pack at once (the purse overflowing). */
  maxLooseCoins: number;
  /** Biggest worn purse over the run, in coins (300 is the starting pouch). */
  maxPurseCap: number;
  /** Mastery perks are `perksTaken`; these are the Saga and milestone perks held at the end. */
  heldPerks: Record<string, number>;
  /** The hero's state at the last decision: what the death cause is read from. */
  last: BotSnapshot | null;
  deathCause?: DeathCause;
}

interface BotSnapshot {
  floor: number;
  hp: number;
  maxHp: number;
  adjacentHostiles: number;
  onTelegraph: boolean;
  /** On fire, acid, a firestorm or a poison cloud (the engine's surface layer). */
  onHazard: boolean;
  healingCarried: number;
  poisoned: boolean;
  unspent: number;
}

/** The surface layer's damage lines (src/engine/surfaces/surfaceGrid.ts). */
const HAZARD_LINE = /searing fire|lingering fire|oil inferno|firestorm|caustic|acid burn|electrocution|poison fumes/;
/** What the death screen names for those (`KillContext.cause` in surfaceGrid.ts `harm`). */
const HAZARD_CAUSES = new Set(['searing fire', 'lingering fire', 'a firestorm', 'burning oil', 'acid', 'lightning']);

export type DeathCause =
  | 'hazard'
  | 'trap'
  | 'telegraph'
  | 'surrounded'
  | 'out_of_potions'
  | 'overflow_backlash'
  | 'poison'
  | 'twinstrike'
  | 'holy_ground'
  | 'other';

/**
 * Why the hero died, from the death line and the bot's last look at the board. The first
 * match wins: a named self-inflicted cause, then a hazard tile, then poison, then where the
 * hero stood. Every overflow that hurts says "backlash" (the pack's tier table); "surge"
 * would also match the Kobold Shaman's Hellfire Surge. The death screen names a cause with
 * no creature behind it ("Slain by searing fire", "a pit trap", "poison"); older builds
 * said "Mortal Wounds", read from the lines before it.
 */
export function classifyDeath(causeOfDeath: string | null, last: BotSnapshot | null): DeathCause {
  const text = (causeOfDeath ?? '').toLowerCase();
  const killer = /slain by (.+?) on floor/.exec(text)?.[1] ?? 'mortal wounds';
  if (text.includes('backlash')) return 'overflow_backlash';
  // A missed swing that costs its bearer ("an overreaching blow"): Twinstrike's.
  if (text.includes('twinstrike') || killer === 'an overreaching blow') return 'twinstrike';
  if (/holy ground|sacred|hallowed/.test(text)) return 'holy_ground';
  if (HAZARD_CAUSES.has(killer)) return 'hazard';
  if (killer.endsWith(' trap')) return 'trap';
  if (killer === 'poison') return 'poison';
  // Only when no monster is named: the last lines can also be a monster burning nearby.
  if (killer === 'mortal wounds' && (HAZARD_LINE.test(text) || last?.onHazard)) return 'hazard';
  if (last?.poisoned && text.includes('poison')) return 'poison';
  if (last?.onTelegraph) return 'telegraph';
  if ((last?.adjacentHostiles ?? 0) >= 3) return 'surrounded';
  if (last && last.healingCarried === 0) return 'out_of_potions';
  return 'other';
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
      serviceTried: [],
      lastService: null,
      charMenuDecisions: 0,
      statPresses: 0,
      lastUnspent: -1,
      statFailures: 0,
      telemetry: {
        potionsDrunk: 0,
        telegraphTurns: 0,
        dodges: 0,
        cornered: 0,
        statPointsSpent: 0,
        perksTaken: 0,
        chestsLooted: 0,
        services: {},
        maxLooseCoins: 0,
        maxPurseCap: 0,
        heldPerks: {},
        last: null,
      },
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
  /** A town service key pressed ("npcId:act"); `once` marks it done for this stay at once. */
  service?: { key: string; once: boolean };
  /** What the open service panel shows now: compared with the last press to see if it worked. */
  serviceFp?: string;
  /** No service left worth pressing at this townsperson. */
  serviceDone?: string;
  inCharMenu?: boolean;
  statPress?: boolean;
  perk?: boolean;
  chest?: boolean;
  potion?: boolean;
  telegraph?: 'dodge' | 'cornered' | 'stay';
  looseCoins?: number;
  snapshot?: BotSnapshot;
  /** The worn purse's capacity in coins: rises when an Olaf purse is bought and worn. */
  purseCap?: number;
  /** Saga and milestone perks the hero holds, by source (family perks live in the compendium). */
  heldPerks?: Record<string, number>;
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
 * things on, so it never puts on a piece of a negative family. Every move is a real key press.
 *
 * The soak-bot plan (Notion, "Soak bot · the measuring instrument"), steps 1-3: it spends
 * each level's point (U, then S / C / D in turn, the one fixed build for balance runs),
 * takes a family's mastery perk, loots chests, and steps out of a telegraphed attack onto
 * open floor. In town it stops only where there's something to do: the Sage to identify,
 * the temple to cleanse, offer, take a blessing and heal, Olaf for a bigger purse once
 * coins spill, the Banker to exchange coins. A service key is pressed again only if the
 * last press changed the panel. What it did, and why the hero died, goes to summary.json.
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
      serviceTried: string[];
      statPresses: number;
      statGiveUp: boolean;
      charMenuDecisions: number;
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
      // A careful player doesn't put on what would bind or hurt: Cursed, Hexed and Hel-touched
      // pieces (and anything else of a negative family) are never upgrades.
      const isNegative = (it: any): boolean =>
        Boolean(it?.isBound?.() || it?.modifiers?.some?.((m: any) => m.alignment === 'negative' || m.binds));
      const gainOf = (it: any): number => {
        if (!isGear(it)) return 0;
        if (isNegative(it)) return -999;
        // A bound piece can't come off, so nothing in its slot is an upgrade.
        if (wornIn(it.slot)?.isBound?.()) return -999;
        return scoreOf(it) - (wornIn(it.slot) ? scoreOf(wornIn(it.slot)) : 0);
      };
      const packItems: any[] = p.inventory?.primaryPack?.getItems?.() ?? [];
      // A purse that holds more coins than the one worn is worth putting on.
      const capOf = (it: any): number => it?.maxBulkCapacity ?? 0;
      const isPurse = (it: any): boolean => it?.slot === 'purse' && typeof it?.getItems === 'function';
      const wornPurseCap = capOf(p.inventory?.purse);
      const purseCandidate = packItems
        .filter((it) => isPurse(it) && capOf(it) > wornPurseCap && !args.equipTried.includes(it.id))
        .sort((a, b) => capOf(b) - capOf(a) || String(a.id).localeCompare(String(b.id)))[0];
      const equipCandidate =
        packItems
          .filter((it) => isGear(it) && gainOf(it) > 0 && !args.equipTried.includes(it.id))
          .sort((a, b) => gainOf(b) - gainOf(a) || String(a.id).localeCompare(String(b.id)))[0] ?? purseCandidate;
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
      const looseCoins: number = packItems
        .filter((it) => it.category === 'currency')
        .reduce((n: number, it: any) => n + (it.count ?? it.quantity ?? 1), 0);
      const holdsSmallCoins = [p.inventory?.purse, p.inventory?.primaryPack].some((c) =>
        (c?.getItems?.() ?? []).some((it: any) => {
          if (it.category !== 'currency') return false;
          const name = String(it.name).toLowerCase();
          const denom = it.denomination ?? (['silver', 'copper'].find((d) => name.includes(d)) ?? 'gold');
          return denom !== 'gold';
        })
      );
      const healingCarriedCount = (p.inventory?.getAllCarriedItems?.() ?? [])
        .filter(isHealing)
        .reduce((n: number, it: any) => n + (it.quantity ?? 1), 0);
      const unspent: number = p.unspentStatPoints ?? 0;
      // Telegraphed attacks: the tiles a winding-up monster has declared it will hit.
      const dangerTiles: Array<{ x: number; y: number }> = [];
      for (const m of hostiles) {
        if (m.intent?.type !== 'windup' || !e.fov.isVisible(m.x, m.y)) continue;
        const raw = m.intent.targetTiles?.length ? m.intent.targetTiles : m.intent.targetTile ? [m.intent.targetTile] : [];
        for (const t of raw) if (t && typeof t.x === 'number' && typeof t.y === 'number') dangerTiles.push(t);
      }
      const inDanger = (x: number, y: number): boolean => dangerTiles.some((t) => t.x === x && t.y === y);
      // Tiles that hurt to stand on: a wind-up leaves fire on every tile it targeted.
      const onHazard = (x: number, y: number): boolean => {
        const s = e.surfaces?.getSurface?.(x, y);
        const g = e.surfaces?.getGas?.(x, y);
        return s === 'fire' || s === 'acid_pool' || g === 'fire_storm' || g === 'poison_cloud';
      };
      const snapshot = {
        floor: curFloor,
        hp: p.hp,
        maxHp: p.maxHp,
        adjacentHostiles: hostiles.filter((m: any) => cheb(m, p) === 1).length,
        onTelegraph: inDanger(p.x, p.y),
        onHazard: onHazard(p.x, p.y),
        healingCarried: healingCarriedCount,
        poisoned: Boolean(p.statusManager?.hasStatus?.('poison')),
        unspent,
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

      // Every decision also reports the snapshot and the loose coins, for the run's telemetry.
      const decision = ((): DecisionResult => {
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

      // A monster family's mastery perk: take the first one now rather than putting it off
      // (Escape defers it to the Bestiary). The arrows only highlight; Enter locks it in.
      if (stack.includes('mastery-choice')) {
        const focused = document.querySelector('.mastery-perk-row.is-focused');
        if (!focused) return { action: { type: 'key' as const, key: 'ArrowDown' }, curPos, curTurn, curFloor };
        return { action: { type: 'key' as const, key: 'Enter' }, curPos, curTurn, curFloor, perk: true };
      }

      // Character menu handling (for overburden recovery and general dismissal)
      const characterMenuOpen = stack.includes('character-menu') || Boolean(h?.characterMenuModal?.isOpen);
      if (characterMenuOpen) {
        const modal = h?.characterMenuModal;
        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';

        // However the menu got stuck, leave it after 40 decisions.
        if (args.charMenuDecisions >= 40) {
          return { action: { type: 'key' as const, key: 'Escape' }, curPos, curTurn, curFloor };
        }

        // Spend level points on the Character tab, one a decision. The fixed build for balance
        // runs: Strength, Constitution, Dexterity in turn (melee damage, health, hit chance).
        if (modal?.activeTabId === 'character' && unspent > 0 && !args.statGiveUp) {
          const ROTATION = ['KeyS', 'KeyC', 'KeyD'];
          const key = ROTATION[args.statPresses % ROTATION.length];
          return { action: { type: 'key' as const, key, secondaryKey: 'Enter' }, curPos, curTurn, curFloor, statPress: true };
        }

        if (!isOverburdened) {
          // Put on the better piece: the backpack panel, its cell, then E.
          const invTabE = modal?.tabs?.find?.((t: any) => t.id === 'inventory');
          const ce = invTabE?.controller;
          const groupsE: any[] = ce?.groups?.('backpack') ?? [];
          // In the dungeon a spare piece is dropped when the load is heavy; in town it is sold.
          const shed = curFloor > 0 ? shedCandidate : undefined;
          const want = equipCandidate ?? shed;
          const targetIdx = want ? groupsE.findIndex((g: any) => g.leadItem?.id === want.id) : -1;
          // Coins spilled into the pack go back into the purse (C), once a floor.
          if (looseCoins > 0 && p.inventory?.purse && !args.serviceTried.includes('inventory:consolidate')) {
            if (modal && modal.activeTabId !== 'inventory') {
              return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
            }
            return { action: { type: 'key' as const, key: 'KeyC' }, curPos, curTurn, curFloor, service: { key: 'inventory:consolidate', once: true } };
          }
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
        if (args.shopDecisions >= 150) return leave;

        // A townsperson's services (Sage, temple, Banker): each key pressed only while its
        // offer is enabled and the last press of it changed what the panel shows.
        if (!so?.merchant) {
          const panel = so?.panel?.(e);
          if (!panel) return leave;
          const serviceFp = JSON.stringify([panel.facts ?? '', panel.choices ?? [], panel.offers.map((o: any) => [o.act, o.disabled]), funds(), p.hp]);
          const enabled = (act: string) => panel.offers.find((o: any) => o.act === act && !o.disabled);
          const tried = (act: string) => args.serviceTried.includes(`${npcId}:${act}`);
          const press = (act: string, once: boolean) => {
            const offer = enabled(act);
            return {
              action: { type: 'key' as const, key: `Key${String(offer.key).toUpperCase()}` },
              curPos, curTurn, curFloor, inShop: true, serviceFp,
              service: { key: `${npcId}:${act}`, once },
            };
          };
          const role = so?.activeNpc?.role;
          const wornBound = (p.inventory?.paperdoll?.getAllEquipped?.() ?? []).some((en: any) => en.item?.isBound?.());
          const hurt = p.hp < p.maxHp || (p.statusManager?.getAll?.()?.length ?? 0) > 0;
          const plan: Array<[string, boolean, boolean]> =
            role === 'priest'
              ? [['cleanse', wornBound, true], ['offer', true, false], ['bless', true, false], ['heal', hurt, true]]
              : role === 'sage'
                ? [['identify', true, false]]
                : role === 'banker'
                  ? [['compact', holdsSmallCoins || looseCoins > 0, true]]
                  : [];
          for (const [act, wanted, once] of plan) {
            if (wanted && enabled(act) && !tried(act)) return press(act, once);
          }
          return { ...leave, serviceFp, serviceDone: npcId };
        }
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

        // Olaf's purses: the biggest one that holds more than the worn purse, once coins spill
        // into the pack (or there's money to spare). Kept beside 300 CP for potions.
        const heldPurseCap = Math.max(wornPurseCap, ...packItems.filter(isPurse).map(capOf));
        if (looseCoins > 0 || cash >= 1500) {
          let best = -1;
          buyRows.forEach((row, i) => {
            const it = row[0];
            if (!isPurse(it) || capOf(it) <= heldPurseCap || (prices.get(it) ?? Infinity) > cash - 300) return;
            if (best < 0 || capOf(it) > capOf(buyRows[best][0])) best = i;
          });
          if (best >= 0) return toRow('buy', best, { bought: true });
        }

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
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor, potion: true };
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
        }
        const carriedAll: any[] = [
          ...packItems,
          ...(p.inventory?.belt?.getItems?.() ?? []),
          ...(p.inventory?.paperdoll?.getAllEquipped?.() ?? []).map((en: any) => en.item),
        ].filter(Boolean);
        // Each stop only when it has something to do: the Sage first, so cursed loot is known
        // and can be offered; Olaf before the Banker, so coins a new purse spills get exchanged.
        const townStops: Array<[string, boolean]> = [
          ['npc-sage', carriedAll.some((it) => !it.identified && it.canBeIdentified?.())],
          [
            'npc-priest',
            carriedAll.some((it) => it.isBound?.() && p.inventory?.paperdoll?.getAllEquipped?.().some((en: any) => en.item === it)) ||
              packItems.some((it) => it.identified && it.modifiers?.some?.((m: any) => m.alignment === 'negative')) ||
              p.hp < p.maxHp * 0.75 ||
              snapshot.poisoned,
          ],
          ['npc-olaf', looseCoins > 0 || funds() >= 1500],
          ['npc-banker', holdsSmallCoins || looseCoins > 0],
          ['npc-gunther', true],
          ['npc-astrid', true],
        ];
        const nextStop = hallvardHeard
          ? townStops.find(([id, wanted]) => wanted && !args.shopDone.includes(id) && e.map.getEntityById(id))?.[0]
          : undefined;
        if (!hallvardHeard) {
          // Talking to Hallvard comes first (above).
        } else if (equipCandidate || (looseCoins > 0 && p.inventory?.purse && !args.serviceTried.includes('inventory:consolidate'))) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
        } else if (unspent > 0 && !args.statGiveUp) {
          return { action: { type: 'key' as const, key: 'KeyU' }, curPos, curTurn, curFloor };
        } else if (nextStop) {
          // Walk up and bump to trade.
          const id = nextStop;
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
          scan: for (let y = 0; y < e.map.height; y++) {
            for (let x = 0; x < e.map.width; x++) {
              const t = e.map.getTile(x, y);
              if (t && (t.isStairsDown || t.type === 'stairs_down')) {
                stairs = { x, y };
                break scan;
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
          if (potKey) return { action: { type: 'key' as const, key: potKey }, curPos, curTurn, curFloor, potion: true };
        }

        const isOverburdened = !p.canMove?.() || p.inventory?.getEncumbrance?.(p.strength) === 'Immobilized';
        if (isOverburdened) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor, isOverburdened: true };
        }

        // Standing where a telegraphed attack will land: step to a neighbouring open floor tile
        // it won't hit. Not a closed door: bumping one opens it and leaves the hero in place.
        if (snapshot.onTelegraph) {
          const safe: Array<{ dx: number; dy: number; adj: number }> = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = p.x + dx;
              const ny = p.y + dy;
              if (!e.map.inBounds(nx, ny) || inDanger(nx, ny)) continue;
              const t = e.map.getTile(nx, ny);
              if (!t || !t.passable || t.isClosedDoor || t.type === 'door_closed') continue;
              if (e.map.getEntityAt(nx, ny)) continue;
              safe.push({ dx, dy, adj: hostiles.filter((m: any) => cheb(m, { x: nx, y: ny }) === 1).length });
            }
          }
          safe.sort((a, b) => a.adj - b.adj || a.dy - b.dy || a.dx - b.dx);
          const best = safe[0];
          if (best) {
            return { action: { type: 'key' as const, key: stepToKey(best.dx, best.dy) }, curPos, curTurn, curFloor, telegraph: 'dodge' as const };
          }
          // Cornered: no tile to step to. Fight on (counted, so a report can see it).
          if (adjHostiles.length > 0) {
            const m = adjHostiles[0];
            return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor, telegraph: 'cornered' as const };
          }
          return { action: { type: 'key' as const, key: 'Space' }, curPos, curTurn, curFloor, telegraph: 'cornered' as const };
        }

        if (adjHostiles.length > 0) {
          const m = adjHostiles[0];
          return { action: { type: 'key' as const, key: stepToKey(m.x - p.x, m.y - p.y) }, curPos, curTurn, curFloor };
        }

        if (snipeAction) {
          return { action: snipeAction, curPos, curTurn, curFloor };
        }

        const visibleHostiles = hostiles.filter((m: any) => e.fov.isVisible(m.x, m.y));

        // Level points, and coins spilled into the pack, once nothing is in sight.
        if (visibleHostiles.length === 0 && unspent > 0 && !args.statGiveUp) {
          return { action: { type: 'key' as const, key: 'KeyU' }, curPos, curTurn, curFloor };
        }
        if (visibleHostiles.length === 0 && looseCoins > 0 && p.inventory?.purse && !args.serviceTried.includes('inventory:consolidate')) {
          return { action: { type: 'key' as const, key: 'KeyI' }, curPos, curTurn, curFloor };
        }
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
          // A chest (a secret cache holds one): G takes what's inside, one item a press.
          const isFullChest = isContainer && typeof topItem.getItems === 'function' && topItem.getItems().length > 0;
          const canPick = !droppedHere && (isFullChest || (!isContainer && ((isPreferred && !wouldOverburden) || isUpgrade)));

          if (canPick) {
            if (args.lastPickupPos !== curPos || args.lastPickupTurn !== curTurn) {
              return { action: { type: 'key' as const, key: 'KeyG' }, curPos, curTurn, curFloor, pickupAttempted: true, chest: isFullChest };
            }
          }
        }

        const seenStairsDown = findStairs('down');

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
      })();
      const inCharMenu = stack.includes('character-menu') || Boolean(h?.characterMenuModal?.isOpen);
      const heldPerks: Record<string, number> = {};
      for (const perk of p.heldPerks ?? []) heldPerks[perk.source] = (heldPerks[perk.source] ?? 0) + 1;
      const purseCap = Math.round(wornPurseCap / 10); // COIN_BULK_CM3 (economy/types.ts): bulk per coin
      return { ...decision, snapshot, looseCoins, inCharMenu, heldPerks, purseCap };
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
      serviceTried: state.serviceTried,
      statPresses: state.statPresses,
      statGiveUp: state.statFailures >= 6,
      charMenuDecisions: state.charMenuDecisions,
    }
  );

  // Update bot state tracking in Node
  const { action, curPos, curTurn, curFloor, restAttempted, pickupAttempted } = evalResult;

  const tel = state.telemetry;
  if (evalResult.snapshot) tel.last = evalResult.snapshot;
  tel.maxLooseCoins = Math.max(tel.maxLooseCoins, evalResult.looseCoins ?? 0);
  tel.maxPurseCap = Math.max(tel.maxPurseCap, evalResult.purseCap ?? 0);
  if (evalResult.heldPerks) tel.heldPerks = evalResult.heldPerks;

  // A service press counts when the panel changed after it; one that changed nothing is
  // not pressed again this stay.
  if (evalResult.serviceFp !== undefined && state.lastService) {
    if (evalResult.serviceFp === state.lastService.fp) {
      if (!state.serviceTried.includes(state.lastService.key)) state.serviceTried.push(state.lastService.key);
    } else {
      tel.services[state.lastService.key] = (tel.services[state.lastService.key] ?? 0) + 1;
    }
  }
  if (state.lastService?.key === 'inventory:consolidate') {
    tel.services['inventory:consolidate'] = (tel.services['inventory:consolidate'] ?? 0) + 1;
  }
  state.lastService = null;
  if (evalResult.service) {
    if (evalResult.service.once && !state.serviceTried.includes(evalResult.service.key)) state.serviceTried.push(evalResult.service.key);
    state.lastService = { key: evalResult.service.key, fp: evalResult.serviceFp ?? '' };
  }
  if (evalResult.serviceDone && !state.shopDone.includes(evalResult.serviceDone)) state.shopDone.push(evalResult.serviceDone);

  state.charMenuDecisions = evalResult.inCharMenu ? state.charMenuDecisions + 1 : 0;
  // Attribute keys: give up for the run after 6 presses that spent nothing (a capped build).
  const unspentNow = evalResult.snapshot?.unspent;
  if (state.lastUnspent >= 0 && unspentNow !== undefined) {
    if (unspentNow < state.lastUnspent) {
      tel.statPointsSpent += state.lastUnspent - unspentNow;
      state.statFailures = 0;
    } else {
      state.statFailures++;
    }
    state.lastUnspent = -1;
  }
  if (evalResult.statPress) {
    state.lastUnspent = unspentNow ?? 0;
    state.statPresses++;
  }
  if (evalResult.perk) tel.perksTaken++;
  if (evalResult.chest) tel.chestsLooted++;
  if (evalResult.potion) tel.potionsDrunk++;
  if (evalResult.snapshot?.onTelegraph) tel.telegraphTurns++;
  if (evalResult.telegraph === 'dodge') tel.dodges++;
  if (evalResult.telegraph === 'cornered') tel.cornered++;

  if (curFloor !== state.lastFloorSeen) {
    state.lastFloorSeen = curFloor;
    state.floorEnteredTurn = curTurn;
    state.serviceTried = state.serviceTried.filter((k) => k !== 'inventory:consolidate');
    if (curFloor === 0) {
      // A new stay in town: every merchant and service again.
      state.shopDone = [];
      state.shopDecisions = 0;
      state.serviceTried = [];
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
  (page as any).__playerTelemetry = tel;

  return action;
}
