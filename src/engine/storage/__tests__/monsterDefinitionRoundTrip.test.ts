import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import { Monster } from '../../entities/monster';
import { cotwManifest } from '../../../content/cotw';
import { createScaledMonster } from '../../dungeon/spawner';

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

  it('restores a monster\'s hooks', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Hooker', { manifest: cotwManifest });
    const def = cotwManifest.monsters.find((d) => d.hooks?.length)!;
    engine.addEntity(createScaledMonster(def, 'hooked-1', { x: engine.player.x + 1, y: engine.player.y }, 1));

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    const monster = loaded.map.getAllEntities().find((e) => e.id === 'hooked-1') as Monster;
    expect(monster.hooks).toEqual(def.hooks);
  });

  it('keeps how far floor catch-up has scaled a monster, so a reload cannot compound it', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Returner', { manifest: cotwManifest });
    const veteran = createScaledMonster(cotwManifest.monsters[0], 'veteran-1', { x: engine.player.x + 1, y: engine.player.y }, 1);
    veteran.catchUpScale = 1.25;
    engine.addEntity(veteran);

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    expect((loaded.map.getAllEntities().find((e) => e.id === 'veteran-1') as Monster).catchUpScale).toBe(1.25);
  });

  it('keeps where a hunter last saw the hero, and its search', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Hunted', { manifest: cotwManifest });
    const hunter = createScaledMonster(cotwManifest.monsters[0], 'hunter-1', { x: engine.player.x + 1, y: engine.player.y }, 1);
    hunter.pursuit = { x: 4, y: 7, searchTurns: 3, searching: true };
    engine.addEntity(hunter);

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    expect((loaded.map.getAllEntities().find((e) => e.id === 'hunter-1') as Monster).pursuit).toEqual({ x: 4, y: 7, searchTurns: 3, searching: true });
  });
});
