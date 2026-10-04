import { resolveManaTerms } from '../types/manifest';
import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';
import { DeathResolver } from '../combat/deathResolver';
import { lingeringDebtFloor } from '../magic/manaOverflow';
import { productWorn } from '../items/wornModifiers';
import type { Player } from '../entities/player';
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
 * Headless AutoRestManager for single-step and batched interruptible rest.
 * 100% headless: strictly no DOM, browser timing, or window API calls.
 */
export class AutoRestManager {
  /**
   * Why the hero can't rest at all just now, or null. A timed event is counting down
   * (`manifest.timedEvents`), or a prologue's scene is under way: their clocks count turns,
   * and resting advances turns outside the action pipeline, so a rest would spend the
   * countdown unseen and let it expire on the next step. Hostiles in sight are checked
   * separately, since they also interrupt a rest under way.
   */
  /**
   * One rest turn's recovery, for both rest paths (`RestAction` and the R key's
   * `stepRestTurn`): a point of HP, more with Second Wind (`restHealMultiplier`), a point of
   * mana, and a point of overflow debt, more for a Spell-Thief (`overflowDebtDecayMultiplier`).
   */
  public static recoverRestTurn(engine: GameEngine, player: Player): void {
    player.heal(Math.max(1, Math.round(productWorn(player, 'restHealMultiplier'))));
    player.restoreMana(1);
    player.decayVoidDebt(Math.max(1, Math.round(productWorn(player, 'overflowDebtDecayMultiplier'))), lingeringDebtFloor(engine, player.voidDebt));
  }

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
   * Performs a single rest turn. Advances world simulation and checks for interruption triggers:
   * 1. Hostile monster appears in FOV
   * 2. Player takes damage (status effects, or anything during the monsters' turns, seen or not)
   * 3. Player reaches 100% HP and Mana
   */
  public static stepRestTurn(
    engine: GameEngine,
    initialHp: number,
    initialMana: number,
    currentTurn: number,
    maxTurns = 100
  ): AutoRestStepResult {
    const player = engine.player;

    if (!player.isAlive()) {
      return {
        finished: true,
        interrupted: true,
        reason: 'You have died.',
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn,
      };
    }

    // Check if monster already in sight before stepping
    const visibleMonster = this.findVisibleHostile(engine);
    if (visibleMonster) {
      const msg = `Rest interrupted! A hostile ${visibleMonster.name} is in sight!`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: true,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn,
      };
    }

    const hpBefore = player.hp;

    AutoRestManager.recoverRestTurn(engine, player);

    // Consume player turn energy
    player.consumeEnergy(BASE_ACTION_COST);
    engine.turnCount += 1;
    if (engine.currentFloor >= 1) {
      engine.map.floorTurnCount = (engine.map.floorTurnCount ?? 0) + 1;
    }

    // Status effect tick on player
    const tickRes = player.statusManager.tick(player, engine);
    if (tickRes.killed) {
      DeathResolver.resolveDeath(engine, undefined, player);
      return {
        finished: true,
        interrupted: true,
        reason: 'Rest interrupted by fatal status effect.',
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    if (tickRes.damageTaken > 0 || player.hp < hpBefore) {
      const dmg = tickRes.damageTaken > 0 ? tickRes.damageTaken : hpBefore - player.hp;
      const msg = `Rest interrupted! You took ${dmg} damage!`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: true,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    // Advance world simulation (monsters take actions)
    const hpBeforeWorld = player.hp;
    engine.surfaces?.tick(engine);
    engine.wanderingSpawner?.checkAndSpawn(engine);

    engine.updateFov();
    engine.advanceWorldUntilPlayerTurn();
    engine.updateFov();

    if (!player.isAlive()) {
      return {
        finished: true,
        interrupted: true,
        reason: 'You perished during rest.',
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    // A hit while the world moved, from anything, seen or not
    if (player.hp < hpBeforeWorld) {
      const msg = `Rest interrupted! You took ${hpBeforeWorld - player.hp} damage!`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: true,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    // Check if monster walked into FOV during monster turns
    const newlyVisible = this.findVisibleHostile(engine);
    if (newlyVisible) {
      const msg = `Rest interrupted! A ${newlyVisible.name} approaches into view!`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: true,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    // Check if HP and Mana reached 100%
    if (player.hp >= player.maxHp && player.mana >= player.maxMana) {
      // A full rest settles all debt, except what the pack lets linger until town.
      player.decayVoidDebt(player.voidDebt, lingeringDebtFloor(engine, player.voidDebt));
      const msg = `Fully rested (HP and ${resolveManaTerms(engine.manifest).name} full).`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: false,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    if (currentTurn + 1 >= maxTurns) {
      const msg = `Rested for maximum duration (${maxTurns} turns).`;
      engine.log(msg);
      return {
        finished: true,
        interrupted: false,
        reason: msg,
        hpGained: player.hp - initialHp,
        manaGained: player.mana - initialMana,
        turn: currentTurn + 1,
      };
    }

    return {
      finished: false,
      interrupted: false,
      hpGained: player.hp - initialHp,
      manaGained: player.mana - initialMana,
      turn: currentTurn + 1,
    };
  }

  /**
   * Executes a complete auto-rest sequence synchronously (used in headless tests and instant mode).
   */
  public static executeFullRest(engine: GameEngine, maxTurns = 100): AutoRestStepResult {
    const initialHp = engine.player.hp;
    const initialMana = engine.player.mana;
    let step: AutoRestStepResult = {
      finished: false,
      interrupted: false,
      hpGained: 0,
      manaGained: 0,
      turn: 0,
    };

    while (!step.finished) {
      step = this.stepRestTurn(engine, initialHp, initialMana, step.turn, maxTurns);
    }
    return step;
  }
}
