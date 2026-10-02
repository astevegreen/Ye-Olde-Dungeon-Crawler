import { describe, it, expect } from 'vitest';
import { FovManager } from '../fov-manager';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { serializeGame, deserializeSaveData } from '../../storage/serializer';
import type { SaveData } from '../../storage/types';
import { BulkArchive } from '../../storage/bulkArchive';
import { InMemoryAsyncStore } from '../../storage/asyncStore';
import { offloadInactiveFloors, hydrateArchivedFloors } from '../../storage/floorCachePolicy';
import { cotwManifest } from '../../../content/cotw';

/** A lit floor (`GameMap.lit`, a town by day) is seen as far as line of sight goes. */
describe('Lit floors', () => {
  const open = () => new GameMap(60, 20, TILES.FLOOR);

  it('sees the whole line of sight on a lit map, the given radius on an unlit one', () => {
    const map = open();
    const fov = new FovManager(60, 20);

    fov.update(map, 5, 10, 8);
    expect(fov.isVisible(40, 10)).toBe(false);

    map.lit = true;
    fov.update(map, 5, 10, 8);
    expect(fov.isVisible(40, 10)).toBe(true);
    expect(fov.isVisible(58, 10)).toBe(true);
  });

  it('still stops at walls on a lit map', () => {
    const map = open();
    map.lit = true;
    for (let y = 0; y < 20; y++) map.setTile(20, y, TILES.WALL);
    const fov = new FovManager(60, 20);

    fov.update(map, 5, 10, 8);
    expect(fov.isVisible(19, 10)).toBe(true);
    expect(fov.isVisible(30, 10)).toBe(false);
  });

  it('keeps a senses limit (blindness, radius 1) on a lit map', () => {
    const map = open();
    map.lit = true;
    const fov = new FovManager(60, 20);

    fov.update(map, 5, 10, 1);
    expect(fov.isVisible(6, 10)).toBe(true);
    expect(fov.isVisible(8, 10)).toBe(false);
  });

  it("lights cotw's town from the manifest, on arrival and again after a load", () => {
    expect(cotwManifest.town?.lit).toBe(true);
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Sigrid');
    expect(engine.currentFloor).toBe(0);
    expect(engine.map.lit).toBe(true);

    engine.changeFloor(1);
    expect(engine.map.lit).toBe(false);

    // The flag isn't saved: a load derives it for the town, current or stored.
    const fromDungeon = deserializeSaveData(JSON.parse(JSON.stringify(serializeGame(engine))) as SaveData, cotwManifest);
    expect(fromDungeon.map.lit).toBe(false);
    expect(fromDungeon.storedFloors.get(0)?.lit).toBe(true);

    fromDungeon.changeFloor(0);
    const inTown = deserializeSaveData(JSON.parse(JSON.stringify(serializeGame(fromDungeon))) as SaveData, cotwManifest);
    expect(inTown.currentFloor).toBe(0);
    expect(inTown.map.lit).toBe(true);
  });

  it('keeps the town lit through the floor archive', async () => {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Ragna');
    engine.changeFloor(1);
    const archive = new BulkArchive(new InMemoryAsyncStore());
    const saveData = serializeGame(engine) as SaveData;
    await offloadInactiveFloors(saveData, 'hero-1', archive);

    const loaded = deserializeSaveData(JSON.parse(JSON.stringify(saveData)) as SaveData, cotwManifest);
    expect(loaded.storedFloors.has(0)).toBe(false);
    await hydrateArchivedFloors(loaded, 'hero-1', archive, saveData.archivedFloors);
    expect(loaded.storedFloors.get(0)?.lit).toBe(true);
  });
});
