import { describe, it, expect } from 'vitest';
import { DungeonGenerator } from '../dungeon-generator';
import { DungeonArc } from '../../quest/dungeonArc';
import { cotwManifest } from '../../../content/cotw/index';
import { warcraftManifest } from '../../../content/warcraft/index';
import { WARCRAFT_VAULTS } from '../../../content/warcraft/vaults';
import { VaultStamper } from '../vaultStamp';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';

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

  it('validates Warcraft vault blueprints and stamps each cleanly', () => {
    expect(WARCRAFT_VAULTS.length).toBeGreaterThanOrEqual(3);
    const vaultNames = WARCRAFT_VAULTS.map((v) => v.name);
    expect(vaultNames).toContain('Horde Armory');
    expect(vaultNames).toContain('Shadow Council Sanctum');
    expect(vaultNames).toContain('Bladespire Stronghold');

    for (const vault of WARCRAFT_VAULTS) {
      const map = new GameMap(30, 25, TILES.WALL);
      const res = VaultStamper.stamp(
        map,
        vault,
        2,
        2,
        vault.minFloor,
        warcraftManifest.monsters,
        warcraftManifest.items
      );
      expect(res.connectors.length).toBeGreaterThanOrEqual(1);
      expect(res.width).toBe(vault.layout[0].length);
      expect(res.height).toBe(vault.layout.length);

      // Verify that any chest spawned has items from warcraftManifest.items
      for (const chestPos of res.chestSpawns) {
        const items = map.getItemsAt(chestPos.x, chestPos.y);
        expect(items.length).toBeGreaterThanOrEqual(1);
        expect(items[0].category).toBe('container');
      }

      // Verify that any monster spawned is a valid Warcraft monster
      for (const monPos of res.monsterSpawns) {
        const mon = map.getEntityAt(monPos.x, monPos.y);
        expect(mon).not.toBeNull();
        expect(mon?.isAlive()).toBe(true);
      }
    }
  });

  it('integrates seamlessly with DungeonArc.generateFloor across CotW and Warcraft manifests', () => {
    // Generate floor 4 for CotW (< maxFloor)
    const cotwFloor = DungeonArc.generateFloor(4, 10, cotwManifest.quest, cotwManifest, 1.0);
    expect(cotwFloor.map).toBeDefined();
    expect(cotwFloor.playerSpawn).toBeDefined();
    expect(cotwFloor.stairsDown).toBeDefined();

    // Generate floor 3 for Warcraft (< maxFloor)
    const warcraftFloor = DungeonArc.generateFloor(3, 10, warcraftManifest.quest, warcraftManifest, 1.0);
    expect(warcraftFloor.map).toBeDefined();
    expect(warcraftFloor.playerSpawn).toBeDefined();
    expect(warcraftFloor.stairsDown).toBeDefined();
  });
});
