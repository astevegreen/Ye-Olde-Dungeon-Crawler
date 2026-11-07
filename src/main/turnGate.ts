import { isTacticalEffect, type ActionResult, type VisualEffectDescriptor } from '../engine';

/** What the gate reads of the engine and the input handler. */
interface GateEngine {
  readonly isPaused: boolean;
}
interface GateInput {
  readonly enabled: boolean;
  readonly isInputLocked: boolean;
  readonly modalStack: { readonly size: number };
}

/**
 * Whether a HUD button or the mouse may act now: the keys' own gate. A run loaded, input
 * enabled, no effect playback holding input (§4), no dialog up, and the world not paused
 * (the F1 card and the aiming reticle leave the HUD clickable while the world is paused).
 */
export function canPlayerAct(engine: GateEngine | null | undefined, input: GateInput | null | undefined): boolean {
  return !!engine && !!input && input.enabled && !input.isInputLocked && input.modalStack.size === 0 && !engine.isPaused;
}

const STOCK_PIPELINE_ERROR = 'An unexpected error occurred; the action could not be completed.';

/**
 * Shows an action's isolated pipeline failure (§4), once: the HUD refreshes many times a
 * turn, and the engine's result is read-only here (§7.2), so the reporter remembers which
 * failed result it already showed.
 */
export function createPipelineErrorReporter(show: (message: string) => void): (result: ActionResult | null | undefined) => void {
  let lastReported: ActionResult | null = null;
  return (result) => {
    if (!result?.pipelineError || result === lastReported) return;
    lastReported = result;
    show(result.message ?? STOCK_PIPELINE_ERROR);
  };
}

/**
 * Plays one batch of visual effects. Only tactical effects gate input (§4): a batch with one
 * takes its own hold for as long as it plays, and lets go even if playback throws; ambient
 * effects play on while the player acts. A later batch's hold keeps input locked until it
 * ends too.
 */
export async function playEffectBatch(
  pending: VisualEffectDescriptor[],
  play: (effects: VisualEffectDescriptor[]) => Promise<void>,
  holdInput: (() => () => void) | undefined
): Promise<void> {
  if (pending.length === 0) return;
  const release = pending.some(isTacticalEffect) ? holdInput?.() : undefined;
  try {
    await play(pending);
  } finally {
    release?.();
  }
}
