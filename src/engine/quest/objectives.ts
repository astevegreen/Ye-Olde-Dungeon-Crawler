import type { ObjectiveDefinition } from '../types/manifest';

/** What `getCurrentObjective` reads: the world-state views `GameEngine` exposes. */
export interface ObjectiveStateView {
  readonly manifest: { objectives?: ObjectiveDefinition[] };
  getWorldFlag(flag: string): boolean;
  getWorldCounter(counter: string): number;
}

function isDone(def: ObjectiveDefinition, state: ObjectiveStateView): boolean {
  if (def.doneWhenAnyFlag?.some((flag) => state.getWorldFlag(flag))) return true;
  const counter = def.doneWhenCounterAtLeast;
  return !!counter && state.getWorldCounter(counter.counter) >= counter.value;
}

/**
 * The pack's current objective, for presentation: the first `manifest.objectives`
 * entry that is available (its `availableWhenFlag`, if any, is set) and not yet done.
 * Undefined when the pack declares none or all are done.
 */
export function getCurrentObjective(state: ObjectiveStateView): ObjectiveDefinition | undefined {
  for (const def of state.manifest.objectives ?? []) {
    if (def.availableWhenFlag && !state.getWorldFlag(def.availableWhenFlag)) continue;
    if (!isDone(def, state)) return def;
  }
  return undefined;
}
