import type { StatusHandler } from '../../engine';

export const WARCRAFT_STATUS_HANDLERS: Record<string, StatusHandler> = {
  burning: {
    onTick(entity, effect, _engine) {
      const dmg = effect.potency ?? 3;
      const res = (entity as any).takeDamage(dmg, { wakeUp: false });
      return {
        damageTaken: res.damageDealt,
        killed: res.killed,
        message: `${entity.name} is scorched by fel fire for ${res.damageDealt} burning damage!`,
      };
    },
    onApply(entity, _effect, _engine) {
      return `${entity.name} bursts into demonic fel flames!`;
    },
    onExpire(entity) {
      return `The fel flames consuming ${entity.name} are extinguished.`;
    },
  },
};
