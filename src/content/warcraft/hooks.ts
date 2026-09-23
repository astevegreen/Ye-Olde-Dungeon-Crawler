import { MeleeAttackAction, MovementAction, type ActionHook } from '../../engine';

/**
 * Warcraft Action Hooks — Compliant-by-Design
 *
 * ActionHook.execute() callbacks intentionally contain runtime behavior
 * (random chance selection, engine logging). This is by design — the ActionHook
 * interface is a behavioral extension point, not a passive data schema.
 *
 * @see src/engine/actions/actionPipeline.ts for the ActionHook interface
 */

/**
 * Warcraft Theme Action Hooks.
 *
 * `warcraftBattleCryHook`: the player may shout a battle cry as they strike in melee.
 * Player melee is almost always a bump (a MovementAction into a hostile, which performs
 * the attack as a sub-action), and hooks match only the outer action (§4), so this is a
 * pre-hook on every action that recognizes both a bump attack and a direct melee strike.
 */
const BATTLE_CRIES = ['For the Alliance!', "Lok'tar Ogar! Victory or death!", 'For Azeroth!', 'By the Light!'];

export const warcraftBattleCryHook: ActionHook = {
  id: 'warcraft-battle-cry',
  phase: 'pre',
  actionType: '*',
  priority: 50,
  execute({ action, actor, engine }) {
    // Hooks fire for monsters too (§4); these cries are the player's.
    if (actor !== engine.player) return;
    const bumpTarget =
      action instanceof MovementAction
        ? engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId)
        : null;
    const strikes = action instanceof MeleeAttackAction || (!!bumpTarget && actor.isHostileTo(bumpTarget));
    // 25% chance to shout as the blow lands
    if (strikes && engine.rng() < 0.25) {
      const cry = BATTLE_CRIES[Math.floor(engine.rng() * BATTLE_CRIES.length)];
      engine.log(`Battle Cry: "${cry}"`);
    }
  },
};

export const WARCRAFT_ACTION_HOOKS: ActionHook[] = [
  warcraftBattleCryHook,
];
