import {
  applyLevelScaledElementalMitigation,
  type StatusHandler,
  type StatusTickOutput,
  type ActionHook,
  type Entity,
} from '../../engine';

/**
 * Járnviðr's environmental temperature hazard (Act 1 — see `quest.ts`): the dungeon
 * inverts from permafrost into soot-choked obsidian depths as the player descends,
 * and the protagonist's frost-giant heritage helps with exactly one of those two
 * halves. Levels roughly track floor depth here, so `COTW_PROGRESSION`'s
 * `elementalResistanceCurve` (character.ts) reads as a difficulty curve: strong
 * early (permafrost), weaker later (obsidian heat) — without the mitigation itself
 * ever touching combat's own categorical resistance system.
 */
export const JARNVIDR_EXPOSURE_STATUS = 'cotw:jarnvidr_exposure';

const PERMAFROST_FLOORS = { min: 1, max: 12 };
const OBSIDIAN_FLOORS = { min: 13, max: 25 };
const BASE_COLD_DAMAGE = 4;
const BASE_FIRE_DAMAGE = 5;

export const jarnvidrExposureHandler: StatusHandler = {
  onTick(entity: Entity, effect, engine): StatusTickOutput {
    // Ambient, floor-driven hazard: it never naturally expires, so it doesn't need a
    // re-application hook on every floor change — just a floor-range check each tick.
    effect.duration = 9999;

    const floor = engine.currentFloor;
    const level = (entity as unknown as { level?: number }).level ?? 1;
    const curve = engine.manifest.progressionConfig?.elementalResistanceCurve;

    let baseDamage = 0;
    let elementCurve;
    let hazardName = '';
    if (floor >= PERMAFROST_FLOORS.min && floor <= PERMAFROST_FLOORS.max) {
      baseDamage = BASE_COLD_DAMAGE;
      elementCurve = curve?.cold;
      hazardName = 'permafrost';
    } else if (floor >= OBSIDIAN_FLOORS.min && floor <= OBSIDIAN_FLOORS.max) {
      baseDamage = BASE_FIRE_DAMAGE;
      elementCurve = curve?.fire;
      hazardName = 'forge-heat';
    } else {
      return { damageTaken: 0, killed: false };
    }

    const mitigated = applyLevelScaledElementalMitigation(baseDamage, level, elementCurve);
    if (mitigated <= 0) {
      return { damageTaken: 0, killed: false };
    }
    const { damageDealt, killed } = entity.takeDamage(mitigated);
    return {
      damageTaken: damageDealt,
      killed,
      message: damageDealt > 0 ? `The ${hazardName} of Járnviðr gnaws at ${entity.name} (-${damageDealt} HP).` : undefined,
    };
  },
};

/**
 * Applies the exposure status to the player on their very first action and never
 * again (guarded by `hasStatus`) — content's own bootstrap, needing no engine-side
 * "on player created" hook. Fires for every actor per the action-hook contract
 * (ARCHITECTURE.md §3), so it explicitly compares against `engine.player`.
 */
export const JARNVIDR_HAZARD_BOOTSTRAP_HOOK: ActionHook = {
  id: 'jarnvidr-hazard-bootstrap',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    const player = engine.player;
    if (actor === player && !player.statusManager.hasStatus(JARNVIDR_EXPOSURE_STATUS)) {
      player.statusManager.applyStatus({ type: JARNVIDR_EXPOSURE_STATUS, duration: 9999 });
    }
  },
};
