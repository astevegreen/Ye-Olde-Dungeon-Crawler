import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import type { VisualEffectDescriptor } from '../types';
import { EffectPrimitiveRegistry, type EffectContext } from './effectRegistry';

/**
 * A summon's blow carries what its summoning cast borrowed (P-31): each lent effect lands on the
 * foe it struck, as the summon's own. Slot stats never reach a borrowed effect, so no power here.
 */
export function deliverSummonLends(engine: GameEngine, summon: Monster, foe: Entity): void {
  const lent = summon.lentHits;
  if (!lent) return;
  const spell = engine.manifest?.spells?.find((s) => s.id === lent.spellId);
  if (!spell) return;
  const effects: VisualEffectDescriptor[] = [];
  const ctx: EffectContext = {
    engine,
    spell,
    caster: summon,
    targets: [foe],
    aim: { x: foe.x, y: foe.y },
    tiles: [{ x: foe.x, y: foe.y }],
    effects,
    color: lent.color,
  };
  for (const effect of lent.effects) {
    if (!foe.isAlive()) break;
    if (effect.type === 'damage') ctx.lastDamageEffect = effect;
    EffectPrimitiveRegistry.dispatch(effect, ctx);
  }
}
