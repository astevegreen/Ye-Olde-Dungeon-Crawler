import type { GameEngine } from '../engine';
import type { Position } from '../types';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import { growCompanion } from '../combat/lastStand';
import { TILES } from '../grid/tile';
import { flightRecorder } from './flightRecorder';
import { concludePrologue, isPrologueRunning } from '../quest/prologue';
import { createScaledItem } from '../dungeon/lootSpawner';
import type { EquipmentSlot } from '../items/item';
import type { ItemDefinition } from '../types/manifest';

/**
 * Developer triage operations behind the F2 menu (ARCHITECTURE.md §2: triage methods
 * live under `engine.diagnostics`). They change state outside the action pipeline, so
 * every one of them asks the flight recorder for a fresh replay checkpoint: a trail
 * recorded across one of these could not be replayed.
 */
export interface TriageAPI {
  /** Refills HP and mana; returns what was restored. */
  restoreVitals(): { hp: number; mana: number };
  /** Removes every status effect on the hero; returns how many there were. */
  clearStatusEffects(): number;
  /** Reveals every secret door and hidden trap on the floor, with no roll and no renown. */
  revealSecrets(): { doors: number; traps: number };
  /** Moves the hero onto (or, if it can't be stood on, next to) the floor's stairs. */
  teleportToStairs(direction: 'up' | 'down'): Position | null;
  /** Changes floor (0 is town), ending any prologue under way first; returns the floor reached. */
  jumpToFloor(floor: number): number;
  /** Ends the pack's prologue if one is under way, as the engine's own ending does (its
   *  monsters and NPCs leave, the town is lit, the HP floor lifts); whether one was. The pack's
   *  own ending (who was saved, who taken) does not run. */
  endPrologue(): boolean;
  /** Kills every hostile monster in view, awarding XP and loot as a kill would. */
  killVisibleMonsters(): number;
  /** Awards exactly the XP to reach the next level; returns the new level. */
  grantLevel(): number;
  /** Identifies everything the hero carries; returns how many items changed. */
  identifyAll(): number;
  /** Sets the run's PRNG state (the value reports show as "PRNG State"). */
  setPrngState(state: number): void;
  /**
   * Outfits the hero as one who reached `floor` might be (a deep-floor soak's start, or a
   * look at a deep floor from F2):
   * - Levels up to `targetLevel`, by default 1 + 0.7 × floor within the pack's cap. The
   *   points stay unspent.
   * - Wears, in each equipment slot, the pack's strongest random-loot definition allowed that
   *   deep, rolled at that floor. A roll that binds is passed over. Everything is identified.
   * - Carries two healing potions, plus one more for every five floors.
   * Returns the level reached and the names of what it wore.
   */
  outfitForFloor(floor: number, targetLevel?: number): { level: number; worn: string[] };
}

/** Slots an outfit fills, and the slot its definitions name (both rings are `fingerLeft`). */
const OUTFIT_SLOTS: Array<{ slot: EquipmentSlot; defSlot: string }> = [
  { slot: 'mainHand', defSlot: 'mainHand' },
  { slot: 'offHand', defSlot: 'offHand' },
  { slot: 'head', defSlot: 'head' },
  { slot: 'torso', defSlot: 'torso' },
  { slot: 'overgarment', defSlot: 'overgarment' },
  { slot: 'hands', defSlot: 'hands' },
  { slot: 'wrists', defSlot: 'wrists' },
  { slot: 'waist', defSlot: 'waist' },
  { slot: 'feet', defSlot: 'feet' },
  { slot: 'neck', defSlot: 'neck' },
  { slot: 'fingerLeft', defSlot: 'fingerLeft' },
  { slot: 'fingerRight', defSlot: 'fingerLeft' },
];

function findStairs(engine: GameEngine, direction: 'up' | 'down'): Position | null {
  const { map } = engine;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.getTile(x, y);
      const match = direction === 'down' ? tile?.isStairsDown || tile?.type === 'stairs_down' : tile?.isStairsUp || tile?.type === 'stairs_up';
      if (match) return { x, y };
    }
  }
  return null;
}

function standableAt(engine: GameEngine, x: number, y: number): boolean {
  const occupant = engine.map.getEntityAt(x, y);
  return engine.map.isPassable(x, y) && (!occupant || occupant === engine.player);
}

function createTriageApi(engine: GameEngine): TriageAPI {
  const endPrologue = (): boolean => {
    const prologue = engine.manifest.prologue;
    if (!prologue || !isPrologueRunning(engine.worldState, prologue)) return false;
    concludePrologue(engine, prologue, engine.manifest.town?.lit ?? false);
    engine.updateFov();
    return true;
  };

  return {
    // A refill, not a heal: no worn healing multiplier scales it down, a dead hero stays dead,
    // and it reports what it actually restored (R-dbg-15).
    restoreVitals: () => {
      const p = engine.player;
      const hp = p.isAlive() ? Math.max(0, p.maxHp - p.hp) : 0;
      if (hp > 0) p.hp = p.maxHp;
      const mana = p.restoreMana(p.maxMana - p.mana);
      return { hp, mana };
    },

    clearStatusEffects: () => {
      const active = engine.player.statusManager.getAll().map((s) => s.type);
      for (const type of active) engine.player.statusManager.removeStatus(type);
      engine.updateFov();
      return active.length;
    },

    revealSecrets: () => {
      const { map } = engine;
      let doors = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const tile = map.getTile(x, y);
          if (tile && (tile.isSecret || tile.type === 'secret_door' || tile.hidden)) {
            map.setTile(x, y, { ...TILES.DOOR_CLOSED, hidden: false });
            doors++;
          }
        }
      }
      let traps = 0;
      for (const trap of map.getAllTraps()) {
        if (!trap.revealed) {
          trap.revealed = true;
          map.setTile(trap.x, trap.y, TILES.TRAP);
          traps++;
        }
      }
      engine.updateFov();
      return { doors, traps };
    },

    teleportToStairs: (direction) => {
      const stairs = findStairs(engine, direction);
      if (!stairs) return null;
      // Some stairs (the town's) are a building face, not a floor tile: stand beside them.
      const candidates: Position[] = [stairs];
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        candidates.push({ x: stairs.x + dx, y: stairs.y + dy });
      }
      const target = candidates.find((c) => engine.map.inBounds(c.x, c.y) && standableAt(engine, c.x, c.y));
      if (!target || !engine.map.moveEntity(engine.player, target.x, target.y)) return null;
      engine.updateFov();
      return target;
    },

    jumpToFloor: (floor) => {
      // Left running, a prologue would keep its HP floor in the dungeon.
      endPrologue();
      const target = Math.max(0, Math.floor(floor));
      engine.changeFloor(target);
      return engine.currentFloor;
    },

    endPrologue,

    killVisibleMonsters: () => {
      const targets = engine.map
        .getAllEntities()
        .filter(
          (e): e is Monster =>
            e instanceof Monster &&
            e.isAlive() &&
            e !== engine.companion &&
            e.faction !== 'player' &&
            engine.fov.isVisible(e.x, e.y)
        );
      for (const m of targets) DeathResolver.resolveDeath(engine, engine.player, m);
      engine.updateFov();
      return targets.length;
    },

    grantLevel: () => levelUp(),

    identifyAll: () => {
      let count = 0;
      for (const item of engine.player.inventory.getAllCarriedItems()) {
        if (!item.identified) {
          engine.identification.identifyItem(item);
          count++;
        }
      }
      return count;
    },

    setPrngState: (state) => {
      engine.prng.setState(state);
    },

    outfitForFloor: (floor, targetLevel) => {
      const depth = Math.max(1, Math.floor(floor));
      const p = engine.player;
      const goal = Math.max(1, Math.floor(targetLevel ?? 1 + 0.7 * depth));
      while (p.level < goal && !p.isAtLevelCap) {
        const before = p.level;
        levelUp();
        if (p.level === before) break;
      }

      // The strongest definition a random drop that deep could be: its slot's one number.
      const allowed = (d: ItemDefinition): boolean => (d.minFloor ?? 1) <= depth && d.lootWeight !== 0 && !d.twoHanded;
      const score = (d: ItemDefinition, slot: EquipmentSlot): number =>
        slot === 'mainHand' ? d.stats?.attackBonus ?? 0 : (d.stats?.defenseBonus ?? 0) + (d.stats?.attackBonus ?? 0);
      const items = engine.manifest?.items ?? [];
      const worn: string[] = [];
      const taken = new Set<string>();
      let n = 0;
      for (const { slot, defSlot } of OUTFIT_SLOTS) {
        const candidates = items
          .filter((d) => d.slot === defSlot && allowed(d) && !taken.has(d.id))
          .sort((a, b) => score(b, slot) - score(a, slot) || (b.tier ?? 0) - (a.tier ?? 0) || a.id.localeCompare(b.id));
        for (const def of candidates) {
          // A plain roll at that depth (the shop's midpoint draw), never one that binds.
          const item = createScaledItem(def, `outfit-${slot}-${n++}`, depth, () => 0.5, engine.manifest?.itemFamilies);
          if (item.isBound() || item.isCursed()) continue;
          engine.identification.identifyItem(item);
          const res = p.inventory.paperdoll.equip(item, slot);
          if (!res.success) continue;
          taken.add(def.id);
          worn.push(item.displayName);
          break;
        }
      }

      // Healing for the depth: the pack's strongest restore_hp potion allowed there.
      const healing = items
        .filter((d) => (d.minFloor ?? 1) <= depth && (d.potionConfig?.effects ?? []).some((f) => f.type === 'restore_hp'))
        .sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || a.id.localeCompare(b.id))[0];
      if (healing) {
        for (let i = 0; i < 2 + Math.floor(depth / 5); i++) {
          const potion = createScaledItem(healing, `outfit-potion-${i}`, depth, () => 0.5, engine.manifest?.itemFamilies);
          engine.identification.identifyItem(potion);
          p.inventory.primaryPack.addItem(potion);
        }
      }
      return { level: p.level, worn };
    },
  };

  function levelUp(): number {
    const p = engine.player;
    const res = p.gainXp(Math.max(1, p.xpToNextLevel - p.xp), engine.manifest?.progressionConfig);
    if (res.leveledUp) {
      engine.log(`*** LEVEL UP! Welcome to Level ${res.newLevel}! ***`);
      growCompanion(engine);
      // Same event a kill emits, so the level-up allocation dialog opens as usual.
      engine.emitGameEvent({
        type: 'player_leveled_up',
        turn: engine.turnCount,
        actorId: p.id,
        level: res.newLevel,
        newLevel: res.newLevel,
        statPointsAwarded: res.statPointsAwarded ?? 3,
        unspentStatPoints: p.unspentStatPoints,
        statGains: res.statGains,
      });
    }
    return p.level;
  }
}

/**
 * Builds `engine.diagnostics` from the engine's own core methods plus the triage
 * operations above, wrapping every one so it logs to the flight recorder and requests
 * a replay checkpoint.
 */
export function createDiagnosticsApi<T extends object>(engine: GameEngine, core: T): T & TriageAPI {
  const api = { ...core, ...createTriageApi(engine) } as T & TriageAPI;
  const wrapped = {} as Record<string, unknown>;
  for (const [name, fn] of Object.entries(api)) {
    wrapped[name] =
      typeof fn === 'function'
        ? (...args: unknown[]) => {
            // Recorded even when it throws: one that changed state first must still leave a
            // checkpoint, or a replay misses the change (R-dbg-11).
            try {
              return (fn as (...a: unknown[]) => unknown)(...args);
            } finally {
              flightRecorder.recordState('triage', `F2 triage: ${name}`, { operation: name });
              flightRecorder.requestCheckpoint(`F2 triage: ${name}`);
            }
          }
        : fn;
  }
  return wrapped as T & TriageAPI;
}
