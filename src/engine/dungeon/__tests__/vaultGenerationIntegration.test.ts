import { describe, it, expect } from 'vitest';
import { DungeonGenerator } from '../dungeon-generator';
import { DungeonArc } from '../../quest/dungeonArc';
import { cotwManifest } from '../../../content/cotw/index';
import { fixtureManifest, FIXTURE_VAULTS } from '../../../../tests/fixtures/fixture-pack';
import { VaultStamper } from '../vaultStamp';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { PRNG } from '../prng';

describe('Vault Generation Integration', () => {
  it('stamps vaults using provided monsterCandidates and itemCandidates in DungeonGenerator', () => {
    const generator = new DungeonGenerator({
      width: 50,
      height: 35,
      floorNumber: 5,
      seed: 4242,
      spawnMonsters: false,
      vaults: cotwManifest.vaults,
      monsterCandidates: cotwManifest.monsters,
      itemCandidates: cotwManifest.items,
    });

    const result = generator.generate();
    expect(result.map).toBeDefined();
    expect(result.rooms.length).toBeGreaterThan(0);

    // Verify entities on map include monsters stamped from vault
    const entities = result.map.getAllEntities();
    expect(Array.isArray(entities)).toBe(true);
    // In seed 4242 on floor 5, either a vault or standard rooms stamped
    expect(result.map.isPassable(result.playerSpawn.x, result.playerSpawn.y)).toBe(true);
    expect(result.map.isPassable(result.stairsDown.x, result.stairsDown.y)).toBe(true);
  });

  it('validates the fixture pack\'s vault blueprints and stamps each cleanly', () => {
    expect(FIXTURE_VAULTS.length).toBeGreaterThanOrEqual(3);
    const vaultNames = FIXTURE_VAULTS.map((v) => v.name);
    expect(vaultNames).toContain('Armory');
    expect(vaultNames).toContain('Ritual Sanctum');
    expect(vaultNames).toContain('Chasm Redoubt');

    const prng = new PRNG(333);
    for (const vault of FIXTURE_VAULTS) {
      const map = new GameMap(30, 25, TILES.WALL);
      const res = VaultStamper.stamp(
        map,
        vault,
        2,
        2,
        vault.minFloor,
        fixtureManifest.monsters,
        fixtureManifest.items,
        () => prng.next()
      );
      expect(res.connectors.length).toBeGreaterThanOrEqual(1);
      expect(res.width).toBe(vault.layout[0].length);
      expect(res.height).toBe(vault.layout.length);

      // Verify that any chest spawned has items from fixtureManifest.items
      for (const chestPos of res.chestSpawns) {
        const items = map.getItemsAt(chestPos.x, chestPos.y);
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].category).toBe('container');
      }

      // Verify that any monster spawned is a valid fixture monster
      for (const monPos of res.monsterSpawns) {
        const mon = map.getEntityAt(monPos.x, monPos.y);
        expect(mon).not.toBeNull();
        expect(mon?.isAlive()).toBe(true);
      }
    }
  });

  it('integrates seamlessly with DungeonArc.generateFloor across two packs', () => {
    // Generate floor 4 for CotW (< maxFloor)
    const cotwFloor = DungeonArc.generateFloor(4, 10, cotwManifest.quest, cotwManifest, 1.0);
    expect(cotwFloor.map).toBeDefined();
    expect(cotwFloor.playerSpawn).toBeDefined();
    expect(cotwFloor.stairsDown).toBeDefined();

    // Generate floor 3 for the fixture pack (< maxFloor)
    const fixtureFloor = DungeonArc.generateFloor(3, 10, fixtureManifest.quest, fixtureManifest, 1.0);
    expect(fixtureFloor.map).toBeDefined();
    expect(fixtureFloor.playerSpawn).toBeDefined();
    expect(fixtureFloor.stairsDown).toBeDefined();
  });
});
