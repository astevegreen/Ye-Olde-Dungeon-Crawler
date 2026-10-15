import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { SpellDefinition } from '../magic/types';
import { EffectPrimitiveRegistry, type EffectContext } from '../magic/effectRegistry';
import type { StatusEffect } from './types';
import { StatusHandlerRegistry, type EndingTrigger, type StatusEnding } from './statusHandlers';

/**
 * Sets off each ending `bearer` carries that `trigger` sets off (P-31): a blow it took (`struck`)
 * or its death (`slain`). The status ends with its ending. Running out (`expire`) is the status
 * manager's, at `StatusManager.tick`.
 */
export function setOffEndings(engine: GameEngine, bearer: Entity, trigger: Exclude<EndingTrigger, 'expire'>): void {
  for (const effect of bearer.statusManager.getAll()) {
    const handler = StatusHandlerRegistry.get(effect.type);
    if (!handler?.ending?.on.includes(trigger)) continue;
    // An earlier burst may have ended it already (one ending setting off another).
    if (!bearer.statusManager.removeEffect(effect)) continue;
    goOff(engine, bearer, effect, handler.ending);
    handler.onEnd?.(bearer, effect, engine);
  }
}

/** One ending goes off: its effects, cast by the bearer, on the bearer's foes around its centre. */
export function goOff(engine: GameEngine, bearer: Entity, effect: StatusEffect, ending: StatusEnding): void {
  if (ending.message) engine.log(ending.message.replace('{name}', bearer.name));
  if (ending.effects.length === 0) return consume(engine, bearer, ending);
  const centre = {
    x: typeof effect.data?.x === 'number' ? effect.data.x : bearer.x,
    y: typeof effect.data?.y === 'number' ? effect.data.y : bearer.y,
  };
  const foes = engine.map
    .getAllEntities()
    .filter(
      (e) =>
        e !== bearer &&
        e.isAlive() &&
        bearer.isHostileTo(e) &&
        Math.max(Math.abs(e.x - centre.x), Math.abs(e.y - centre.y)) <= ending.radius
    );
  const color = ending.color ?? '#e2e8f0';
  // What the effects need of a spell: its name for the log, and its area so a hit reads as a blast's.
  const spell: SpellDefinition = {
    id: `ending:${effect.type}`,
    name: effect.type,
    school: 'Combat',
    manaCost: 0,
    element: 'physical',
    range: 0,
    basePower: 0,
    areaOfEffect: Math.max(1, ending.radius),
    reflects: false,
    targetType: 'self',
    description: '',
    effects: ending.effects,
  };
  const ctx: EffectContext = { engine, spell, caster: bearer, targets: foes, aim: centre, effects: [], color };
  for (const primitive of ending.effects) EffectPrimitiveRegistry.dispatch(primitive, ctx);
  engine.recordVisualEffects([
    { type: 'burst', epicenter: centre, radius: ending.radius, color, durationMs: 200, style: 'shockwave' },
    ...ctx.effects,
  ]);
  consume(engine, bearer, ending);
}

function consume(engine: GameEngine, bearer: Entity, ending: StatusEnding): void {
  if (ending.consumesBearer && engine.map.getEntityById(bearer.id) === bearer) engine.removeEntity(bearer);
}
