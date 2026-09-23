import type { TimedEventDefinition } from '../types/manifest';

/** What `getTimedEventCountdowns` reads: the world-state views `GameEngine` exposes. */
export interface TimedEventStateView {
  readonly manifest: { timedEvents?: TimedEventDefinition[] };
  readonly turnCount: number;
  getWorldFlag(flag: string): boolean;
  getWorldCounter(counter: string): number;
}

export interface TimedEventCountdown {
  id: string;
  label: string;
  turnsRemaining: number;
}

/**
 * Running, labelled `manifest.timedEvents` countdowns, for presentation. Reads the
 * world-state keys `GameEngine.tickTimedEvents` writes (`timed_event_started:<id>` flag,
 * `timed_event_start:<id>` counter holding the start turn); an event whose start flag is
 * set but hasn't been ticked yet still has its full `turnLimit` left.
 */
export function getTimedEventCountdowns(state: TimedEventStateView): TimedEventCountdown[] {
  const countdowns: TimedEventCountdown[] = [];
  for (const def of state.manifest.timedEvents ?? []) {
    if (!def.label) continue;
    if (state.getWorldFlag(def.resolvedFlag) || !state.getWorldFlag(def.startFlag)) continue;
    const ticked = state.getWorldFlag(`timed_event_started:${def.id}`);
    const startTurn = ticked ? state.getWorldCounter(`timed_event_start:${def.id}`) : state.turnCount;
    countdowns.push({
      id: def.id,
      label: def.label,
      turnsRemaining: Math.max(0, def.turnLimit - (state.turnCount - startTurn)),
    });
  }
  return countdowns;
}
