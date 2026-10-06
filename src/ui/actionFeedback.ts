import type { Action, ActionResult, GameEngine } from '../engine';

/**
 * Runs a player action and, when it fails, logs why. Most actions log their own refusals
 * ("There is nothing here to pick up."), but some only return them: climbing with no stairs
 * underfoot, or channelling a dormant Rune of Return. The player saw nothing. A pack hook
 * that already logged its refusal (the Oath's hold on the stairs) isn't logged twice.
 */
export function runAndExplain(engine: GameEngine, action: Action): ActionResult {
  const result = engine.handlePlayerAction(action);
  if (!result.success && !result.pipelineError && result.message && engine.messages[engine.messages.length - 1] !== result.message) {
    engine.log(result.message);
  }
  return result;
}
