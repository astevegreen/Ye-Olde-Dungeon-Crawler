import type { Item } from '../items/item';

export interface WorldState {
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  factions: Record<string, number>;
  remoteVaults?: Record<string, Item[]>;
}

/**
 * Creates a new, clean WorldState object with optional initial overrides.
 */
export function createWorldState(initial?: Partial<WorldState>): WorldState {
  return {
    flags: { ...(initial?.flags ?? {}) },
    counters: { ...(initial?.counters ?? {}) },
    factions: { ...(initial?.factions ?? {}) },
    remoteVaults: { ...(initial?.remoteVaults ?? {}) },
  };
}

/**
 * Creates a deep clone of a WorldState instance.
 */
export function cloneWorldState(state: WorldState): WorldState {
  const clonedVaults: Record<string, Item[]> = {};
  if (state.remoteVaults) {
    for (const [k, items] of Object.entries(state.remoteVaults)) {
      clonedVaults[k] = [...items];
    }
  }
  return {
    flags: { ...state.flags },
    counters: { ...state.counters },
    factions: { ...state.factions },
    remoteVaults: clonedVaults,
  };
}

/**
 * Sets a boolean flag on the given WorldState.
 */
export function setFlag(state: WorldState, flag: string, value: boolean): WorldState {
  state.flags[flag] = value;
  return state;
}

/**
 * Retrieves the boolean value of a flag (defaults to false).
 */
export function getFlag(state: WorldState, flag: string): boolean {
  return Boolean(state.flags[flag]);
}

/**
 * Increments (or decrements) an integer counter and returns the new value.
 */
export function incrementCounter(state: WorldState, counter: string, delta: number = 1): number {
  const current = state.counters[counter] ?? 0;
  const updated = current + delta;
  state.counters[counter] = updated;
  return updated;
}

/**
 * Retrieves the current value of an integer counter (defaults to 0).
 */
export function getCounter(state: WorldState, counter: string): number {
  return state.counters[counter] ?? 0;
}

/**
 * Modifies faction standing by a delta and returns the new standing value.
 */
export function modifyFaction(state: WorldState, faction: string, delta: number): number {
  const current = state.factions[faction] ?? 0;
  const updated = current + delta;
  state.factions[faction] = updated;
  return updated;
}

/**
 * Retrieves the player's standing with a given faction (defaults to 0 / Neutral).
 */
export function getFaction(state: WorldState, faction: string): number {
  return state.factions[faction] ?? 0;
}

/**
 * Retrieves all items stored in a specified remote vault (defaults to empty array).
 */
export function getVaultItems(state: WorldState, vaultId: string): Item[] {
  if (!state.remoteVaults) {
    state.remoteVaults = {};
  }
  if (!state.remoteVaults[vaultId]) {
    state.remoteVaults[vaultId] = [];
  }
  return state.remoteVaults[vaultId];
}

/**
 * Deposits an item into a remote vault.
 */
export function depositToVault(state: WorldState, vaultId: string, item: Item): void {
  const items = getVaultItems(state, vaultId);
  items.push(item);
}

/**
 * Removes an item by instance or ID from a remote vault.
 */
export function removeFromVault(state: WorldState, vaultId: string, itemOrId: Item | string): Item | null {
  const items = getVaultItems(state, vaultId);
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    return items.splice(idx, 1)[0];
  }
  return null;
}
