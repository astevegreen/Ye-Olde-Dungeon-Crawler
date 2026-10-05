import {
  AttributeCalculator,
  createScaledMonster,
  getCounter,
  incrementCounter,
  Monster,
  selectDungeonMonsterDefinition,
  type ActionHook,
  type AttributeModifier,
  type EngineContext,
  type Entity,
  type StatusHandler,
  type StatusTickOutput,
} from '../../engine';
import { COTW_MONSTERS } from './monsters';
import { COTW_MONSTER_SCALING } from './monsterScaling';
import { FLOOR21_DARK } from './siphonPylon';
import { FLOOR30_DARK } from './bileSump';

/**
 * Dark floors (tracker 5.3, Q12 "A", Q30): floors whose light something has drunk. Until the
 * floor is relit (its `relitFlag`, set by whatever the floor's story makes relight it), the hero
 * sees 2 paces, or 5 with a torch in the off hand; the monsters there are bolder; and more slither
 * out of the dark toward the hero. The Giant's Blood pattern (`giantBlood.ts`): a post action hook
 * keeps ambient statuses in step with the floor, and each status's `onTick` takes itself off once
 * the dark lifts.
 */
export interface DarkFloor {
  floor: number;
  /** Set when the floor is relit; the dark never returns. */
  relitFlag: string;
  /** Logged the first time the hero stands in this floor's dark. */
  enterMessage: string;
  /**
   * What relights the floor, a tile or a monster: after the entry line, `message` says in which
   * direction it lies (`{direction}`, an eight-point compass word).
   */
  beacon?: { tileId?: string; monsterDefinitionId?: string; message: string };
  /**
   * The floor relights itself once no living monster of this definition is on it (its keeper
   * slain, however it died), logging `relitMessage`.
   */
  relitWhenSlain?: string;
  relitMessage?: string;
}

/** Which floors are dark: floor 21 (tracker 5.4) and floor 30 (5.5). */
export const COTW_DARK_FLOORS: DarkFloor[] = [FLOOR21_DARK, FLOOR30_DARK];

/** On the hero: sight cut to 2 (`perceptionRadius`, the engine's sight override). */
export const DARKNESS_STATUS = 'cotw:darkness';
/** On the hero holding a torch in the dark: sight cut to 5 instead. */
export const TORCHLIT_STATUS = 'cotw:torchlit';
/** On the monsters of a dark floor: a quarter more attack. */
export const EMBOLDENED_STATUS = 'cotw:emboldened';

export const DARK_SIGHT = 2;
export const TORCH_SIGHT = 5;
const EMBOLDENED_ATTACK = 1.25;

/** Hero actions on a dark floor between two tries at drawing a monster out of the dark. */
export const DARK_SPAWN_INTERVAL = 25;
/** The chance that a try draws one. */
const DARK_SPAWN_CHANCE = 0.6;
/** The most monsters the dark gives up on one floor, all visits together. */
export const DARK_SPAWN_CAP = 6;
/** How far from the hero one comes out of the dark (Euclidean tiles): beyond torchlight. */
const DARK_SPAWN_MIN = 8;
const DARK_SPAWN_MAX = 14;

/** The dark floor the context stands on, while it is still dark. */
export function activeDarkFloor(ctx: Pick<EngineContext, 'currentFloor' | 'getWorldFlag'>, floors: DarkFloor[]): DarkFloor | undefined {
  const dark = floors.find((f) => f.floor === ctx.currentFloor);
  return dark && !ctx.getWorldFlag(dark.relitFlag) ? dark : undefined;
}

/** Whether a torch (an item of category `light`) is in the hero's hands. */
export function holdsTorch(entity: Entity): boolean {
  const actor = entity as { inventory?: { paperdoll?: { getEquippedItems?: () => Array<{ category?: string }> } } };
  return (actor.inventory?.paperdoll?.getEquippedItems?.() ?? []).some((item) => item.category === 'light');
}

/** The dark's statuses end themselves once the floor is lit (left, or relit). */
function lastsWhileDark(statusId: string, floors: DarkFloor[]): StatusHandler {
  return {
    onTick(entity: Entity, effect, engine): StatusTickOutput {
      effect.duration = 9999;
      if (!activeDarkFloor(engine, floors)) entity.statusManager.removeStatus(statusId);
      return { damageTaken: 0, killed: false };
    },
  };
}

export function darknessHandlers(floors: DarkFloor[]): Record<string, StatusHandler> {
  return {
    [DARKNESS_STATUS]: { ...lastsWhileDark(DARKNESS_STATUS, floors), perceptionRadius: DARK_SIGHT },
    [TORCHLIT_STATUS]: { ...lastsWhileDark(TORCHLIT_STATUS, floors), perceptionRadius: TORCH_SIGHT },
    [EMBOLDENED_STATUS]: lastsWhileDark(EMBOLDENED_STATUS, floors),
  };
}

/**
 * After each hero action on a dark floor: the hero's sight status matches the torch, every monster
 * on a dark floor is emboldened, and every DARK_SPAWN_INTERVAL actions the dark may give up a
 * monster, awake and coming for the hero.
 */
export function createDarknessHook(floors: DarkFloor[]): ActionHook {
  return {
    id: 'cotw-darkness',
    phase: 'post',
    actionType: '*',
    execute: ({ actor, engine }) => {
      const player = engine.player;
      if (actor !== player) return;
      // Off a dark floor there is nothing to do: the dark's statuses end themselves (onTick).
      const dark = activeDarkFloor(engine, floors);
      if (!dark) return;

      const seenFlag = `cotw:dark_seen_${dark.floor}`;
      if (!engine.getWorldFlag(seenFlag)) {
        engine.setWorldFlag(seenFlag, true);
        const at = dark.beacon ? findBeacon(engine, dark.beacon) : undefined;
        if (dark.beacon && !at) {
          // A floor made before it went dark (an older save's stored floor) has nothing to
          // relight it with: it keeps its light.
          engine.setWorldFlag(dark.relitFlag, true);
          return;
        }
        engine.log(dark.enterMessage);
        if (dark.beacon && at) engine.log(dark.beacon.message.replace('{direction}', compass(player, at)));
      }

      if (dark.relitWhenSlain && !keeperAlive(engine, dark.relitWhenSlain)) {
        engine.setWorldFlag(dark.relitFlag, true);
        if (dark.relitMessage) engine.log(dark.relitMessage);
        return;
      }
      const sight = holdsTorch(player) ? TORCHLIT_STATUS : DARKNESS_STATUS;
      const other = sight === TORCHLIT_STATUS ? DARKNESS_STATUS : TORCHLIT_STATUS;
      if (player.statusManager.hasStatus(other)) player.statusManager.removeStatus(other);
      if (!player.statusManager.hasStatus(sight)) player.statusManager.applyStatus({ type: sight, duration: 9999 });

      for (const entity of engine.map.getAllEntities()) {
        if (entity instanceof Monster && entity.faction === 'hostile' && entity.isAlive() && !entity.statusManager.hasStatus(EMBOLDENED_STATUS)) {
          entity.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });
        }
      }

      const actions = incrementCounter(engine.worldState, `cotw:dark_actions_${dark.floor}`);
      if (actions % DARK_SPAWN_INTERVAL === 0) spawnFromTheDark(engine, dark);
    },
  };
}

function keeperAlive(ctx: EngineContext, definitionId: string): boolean {
  return ctx.map.getAllEntities().some((e) => e instanceof Monster && e.definitionId === definitionId && e.isAlive());
}

function findBeacon(ctx: EngineContext, beacon: NonNullable<DarkFloor['beacon']>): { x: number; y: number } | undefined {
  if (beacon.monsterDefinitionId) {
    const monster = ctx.map.getAllEntities().find((e) => e instanceof Monster && e.definitionId === beacon.monsterDefinitionId && e.isAlive());
    if (monster) return monster;
  }
  if (beacon.tileId) {
    for (let y = 0; y < ctx.map.height; y++) {
      for (let x = 0; x < ctx.map.width; x++) if (ctx.map.getTile(x, y)?.type === beacon.tileId) return { x, y };
    }
  }
  return undefined;
}

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** The eight-point compass direction from one tile to another (y grows southward). */
function compass(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const octant = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / (Math.PI / 4));
  return COMPASS[(octant + 8) % 8];
}

function spawnFromTheDark(ctx: EngineContext, dark: DarkFloor): void {
  const spawnedKey = `cotw:dark_spawned_${dark.floor}`;
  if (getCounter(ctx.worldState, spawnedKey) >= DARK_SPAWN_CAP || ctx.rng() >= DARK_SPAWN_CHANCE) return;
  const def = selectDungeonMonsterDefinition(COTW_MONSTERS, ctx.currentFloor, ctx.rng);
  if (!def) return;

  const { player, map } = ctx;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = ctx.rng() * Math.PI * 2;
    const reach = DARK_SPAWN_MIN + ctx.rng() * (DARK_SPAWN_MAX - DARK_SPAWN_MIN);
    const x = Math.round(player.x + Math.cos(angle) * reach);
    const y = Math.round(player.y + Math.sin(angle) * reach);
    if (!map.isPassable(x, y) || map.getEntityAt(x, y)) continue;

    const spawned = incrementCounter(ctx.worldState, spawnedKey);
    const monster = createScaledMonster(
      def,
      `dark-${dark.floor}-${spawned}`,
      { x, y },
      ctx.currentFloor,
      undefined,
      player.level,
      COTW_MONSTER_SCALING,
      player.difficulty
    );
    monster.alert();
    monster.statusManager.applyStatus({ type: EMBOLDENED_STATUS, duration: 9999 });
    if (ctx.addEntity(monster)) ctx.log('Something stirs in the dark and comes slithering toward you.');
    return;
  }
}

function emboldened(actor: Entity): boolean {
  return actor.statusManager?.hasStatus(EMBOLDENED_STATUS) ?? false;
}

const EMBOLDENED_ATTACK_MODIFIER: AttributeModifier = {
  id: 'cotw-emboldened-attack',
  attributeKey: 'attack',
  phase: 'multiplier',
  apply: (currentValue, actor) => (emboldened(actor) ? Math.round(currentValue * EMBOLDENED_ATTACK) : currentValue),
};

AttributeCalculator.registerModifier(EMBOLDENED_ATTACK_MODIFIER);

export const COTW_DARKNESS_HANDLERS = darknessHandlers(COTW_DARK_FLOORS);
export const COTW_DARKNESS_HOOK = createDarknessHook(COTW_DARK_FLOORS);
