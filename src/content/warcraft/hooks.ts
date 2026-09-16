import type { ActionHook } from '../../engine';

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
 * Demonstrates manifest-driven action pipeline hooks:
 * 1. `warcraftBattleCryHook`: Post-melee hook that logs an iconic Warcraft battle cry on successful strikes.
 */
export const warcraftBattleCryHook: ActionHook = {
  id: 'warcraft-battle-cry',
  phase: 'post',
  actionType: 'melee',
  priority: 50,
  execute(context) {
    if (context.result?.success) {
      const cries = [
        'For the Alliance!',
        "Lok'tar Ogar! Victory or death!",
        'For Azeroth!',
        'By the Light!',
      ];
      // 25% chance to shout during combat
      if (Math.random() < 0.25) {
        const cry = cries[Math.floor(Math.random() * cries.length)];
        context.engine.log(`Battle Cry: "${cry}"`);
      }
    }
  },
};

export const WARCRAFT_ACTION_HOOKS: ActionHook[] = [
  warcraftBattleCryHook,
];
