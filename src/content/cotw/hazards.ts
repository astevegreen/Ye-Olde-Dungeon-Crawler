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
 *
 * Tuning fix (2026-09-18): the original version dealt the full, flat base damage on
 * every single turn from the moment the player set foot on floor 1, for the entire
 * 12- (or 13-) floor half. That's not a difficulty curve, it's a metronome: a fresh
 * level-1 character was losing HP on every action, including `WaitAction`, with no
 * way to reduce it short of reaching level 10. Worse, `RestAction` (`actions/rest.ts`)
 * aborts the instant a status tick deals any damage — since this hazard *always* did,
 * resting was completely inert for the whole of Act 1. Two changes address both the
 * "onerous" and the "thematic" halves of the brief at once:
 *   1. `depthRampedBase` scales the raw damage by how far into its 12/13-floor half
 *      the player has descended, so floor 1 (and floor 13) are a light introduction
 *      and floor 12 (and floor 25) are where the hazard hits as hard as it used to
 *      everywhere — the "inversion thickens as you descend" the flavor text already
 *      claimed, now actually tied to floor depth rather than only to level.
 *   2. `TICK_INTERVAL` makes the hazard fire only every third turn rather than every
 *      turn. It's still an ever-present threat (it never expires while on these
 *      floors), but it no longer denies `RestAction` outright — two silent ticks
 *      followed by one damaging one nets positive HP on `RestAction`'s +1/tick natural
 *      recovery for most of the early range, matching how poison/other DOT statuses
 *      in this engine coexist with resting rather than blocking it unconditionally.
 */
export const JARNVIDR_EXPOSURE_STATUS = 'cotw:jarnvidr_exposure';

const PERMAFROST_FLOORS = { min: 1, max: 12 };
const OBSIDIAN_FLOORS = { min: 13, max: 25 };
const BASE_COLD_DAMAGE = 4;
const BASE_FIRE_DAMAGE = 5;

/** The hazard only actually bites on every Nth turn (see tuning note above). */
const TICK_INTERVAL = 3;

/** The floor of the depth ramp: how much of the base damage applies the moment the
 * player crosses into this half, before it climbs to the full base by the far end. */
const MIN_DEPTH_FACTOR = 0.25;

/** Scales `base` by how far `floor` sits between `rangeMin` and `rangeMax`, from
 * `MIN_DEPTH_FACTOR` at the near edge up to the full base at the far edge. */
function depthRampedBase(base: number, floor: number, rangeMin: number, rangeMax: number): number {
  const progress = Math.max(0, Math.min(1, (floor - rangeMin) / (rangeMax - rangeMin)));
  return Math.round(base * (MIN_DEPTH_FACTOR + (1 - MIN_DEPTH_FACTOR) * progress));
}

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
      baseDamage = depthRampedBase(BASE_COLD_DAMAGE, floor, PERMAFROST_FLOORS.min, PERMAFROST_FLOORS.max);
      elementCurve = curve?.cold;
      hazardName = 'permafrost';
    } else if (floor >= OBSIDIAN_FLOORS.min && floor <= OBSIDIAN_FLOORS.max) {
      baseDamage = depthRampedBase(BASE_FIRE_DAMAGE, floor, OBSIDIAN_FLOORS.min, OBSIDIAN_FLOORS.max);
      elementCurve = curve?.fire;
      hazardName = 'forge-heat';
    } else {
      return { damageTaken: 0, killed: false };
    }

    if (engine.turnCount % TICK_INTERVAL !== 0) {
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
