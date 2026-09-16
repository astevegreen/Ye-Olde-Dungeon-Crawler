import type { GameEngine } from '../engine';
import type { BulkArchive } from './bulkArchive';
import type { SaveData, SerializedMap } from './types';
import { deserializeMapObject } from './serializer';

/**
 * Bounded save payloads (ARCHITECTURE.md §5).
 *
 * A save used to carry every visited floor, so the synchronous payload grew with the run
 * and eventually threatened the quota. The active floor stays in the synchronous save —
 * it is what a session needs to resume — and inactive floors move to the asynchronous
 * tier (§5, `BulkArchive`), leaving only their floor numbers behind in `archivedFloors`.
 *
 * Why hydrate at load rather than fetch on demand: `GameEngine.changeFloor` is
 * synchronous, so a floor cannot be awaited mid-turn. Loading already happens at an async
 * boundary (boot or menu), so archived floors are fetched there and placed into
 * `engine.storedFloors` before play resumes.
 *
 * Degradation is deliberate: if the archive is unavailable or an entry is missing, the
 * floor is simply absent and regenerates from its seed on revisit, exactly as an
 * never-visited floor would.
 */

/**
 * Moves inactive floors out of a save payload and into the archive.
 * Mutates `saveData` and returns the floor numbers that were offloaded.
 */
export async function offloadInactiveFloors(
  saveData: SaveData,
  profileId: string,
  archive: BulkArchive
): Promise<number[]> {
  const stored = saveData.storedMaps ?? {};
  const floors = Object.keys(stored).map(Number).filter(Number.isFinite);
  if (floors.length === 0) {
    saveData.archivedFloors = [];
    return [];
  }

  const archived: number[] = [];
  for (const floorNumber of floors) {
    const map = stored[floorNumber] as SerializedMap | undefined;
    if (!map) continue;
    await archive.putFloor(profileId, floorNumber, map);
    archived.push(floorNumber);
  }

  // Only drop what actually reached the archive.
  for (const floorNumber of archived) {
    delete stored[floorNumber];
  }
  saveData.storedMaps = stored;
  saveData.archivedFloors = archived.sort((a, b) => a - b);
  return saveData.archivedFloors;
}

/**
 * Restores archived floors into a loaded engine. Returns how many were hydrated; floors
 * the archive cannot supply are left absent to regenerate on revisit.
 */
export async function hydrateArchivedFloors(
  engine: GameEngine,
  profileId: string,
  archive: BulkArchive,
  archivedFloors?: number[]
): Promise<number> {
  const wanted = archivedFloors ?? (await archive.listFloors(profileId));
  let hydrated = 0;

  for (const floorNumber of wanted) {
    if (floorNumber === engine.currentFloor || engine.storedFloors.has(floorNumber)) continue;
    const serialized = await archive.getFloor(profileId, floorNumber);
    if (!serialized) continue;
    engine.storedFloors.set(floorNumber, deserializeMapObject(serialized));
    hydrated++;
  }

  return hydrated;
}
