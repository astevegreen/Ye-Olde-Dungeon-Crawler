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

/** A running countdown, labelled or not (`TimedEventDefinition.label` is optional). */
export interface RunningTimedEvent {
  id: string;
  label?: string;
  turnsRemaining: number;
}

/**
 * Every running `manifest.timedEvents` countdown: started and not yet resolved. Reads the
 * world-state keys `GameEngine.tickTimedEvents` writes (`timed_event_started:<id>` flag,
 * `timed_event_start:<id>` counter holding the start turn); an event whose start flag is
 * set but hasn't been ticked yet still has its full `turnLimit` left.
 */
export function getRunningTimedEvents(state: TimedEventStateView): RunningTimedEvent[] {
  const running: RunningTimedEvent[] = [];
  for (const def of state.manifest.timedEvents ?? []) {
    if (state.getWorldFlag(def.resolvedFlag) || !state.getWorldFlag(def.startFlag)) continue;
    const ticked = state.getWorldFlag(`timed_event_started:${def.id}`);
    const startTurn = ticked ? state.getWorldCounter(`timed_event_start:${def.id}`) : state.turnCount;
    running.push({ id: def.id, label: def.label, turnsRemaining: Math.max(0, def.turnLimit - (state.turnCount - startTurn)) });
  }
  return running;
}

/** The running countdowns that carry a `label`, for presentation (the HUD draws these). */
export function getTimedEventCountdowns(state: TimedEventStateView): TimedEventCountdown[] {
  return getRunningTimedEvents(state).flatMap((e) => (e.label ? [{ id: e.id, label: e.label, turnsRemaining: e.turnsRemaining }] : []));
}
