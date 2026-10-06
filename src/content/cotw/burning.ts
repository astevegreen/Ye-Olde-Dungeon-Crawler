import type { Monster, StatusHandler } from '../../engine';

export const BURNING_STATUS = 'burning';

/** Fire damage each turn, at the status's potency (Zealot's Sun-Flare sets 6). */
export const burningHandler: StatusHandler = {
  affliction: true,
  onTick(entity, effect, _engine) {
    const dmg = effect.potency ?? 3;
    // Periodic damage must not wake a sleeping monster.
    const res =
      entity.type === 'monster' ? (entity as Monster).takeDamage(dmg, { wakeUp: false }) : entity.takeDamage(dmg);
    return {
      damageTaken: res.damageDealt,
      killed: res.killed,
      message: `${entity.name} burns for ${res.damageDealt} damage!`,
    };
  },
  onApply(entity) {
    return `${entity.name} is wreathed in holy fire!`;
  },
  onExpire(entity) {
    return `The flames on ${entity.name} gutter out.`;
  },
};
