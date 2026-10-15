import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { HookDispatcher } from './hookDispatcher';
import { setOffEndings } from '../status/endings';

/**
 * The damage hooks a blow other than melee fires (a spell's, a wind-up's), as melee fires its
 * own (`MeleeAttackAction`): `onHit` from the attacker's hooks, then `onDamageTaken` from the
 * defender's when the blow wounded it. `onBlock` stays melee's, the only blow with a block.
 * Called before the blow's death resolves, as in melee, and not for a blow the defender was
 * immune to or absorbed. A wound the defender survives sets off its `struck` endings, whoever
 * dealt it.
 */
export function dispatchDamageHooks(engine: GameEngine, attacker: Entity, defender: Entity, damage: number): void {
  if (attacker.isAlive()) {
    HookDispatcher.dispatch('onHit', {
      engine,
      attacker,
      defender,
      damage,
    });
    if (damage > 0) {
      HookDispatcher.dispatch('onDamageTaken', { engine, attacker, defender, damage });
    }
  }
  if (damage > 0 && defender.isAlive()) setOffEndings(engine, defender, 'struck');
}
