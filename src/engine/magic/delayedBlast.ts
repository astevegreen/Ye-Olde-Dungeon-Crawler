import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { ActionResult, Position } from '../types';
import type { StatusEffect } from '../status/types';
import type { SpellDefinition } from './types';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import { SpellPipeline, type CastShaping } from './spellPipeline';
import { castGeometry } from './castTrace';
import { castShaping, resolveCastSpell, withElement } from './castNumbers';
import { getAreaOfEffectTiles } from './targeting';

/**
 * A delayed blast (P-33): a spell with a `delay` marks the tiles it will strike, and strikes
 * them when its countdown runs out, so its foes see it coming, as a monster's wind-up shows.
 * The mark is a status on the caster, one per cast (`stacks`), ticked by the status tick:
 * two cast in one turn both land. It holds only where it was cast from and at; going off, the
 * spell resolves as the cast did, its slot's Area and power and what its neighbours lend.
 */
export const DELAYED_BLAST_STATUS = 'delayed_blast';

/** A blast waiting to go off: whose, which spell, the tiles it will strike, and the caster's actions left. */
export interface PendingBlast {
  casterId: string;
  spellId: string;
  spellName: string;
  tiles: Position[];
  turnsLeft: number;
}

/** The cast of a delayed spell: its tiles marked, its blast pending on the caster. */
export function layDelayedBlast(
  engine: GameEngine,
  spell: SpellDefinition,
  caster: Entity,
  aim: Position,
  freeCast: boolean,
  actionCost: number
): ActionResult {
  const delay = Math.max(1, spell.delay ?? 1);
  // A thrown burst marks where its flight stops now, and lands there whatever steps in the way since.
  const burst = castGeometry(engine, spell, caster, aim).burst;
  const at = burst ? burst.epicenter : aim;
  caster.statusManager.applyStatusDetailed(
    {
      type: DELAYED_BLAST_STATUS,
      // The caster's statuses tick once as this action ends: `delay` more actions before it goes off.
      duration: delay + 1,
      sourceEntityId: caster.id,
      data: { spell: spell.id, x: at.x, y: at.y, ox: caster.x, oy: caster.y, element: spell.element, free: freeCast },
    },
    [],
    caster,
    engine
  );
  const when = delay === 1 ? 'next turn' : `in ${delay} turns`;
  const message = `${caster.name} casts ${spell.name}; it strikes ${when}.`;
  engine.log(message);
  return { success: true, cost: actionCost, message, effects: [] };
}

/** Every blast pending on the floor, for the intent overlay to mark. */
export function pendingBlasts(engine: GameEngine): PendingBlast[] {
  const pending: PendingBlast[] = [];
  for (const caster of engine.map.getAllEntities()) {
    if (!caster.isAlive()) continue;
    for (const effect of caster.statusManager.getAll()) {
      if (effect.type !== DELAYED_BLAST_STATUS) continue;
      const blast = resolveBlast(engine, caster, effect);
      if (!blast) continue;
      pending.push({ casterId: caster.id, spellId: blast.spell.id, spellName: blast.spell.name, tiles: blast.tiles, turnsLeft: effect.duration });
    }
  }
  return pending;
}

/** The spell a pending blast resolves as, where it lands, and the tiles it strikes; none for a spell gone from the pack. */
function resolveBlast(
  engine: GameEngine,
  caster: Entity,
  effect: StatusEffect
): { spell: SpellDefinition; shaping?: CastShaping; aim: Position; origin: Position; tiles: Position[] } | undefined {
  const d = effect.data ?? {};
  if (typeof d.spell !== 'string' || ![d.x, d.y, d.ox, d.oy].every((n) => typeof n === 'number')) return undefined;
  const cast = resolveCastSpell(engine, caster, d.spell, d.free === true);
  if (!cast.spell) return undefined;
  // Wildfire picked its element at the cast.
  const spell = typeof d.element === 'string' ? withElement(cast.spell, d.element) : cast.spell;
  const aim = { x: d.x as number, y: d.y as number };
  const origin = { x: d.ox as number, y: d.oy as number };
  const geo = castGeometry(engine, spell, { id: caster.id, ...origin }, aim);
  const tiles = geo.burst ? getAreaOfEffectTiles(engine.map, aim.x, aim.y, geo.burst.radius) : (geo.area ?? [aim]);
  return { spell, shaping: cast.resolved ? castShaping(engine, cast.resolved) : undefined, aim, origin, tiles };
}

/** The blast goes off: the spell strikes the tiles it marked, on whoever stands there now. */
function goOff(caster: Entity, effect: StatusEffect, engine: GameEngine): void {
  const blast = resolveBlast(engine, caster, effect);
  if (!blast) return;
  const result = SpellPipeline.executeSpell(engine, blast.spell, caster, blast.aim, undefined, 0, blast.shaping, blast.origin);
  if (result.effects?.length) engine.recordVisualEffects(result.effects);
}

function registerDelayedBlastStatusHandler(): void {
  StatusHandlerRegistry.register(DELAYED_BLAST_STATUS, {
    stacks: true,
    // The strike logs its own line.
    onExpire: () => undefined,
    onEnd: goOff,
  });
}

registerDelayedBlastStatusHandler();
StatusHandlerRegistry.addDefaultRegistrar(registerDelayedBlastStatusHandler);
