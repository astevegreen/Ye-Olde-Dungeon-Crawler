import type { Action } from '../actions/action';
import type { TrailValue } from './types';

/** Fields naming who acts; the trail always replays as the player, so these are dropped. */
const ACTOR_FIELDS = new Set(['entity', 'player', 'attacker', 'caster', 'user', 'actor']);

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Reduces an action to its name and scalar parameters, generically: primitive fields
 * are kept, an entity or item field `foo` becomes its id as `fooId`, and a flat object
 * of primitives (a direction, a tile) is copied. Functions and actor references are
 * dropped. `debug/replay.ts` rebuilds actions from this shape.
 */
export function describeAction(action: Action): { action: string; params: Record<string, TrailValue> } {
  const params: Record<string, TrailValue> = {};
  for (const [key, value] of Object.entries(action)) {
    if (value === null || value === undefined || typeof value === 'function') continue;
    if (key === 'actionType' || key === 'type') continue;
    if (isScalar(value)) {
      params[key] = value;
      continue;
    }
    if (typeof value !== 'object' || ACTOR_FIELDS.has(key)) continue;
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string') {
      params[`${key}Id`] = id;
      continue;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0 && entries.length <= 6 && entries.every(([, v]) => isScalar(v))) {
      params[key] = Object.fromEntries(entries) as Record<string, string | number | boolean>;
    }
  }
  return { action: action.actionType ?? action.constructor.name, params };
}

/** One-line form for reports: `MovementAction dx=1 dy=0`. */
export function formatTrailEntry(entry: { action: string; params: Record<string, TrailValue> }): string {
  const parts = Object.entries(entry.params).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  return parts.length > 0 ? `${entry.action} ${parts.join(' ')}` : entry.action;
}
