import type { StatusHandler } from '../../engine';

export const BURNING_STATUS = 'burning';

/** Fire damage each turn, at the status's potency (Zealot's Sun-Flare sets 6). */
export const burningHandler: StatusHandler = {
  affliction: true,
  onTick(entity, effect, engine) {
    const dmg = effect.potency ?? 3;
    // Fire damage through the entity's affinity: what resists fire burns for less, what is
    // immune not at all. Periodic damage must not wake a sleeping monster.
    const res = entity.takeElementalDamage(dmg, 'fire', engine?.affinityMatrix, undefined, { wakeUp: false });
    return {
      damageTaken: res.damageDealt,
      killed: res.killed,
      message: res.isHeal
        ? `${entity.name} is healed by the flames for ${res.healed}.`
        : res.damageDealt > 0 || res.killed
          ? `${entity.name} burns for ${res.damageDealt} damage!`
          : undefined,
    };
  },
  onApply(entity) {
    return `${entity.name} is wreathed in holy fire!`;
  },
  onExpire(entity) {
    return `The flames on ${entity.name} gutter out.`;
  },
};
