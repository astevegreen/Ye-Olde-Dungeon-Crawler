import {
  findPath,
  MeleeAttackAction,
  MovementAction,
  OpenDoorAction,
  WaitAction,
  WindUpDeclareAction,
} from '../../../src/engine';
import type { Action, ActionHook, AiBehaviorStrategy, GameEngine, Monster, StatusHandler } from '../../../src/engine';

/** A damage-over-time status the engine doesn't ship, registered from the manifest. */
export const FIXTURE_STATUS_HANDLERS: Record<string, StatusHandler> = {
  burning: {
    onTick(entity, effect) {
      const dmg = effect.potency ?? 3;
      // Periodic damage must not wake a sleeping monster.
      const res =
        entity.type === 'monster' ? (entity as Monster).takeDamage(dmg, { wakeUp: false }) : entity.takeDamage(dmg);
      return {
        damageTaken: res.damageDealt,
        killed: res.killed,
        message: `${entity.name} is scorched for ${res.damageDealt} burning damage!`,
      };
    },
    onApply(entity) {
      return `${entity.name} bursts into flames!`;
    },
    onExpire(entity) {
      return `The flames on ${entity.name} die out.`;
    },
  },
};

const BATTLE_CRIES = ['Charge!', 'For the banner!'];

/**
 * The player may shout as they strike in melee. Player melee is almost always a bump (a
 * MovementAction into a hostile, which performs the attack as a sub-action), and hooks
 * match only the outer action (ARCHITECTURE.md §4), so this pre-hook runs on every action
 * and recognizes both a bump attack and a direct melee strike.
 */
const battleCryHook: ActionHook = {
  id: 'fixture-battle-cry',
  phase: 'pre',
  actionType: '*',
  priority: 50,
  execute({ action, actor, engine }) {
    // Hooks fire for monsters too (§4); the cries are the player's.
    if (actor !== engine.player) return;
    const bumpTarget =
      action instanceof MovementAction
        ? engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId)
        : null;
    const strikes = action instanceof MeleeAttackAction || (!!bumpTarget && actor.isHostileTo(bumpTarget));
    if (strikes && engine.rng() < 0.25) {
      engine.log(`Battle Cry: "${BATTLE_CRIES[Math.floor(engine.rng() * BATTLE_CRIES.length)]}"`);
    }
  },
};

export const FIXTURE_ACTION_HOOKS: ActionHook[] = [battleCryHook];

/**
 * A boss that never flees: adjacent, it winds up a telegraphed blow 40% of the time and
 * strikes otherwise; at range it paths to the player, opening doors. Below 40% HP it roars
 * once (a world flag, so the roar survives a save).
 */
class WarlordBehavior implements AiBehaviorStrategy {
  public readonly id = 'warlord';
  public readonly name = 'Warlord';

  public decideAction(monster: Monster, engine: GameEngine): Action {
    const player = engine.player;
    const chebyshevDist = Math.max(Math.abs(monster.x - player.x), Math.abs(monster.y - player.y));

    const roarFlag = `warlord_roared:${monster.id}`;
    if (monster.hp <= monster.maxHp * 0.4 && !engine.getWorldFlag(roarFlag)) {
      engine.setWorldFlag(roarFlag, true);
      engine.log(`${monster.name} roars: "No retreat!"`);
    }

    if (chebyshevDist <= 1 && engine.rng() < 0.4) {
      return new WindUpDeclareAction(
        monster,
        { x: player.x, y: player.y },
        'Crushing Blow',
        `${monster.name} winds up a Crushing Blow!`
      );
    }
    monster.intent = { type: 'attack', targetTile: { x: player.x, y: player.y }, turnsRemaining: 0 };
    if (chebyshevDist <= 1) return new MeleeAttackAction(monster, player);

    const path = findPath(engine.map, monster.position, player.position, true);
    if (path.length > 0) {
      const next = path[0];
      if (engine.map.getTile(next.x, next.y)?.type === 'door_closed') {
        return new OpenDoorAction(monster, next.x, next.y);
      }
      return new MovementAction(monster, next.x - monster.x, next.y - monster.y);
    }
    return new WaitAction(monster);
  }
}

export const FIXTURE_AI_BEHAVIORS: Record<string, AiBehaviorStrategy> = {
  warlord: new WarlordBehavior(),
};
