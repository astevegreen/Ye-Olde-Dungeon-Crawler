import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import type { Action } from './action';
import { getCounter, setCounter } from '../state/worldState';

/** The world counter holding the turn a companion skill is next ready (`turnCount`). */
export const companionSkillReadyCounter = (skillId: string): string => `companion_skill_ready:${skillId}`;

/**
 * The hero commands their companion to use a skill it learned at the trainer
 * (`TrainerSkillDefinition`): an order, so it spends the hero's turn. A skill with a
 * `cooldown` is refused, at no cost, until that many turns have passed since its last use.
 * The ready turn lives in a world counter, so it is saved with the hero.
 */
export class UseCompanionSkillAction implements Action {
  public readonly player: Entity;
  public readonly skillId: string;

  constructor(player: Entity, skillId: string) {
    this.player = player;
    this.skillId = skillId;
  }

  public perform(engine: GameEngine): ActionResult {
    const companion = engine.companion;
    if (!companion) return { success: false, cost: 0, message: 'You have no companion here to command.' };
    if (!companion.unlockedSkills.includes(this.skillId)) {
      return { success: false, cost: 0, message: `${companion.name} has not learned that skill.` };
    }
    const skill = engine.manifest.town?.services?.trainerSkills?.find((s) => s.id === this.skillId);
    if (!skill) return { success: false, cost: 0, message: `Unknown companion skill: '${this.skillId}'` };

    const counter = companionSkillReadyCounter(skill.id);
    const wait = getCounter(engine.worldState, counter) - engine.turnCount;
    if (wait > 0) {
      return { success: false, cost: 0, message: `${skill.name} is ready in ${wait} turn${wait === 1 ? '' : 's'}.` };
    }

    const { effect } = skill;
    const healed = effect.companionHealPercent ? companion.heal(Math.ceil(companion.maxHp * effect.companionHealPercent)) : 0;
    if (effect.heroStatus) {
      engine.player.statusManager.applyStatus(
        { type: effect.heroStatus.type, duration: effect.heroStatus.duration },
        engine.player.statusImmunities,
        engine.player,
        engine
      );
    }
    if (skill.cooldown) setCounter(engine.worldState, counter, engine.turnCount + skill.cooldown);
    this.player.consumeEnergy(BASE_ACTION_COST);
    const message = effect.message.replace(/\{companion\}/g, companion.name).replace(/\{healed\}/g, String(healed));
    engine.log(message);
    return { success: true, cost: BASE_ACTION_COST, message };
  }
}
