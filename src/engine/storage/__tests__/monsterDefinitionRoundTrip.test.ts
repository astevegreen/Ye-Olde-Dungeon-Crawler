import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import { Monster } from '../../entities/monster';
import { cotwManifest } from '../../../content/cotw';

describe('monster definition fields across save/load', () => {
  it('restores loot tables and other definition-only fields on every floor', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Looter', { manifest: cotwManifest });
    engine.changeFloor(2);
    engine.changeFloor(3); // floor 2 is now a stored floor

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    const maps = [loaded.map, loaded.storedFloors.get(2)];
    let checked = 0;
    for (const map of maps) {
      for (const m of map?.getAllEntities() ?? []) {
        if (!(m instanceof Monster)) continue;
        const def = loaded.registries.monsters.get(m.definitionId);
        if (!def?.lootTable?.length) continue;
        expect(m.lootTable).toHaveLength(def.lootTable.length);
        expect(m.onHitAffliction).toEqual(def.onHitAffliction);
        checked++;
      }
    }
    // Floors 2 and 3 always hold monsters with loot tables; guard against a vacuous pass.
    expect(checked).toBeGreaterThan(0);
  });
});
