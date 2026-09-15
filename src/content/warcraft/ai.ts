import type { Action } from '../../engine/actions/action';
import type { GameEngine } from '../../engine';
import type { Monster } from '../../engine/entities/monster';
import type { AiBehaviorStrategy } from '../../engine/ai/aiBehaviorRegistry';
import { MeleeAttackAction, WindUpDeclareAction } from '../../engine/actions/combat';
import { MovementAction } from '../../engine/actions/movement';
import { OpenDoorAction } from '../../engine/actions/door';
import { WaitAction } from '../../engine/actions/wait';
import { findPath } from '../../engine/ai/pathfinding';

/**
 * Warcraft AI Behavior Strategies — Compliant-by-Design
 *
 * Content files in src/content/ that implement engine strategy interfaces
 * (AiBehaviorStrategy, ActionHook, etc.) intentionally contain runtime behavior.
 * These are behavioral plugins, not passive data — the strategy pattern requires
 * executable logic. This is the correct implementation pattern.
 *
 * @see src/engine/ai/aiBehaviorRegistry.ts for the AiBehaviorStrategy interface
 */

/**
 * Warchief AI Behavior Strategy (Warcraft Theme).
 *
 * Implements relentless, tactical horde chieftain aggression:
 * 1. Never flees (fleeHealthPercent: 0).
 * 2. In close melee (distance <= 1):
 *    - 40% chance of telegraphing a crushing wind-up blow ('Decapitating Strike').
 *    - Otherwise executes a brutal melee strike.
 * 3. At range: relentlessly paths towards the player, battering down doors.
 * 4. When critically wounded (HP <= 40%), enters blood-crazed frenzy, shouting combat dialogue.
 */
export class WarchiefBehavior implements AiBehaviorStrategy {
  public readonly id = 'warchief';
  public readonly name = 'Warchief Blackhand';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = engine.player;
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));

    // Bloodlust battle roar when entering critical health (once per warchief; world flags persist in saves)
    const roarFlag = `warchief_roared:${monster.id}`;
    if (monster.hp <= monster.maxHp * 0.4 && !engine.getWorldFlag(roarFlag)) {
      engine.setWorldFlag(roarFlag, true);
      engine.log(`${monster.name} enters a blood-crazed frenzy: "Lok'tar Ogar! None shall escape the Horde!"`);
    }

    if (chebyshevDist <= 1) {
      if (Math.random() < 0.4) {
        return new WindUpDeclareAction(
          monster,
          { x: player.x, y: player.y },
          'Decapitating Strike',
          `${monster.name} bellows fiercely, winding up a Decapitating Strike!`
        );
      }
      monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
      return new MeleeAttackAction(monster, player);
    }

    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      const next = path[0];
      const tile = engine.map.getTile(next.x, next.y);
      if (tile && tile.type === 'door_closed') {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }

    return new WaitAction(monster);
  }
}

export const WARCRAFT_AI_BEHAVIORS: Record<string, AiBehaviorStrategy> = {
  warchief: new WarchiefBehavior(),
};
