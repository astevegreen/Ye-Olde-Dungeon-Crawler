import type { GameEngine } from '../engine';
import type { Position } from '../types';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import { TILES } from '../grid/tile';
import { flightRecorder } from './flightRecorder';

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
  /** Changes floor (0 is town); returns the floor reached. */
  jumpToFloor(floor: number): number;
  /** Kills every hostile monster in view, awarding XP and loot as a kill would. */
  killVisibleMonsters(): number;
  /** Awards exactly the XP to reach the next level; returns the new level. */
  grantLevel(): number;
  /** Identifies everything the hero carries; returns how many items changed. */
  identifyAll(): number;
  /** Sets the run's PRNG state (the value reports show as "PRNG State"). */
  setPrngState(state: number): void;
}

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
  return {
    restoreVitals: () => {
      const p = engine.player;
      const hp = p.maxHp - p.hp;
      const mana = p.maxMana - p.mana;
      if (hp > 0) p.heal(hp);
      if (mana > 0) p.restoreMana(mana);
      return { hp: Math.max(0, hp), mana: Math.max(0, mana) };
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
      const target = Math.max(0, Math.floor(floor));
      engine.changeFloor(target);
      return engine.currentFloor;
    },

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

    grantLevel: () => {
      const p = engine.player;
      const res = p.gainXp(Math.max(1, p.xpToNextLevel - p.xp), engine.manifest?.progressionConfig);
      if (res.leveledUp) {
        engine.log(`*** LEVEL UP! Welcome to Level ${res.newLevel}! ***`);
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
    },

    identifyAll: () => {
      let count = 0;
      for (const item of engine.player.inventory.getAllCarriedItems()) {
        if (!engine.identification.isIdentified(item)) {
          engine.identification.identifyItem(item);
          count++;
        }
      }
      return count;
    },

    setPrngState: (state) => {
      engine.prng.setState(state);
    },
  };
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
            const result = (fn as (...a: unknown[]) => unknown)(...args);
            flightRecorder.recordState('triage', `F2 triage: ${name}`, { operation: name });
            flightRecorder.requestCheckpoint(`F2 triage: ${name}`);
            return result;
          }
        : fn;
  }
  return wrapped as T & TriageAPI;
}
