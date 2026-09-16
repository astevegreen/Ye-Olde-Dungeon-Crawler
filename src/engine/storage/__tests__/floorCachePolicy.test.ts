import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { BulkArchive } from '../bulkArchive';
import { InMemoryAsyncStore } from '../asyncStore';
import { offloadInactiveFloors, hydrateArchivedFloors } from '../floorCachePolicy';
import { serializeGame } from '../serializer';
import type { SaveData } from '../types';

/**
 * Bounded save payloads (ARCHITECTURE.md §5): the active floor stays inline, inactive
 * floors move to the async tier, and a load puts them back before play resumes.
 */
function buildEngine(storedFloors: number[]) {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
  const engine = new GameEngine({ map, player, seed: 11 });
  for (const floor of storedFloors) {
    engine.storedFloors.set(floor, new GameMap(12, 12, TILES.FLOOR));
  }
  return engine;
}

let archive: BulkArchive;
beforeEach(() => {
  archive = new BulkArchive(new InMemoryAsyncStore());
});

describe('Single-floor active cache policy', () => {
  it('moves inactive floors out of the payload and records their numbers', async () => {
    const engine = buildEngine([2, 3]);
    const saveData = serializeGame(engine) as SaveData;
    expect(Object.keys(saveData.storedMaps ?? {})).toHaveLength(2);

    const archived = await offloadInactiveFloors(saveData, 'hero-1', archive);

    expect(archived).toEqual([2, 3]);
    expect(Object.keys(saveData.storedMaps ?? {})).toHaveLength(0);
    expect(saveData.archivedFloors).toEqual([2, 3]);
    expect(await archive.listFloors('hero-1')).toEqual([2, 3]);
  });

  it('keeps the active floor inline', async () => {
    const engine = buildEngine([4]);
    const saveData = serializeGame(engine) as SaveData;

    await offloadInactiveFloors(saveData, 'hero-1', archive);

    // The active floor is serialized separately from storedMaps and must survive untouched.
    expect(saveData.map).toBeDefined();
    expect(saveData.archivedFloors).toEqual([4]);
  });

  it('hydrates archived floors back into a loaded engine', async () => {
    const source = buildEngine([2, 5]);
    const saveData = serializeGame(source) as SaveData;
    await offloadInactiveFloors(saveData, 'hero-1', archive);

    const loaded = buildEngine([]);
    const hydrated = await hydrateArchivedFloors(loaded, 'hero-1', archive, saveData.archivedFloors);

    // A fresh engine already holds its own active floor, so assert on the archived ones.
    expect(hydrated).toBe(2);
    expect(loaded.storedFloors.has(2)).toBe(true);
    expect(loaded.storedFloors.has(5)).toBe(true);
  });

  it('leaves a floor absent when the archive cannot supply it, rather than failing', async () => {
    const loaded = buildEngine([]);

    const hydrated = await hydrateArchivedFloors(loaded, 'hero-1', archive, [7, 8]);

    expect(hydrated).toBe(0);
    expect(loaded.storedFloors.has(7)).toBe(false);
    expect(loaded.storedFloors.has(8)).toBe(false);
  });

  it('does not overwrite a floor the engine already holds', async () => {
    const source = buildEngine([3]);
    const saveData = serializeGame(source) as SaveData;
    await offloadInactiveFloors(saveData, 'hero-1', archive);

    const loaded = buildEngine([3]);
    const existing = loaded.storedFloors.get(3);

    await hydrateArchivedFloors(loaded, 'hero-1', archive, [3]);

    expect(loaded.storedFloors.get(3)).toBe(existing);
  });
});
