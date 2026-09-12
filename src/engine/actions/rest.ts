import type { Action } from './action';
import type { ActionResult } from '../types';
import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import type { Entity } from '../entities/entity';
import { DeathResolver } from '../combat/deathResolver';

export class RestAction implements Action {
  public readonly player: Player;
  public readonly maxTicks: number;

  constructor(player: Player, maxTicks = 100) {
    this.player = player;
    this.maxTicks = maxTicks;
  }

  public perform(engine: GameEngine): ActionResult {
    if (!this.player.isAlive()) {
      return { success: false, cost: 0, message: 'Dead heroes cannot rest.' };
    }

    // Check if monster is ALREADY visible in line of sight:
    const initialHostile = this.findVisibleHostile(engine);
    if (initialHostile) {
      const msg = `Cannot rest now! A hostile ${initialHostile.name} is in sight!`;
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    if (this.player.hp >= this.player.maxHp && this.player.mana >= this.player.maxMana) {
      const msg = 'You are already fully rested (HP and Mana full).';
      engine.log(msg);
      return { success: false, cost: 0, message: msg };
    }

    let ticksElapsed = 0;
    let interruptedByMonster: Entity | null = null;
    let interruptedByDamage = 0;
    const initialHp = this.player.hp;
    const initialMana = this.player.mana;

    while (ticksElapsed < this.maxTicks) {
      ticksElapsed++;

      // Natural recovery per rest tick
      this.player.heal(1);
      this.player.restoreMana(1);

      // Simulate turn passage for monsters
      this.player.consumeEnergy(100);
      engine.turnCount += 1;
      if (engine.currentFloor >= 1) {
        engine.map.floorTurnCount = (engine.map.floorTurnCount ?? 0) + 1;
      }

      // Status effects tick on player
      const tickRes = this.player.statusManager.tick(this.player, engine);
      if (tickRes.killed) {
        DeathResolver.resolveDeath(engine, undefined, this.player);
        break;
      }
      if (tickRes.damageTaken > 0) {
        interruptedByDamage = tickRes.damageTaken;
        break;
      }

      engine.updateFov();
      engine.advanceWorldUntilPlayerTurn();
      engine.updateFov();

      if (!this.player.isAlive()) {
        break;
      }

      // Check for interruption by visible hostile
      interruptedByMonster = this.findVisibleHostile(engine);
      if (interruptedByMonster) {
        break;
      }

      if (this.player.hp >= this.player.maxHp && this.player.mana >= this.player.maxMana) {
        break;
      }
    }

    const hpGained = this.player.hp - initialHp;
    const manaGained = this.player.mana - initialMana;

    if (interruptedByDamage > 0) {
      const msg = `Rest interrupted after ${ticksElapsed} turn(s)! You take ${interruptedByDamage} status damage!`;
      engine.log(msg);
      return { success: true, cost: 0, message: msg };
    }

    if (interruptedByMonster) {
      const msg = `Rest interrupted after ${ticksElapsed} turn(s)! A ${interruptedByMonster.name} comes into view! (Recovered ${hpGained} HP, ${manaGained} MP)`;
      engine.log(msg);
      return { success: true, cost: 0, message: msg };
    }

    const msg = `You rest peacefully for ${ticksElapsed} turn(s). HP and Mana fully restored! (+${hpGained} HP, +${manaGained} MP)`;
    engine.log(msg);
    return { success: true, cost: 0, message: msg };
  }

  private findVisibleHostile(engine: GameEngine): Entity | null {
    const entities = engine.map.getAllEntities();
    for (const e of entities) {
      if (e.isAlive() && e.isHostileTo(this.player)) {
        if (engine.fov.isVisible(e.x, e.y)) {
          return e;
        }
      }
    }
    return null;
  }
}
