import { resolveManaTerms } from '../types/manifest';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { getOverflowConfig, lingeringDebtFloor } from '../magic/manaOverflow';
import { productWorn } from '../items/wornModifiers';
import type { Player } from '../entities/player';
import type { Action } from './action';
import type { ActionResult } from '../types';
import { BASE_ACTION_COST } from '../types';
import { isPrologueRunning } from '../quest/prologue';
import { getRunningTimedEvents } from '../quest/timedEvents';

export interface AutoRestStepResult {
  finished: boolean;
  interrupted: boolean;
  reason?: string;
  hpGained: number;
  manaGained: number;
  turn: number;
}

/**
 * One turn of rest: the hero recovers a turn's worth (`AutoRestManager.recoverRestTurn`)
 * and the turn passes through the pipeline like any other, so the world takes its share
 * (statuses, surfaces, wanderers, timed events, the monsters' moves), the action hooks see
 * it (a Rune of Return channel breaks), and it is in the replay trail.
 *
 * A rest is a run of these: `AutoRestManager.stepRestTurn` issues one per step and decides
 * when the rest stops (hurt, a hostile in view, fully rested, or the turn limit).
 */
export class RestTurnAction implements Action {
  public readonly player: Player;

  constructor(player: Player) {
    this.player = player;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot rest.' };
    }
    const refusal = AutoRestManager.restRefusal(engine);
    if (refusal) {
      engine.log(refusal);
      return { success: false, cost: 0, message: refusal };
    }

    AutoRestManager.recoverRestTurn(engine, this.player);
    this.player.consumeEnergy(BASE_ACTION_COST);
    return { success: true, cost: BASE_ACTION_COST };
  }
}

/**
 * The one rest: the R key, the HUD Rest button, the health orb, the context action and the
 * command palette all run it, a turn at a time, each turn a `RestTurnAction` through
 * `handlePlayerAction`. Headless: no DOM or timers (`AutoRestRunner` paces it in the UI).
 */
export class AutoRestManager {
  /** HP one rest turn restores: a point, more with Second Wind (`restHealMultiplier`). */
  private static restHeal(player: Player): number {
    return Math.max(1, Math.round(productWorn(player, 'restHealMultiplier')));
  }

  /**
   * One rest turn's recovery: a point of HP (more with Second Wind), a point of mana, and
   * a point of overflow debt, more for a Spell-Thief (`overflowDebtDecayMultiplier`).
   */
  public static recoverRestTurn(engine: GameEngine, player: Player): void {
    player.heal(this.restHeal(player));
    player.restoreMana(1);
    player.decayVoidDebt(Math.max(1, Math.round(productWorn(player, 'overflowDebtDecayMultiplier'))), lingeringDebtFloor(engine, player.voidDebt));
  }

  /**
   * Why the hero can't rest at all just now, or null. A timed event is counting down
   * (`manifest.timedEvents`), or a prologue's scene is under way: a rest runs up to a
   * hundred turns at a stroke, which would spend the countdown before the hero could
   * react. Or what the hero wears forbids it. Checked by every rest turn.
   */
  public static restRefusal(engine: GameEngine): string | null {
    const running = getRunningTimedEvents(engine);
    const shown = running.find((e) => e.label);
    if (shown) return `There is no time to rest with the ${shown.label} under way (${shown.turnsRemaining} turns left).`;
    if (running.length > 0 || isPrologueRunning(engine.worldState, engine.manifest?.prologue)) return 'There is no time to rest now.';
    for (const item of engine.player.inventory.paperdoll.getEquippedItems()) {
      const restless = item.modifiers.find((m) => m.forbidsRest);
      if (restless) return `${item.displayName} will not let you rest.`;
    }
    return null;
  }

  /**
   * Why a rest can't begin now, or null: `restRefusal`, nothing to recover, or a hostile
   * already in sight. Every way of starting a rest asks this first.
   */
  public static startRefusal(engine: GameEngine): string | null {
    const refusal = this.restRefusal(engine);
    if (refusal) return refusal;
    const player = engine.player;
    if (player.hp >= player.maxHp && player.mana >= player.maxMana) {
      return `You are already fully rested (HP and ${resolveManaTerms(engine.manifest).name} full).`;
    }
    const hostile = this.findVisibleHostile(engine);
    if (hostile) return `Cannot rest now! A hostile ${hostile.name} is in sight!`;
    return null;
  }

  /**
   * Scans player's field of view for any visible hostile monsters.
   */
  public static findVisibleHostile(engine: GameEngine): Entity | null {
    const fov = engine.fov;
    for (const entity of engine.map.getAllEntities()) {
      if (
        entity instanceof Monster &&
        entity.isAlive() &&
        fov.isVisible(entity.x, entity.y) &&
        engine.player.isHostileTo(entity)
      ) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Rests one turn (a `RestTurnAction` through `handlePlayerAction`) and says whether the
   * rest goes on. It stops when:
   * 1. a hostile is in sight, before the turn or after it;
   * 2. the hero is hurt during the turn, by anything, seen or not (a status tick, a
   *    surface, an unseen archer);
   * 3. the turn could not be rested (a refusal, a hook, a forced pass);
   * 4. HP and mana are full, or the turn limit is reached.
   */
  public static stepRestTurn(
    engine: GameEngine,
    initialHp: number,
    initialMana: number,
    currentTurn: number,
    maxTurns = 100
  ): AutoRestStepResult {
    const player = engine.player;
    const end = (interrupted: boolean, turn: number, reason?: string): AutoRestStepResult => {
      if (reason) engine.log(reason);
      return {
        finished: true,
        interrupted,
        reason,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn,
      };
    };

    if (!player.isAlive()) return { ...end(true, currentTurn), reason: 'You have died.' };

    const visibleMonster = this.findVisibleHostile(engine);
    if (visibleMonster) return end(true, currentTurn, `Rest interrupted! A hostile ${visibleMonster.name} is in sight!`);

    // What the hero should have after this turn's recovery, had nothing hurt them.
    const expectedHp = Math.min(player.maxHp, player.hp + this.restHeal(player));
    const turnBefore = engine.turnCount;
    const res = engine.handlePlayerAction(new RestTurnAction(player));
    const turn = engine.turnCount > turnBefore ? currentTurn + 1 : currentTurn;

    // Killed during the turn: the death has been told; there is no rest to report.
    if (!player.isAlive()) return { ...end(true, turn), reason: 'You perished during rest.' };
    // Refused (already logged), or the hero lost the turn (paralysis, a hook).
    if (!res.success) return { ...end(true, turn), reason: res.message };

    if (player.hp < expectedHp) return end(true, turn, `Rest interrupted! You took ${expectedHp - player.hp} damage!`);

    const newlyVisible = this.findVisibleHostile(engine);
    if (newlyVisible) return end(true, turn, `Rest interrupted! A ${newlyVisible.name} approaches into view!`);

    if (player.hp >= player.maxHp && player.mana >= player.maxMana) {
      // A full rest settles all debt, except what the pack lets linger until town.
      if (player.decayVoidDebt(player.voidDebt, lingeringDebtFloor(engine, player.voidDebt)) > 0) {
        const lingering = getOverflowConfig(engine)?.lingeringRestMessage;
        if (lingering) engine.log(lingering);
      }
      return end(false, turn, `Fully rested (HP and ${resolveManaTerms(engine.manifest).name} full).`);
    }

    if (turn >= maxTurns) return end(false, turn, `Rested for maximum duration (${maxTurns} turns).`);

    return {
      finished: false,
      interrupted: false,
      hpGained: player.hp - initialHp,
      manaGained: player.mana - initialMana,
      turn,
    };
  }

  /**
   * A whole rest at once, refused as `startRefusal` says (headless tests, the soak bot).
   */
  public static executeFullRest(engine: GameEngine, maxTurns = 100): AutoRestStepResult {
    const initialHp = engine.player.hp;
    const initialMana = engine.player.mana;
    const refusal = this.startRefusal(engine);
    if (refusal) {
      engine.log(refusal);
      return { finished: true, interrupted: true, reason: refusal, hpGained: 0, manaGained: 0, turn: 0 };
    }
    let step: AutoRestStepResult = { finished: false, interrupted: false, hpGained: 0, manaGained: 0, turn: 0 };
    while (!step.finished) {
      step = this.stepRestTurn(engine, initialHp, initialMana, step.turn, maxTurns);
    }
    return step;
  }
}
