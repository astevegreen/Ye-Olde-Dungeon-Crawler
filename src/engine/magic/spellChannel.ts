import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { ActionResult } from '../types';
import type { StatusEffect } from '../status/types';
import type { SpellDefinition } from './types';
import type { ActionHook, ActionHookContext } from '../actions/actionPipeline';
import { WaitAction } from '../actions/wait';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import { SpellPipeline } from './spellPipeline';
import { castShaping, resolveCastSpell } from './castNumbers';

/*
 * A channelled spell (`SpellDefinition.channel`): the hero pays and begins it, then waits
 * while the channel lasts, and the spell goes off as it ends, resolved as the cast was (its
 * slot's stats, what its neighbours lend). Doing anything but waiting, or being hurt, breaks
 * it, the cost spent, as the Rune of Return's channel breaks (`runeOfReturn.ts`).
 */
export const SPELL_CHANNEL_STATUS = 'spell_channel';

export function startSpellChannel(engine: GameEngine, spell: SpellDefinition, caster: Entity, freeCast: boolean, actionCost: number): ActionResult {
  const turns = Math.max(1, spell.channel ?? 1);
  caster.statusManager.applyStatus(
    {
      type: SPELL_CHANNEL_STATUS,
      // The caster's statuses tick once as this action ends: the cast is the channel's first turn.
      duration: turns,
      sourceEntityId: caster.id,
      data: { spell: spell.id, free: freeCast, lastHp: caster.hp },
    },
    [],
    caster,
    engine
  );
  const rest = turns - 1;
  const message =
    rest > 0
      ? `You begin to channel ${spell.name}. Wait ${rest === 1 ? 'one more turn' : `${rest} more turns`} to finish it.`
      : `You channel ${spell.name}.`;
  engine.log(message);
  return { success: true, cost: actionCost, message, effects: [] };
}

function channelledSpellName(engine: GameEngine, effect: StatusEffect): string {
  const id = effect.data?.spell;
  return (typeof id === 'string' && engine.manifest?.spells?.find((s) => s.id === id)?.name) || 'the spell';
}

function breakChannel(engine: GameEngine, caster: Entity, effect: StatusEffect, why: string): void {
  caster.statusManager.removeEffect(effect);
  engine.log(`${why} ${channelledSpellName(engine, effect)} fizzles.`);
}

/** The channel ends whole: the spell goes off where the caster stands. */
function goOff(caster: Entity, effect: StatusEffect, engine: GameEngine): void {
  const d = effect.data ?? {};
  if (typeof d.spell !== 'string' || !caster.isAlive()) return;
  const cast = resolveCastSpell(engine, caster, d.spell, d.free === true);
  if (!cast.spell) return;
  const shaping = cast.resolved ? castShaping(engine, cast.resolved) : undefined;
  const result = SpellPipeline.executeSpell(engine, cast.spell, caster, { x: caster.x, y: caster.y }, undefined, 0, shaping);
  if (result.effects?.length) engine.recordVisualEffects(result.effects);
}

function registerSpellChannelStatusHandler(): void {
  StatusHandlerRegistry.register(SPELL_CHANNEL_STATUS, {
    // The spell logs its own lines.
    onExpire: () => undefined,
    onEnd: goOff,
  });
}

/**
 * The channel's interrupts, run beside the Rune of Return's (`createRuneOfReturnActionHooks`):
 * any action of the channeller but waiting breaks it before it runs, and any action that
 * leaves the hero hurt breaks the hero's after.
 */
export function createSpellChannelActionHooks(): ActionHook[] {
  return [
    {
      id: 'spell_channel_action_guard',
      phase: 'pre',
      priority: 50,
      execute(ctx: ActionHookContext) {
        const effect = ctx.actor.statusManager?.getStatus(SPELL_CHANNEL_STATUS);
        if (!effect) return;
        if (ctx.action instanceof WaitAction || ctx.actionType === 'WaitAction') return;
        breakChannel(ctx.engine as GameEngine, ctx.actor, effect, 'Your concentration breaks:');
      },
    },
    {
      id: 'spell_channel_damage_interrupter',
      phase: 'post',
      priority: 50,
      execute(ctx: ActionHookContext) {
        const engine = ctx.engine as GameEngine;
        const hero = engine.player;
        const effect = hero?.statusManager?.getStatus(SPELL_CHANNEL_STATUS);
        if (!effect) return;
        const lastHp = typeof effect.data?.lastHp === 'number' ? effect.data.lastHp : hero.hp;
        if (hero.hp < lastHp) breakChannel(engine, hero, effect, 'Pain breaks your focus:');
        else effect.data = { ...effect.data, lastHp: hero.hp };
      },
    },
  ];
}

registerSpellChannelStatusHandler();
StatusHandlerRegistry.addDefaultRegistrar(registerSpellChannelStatusHandler);
