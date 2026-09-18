import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { VaultStamper, type VaultBlueprint } from '../vaultStamp';
import { COTW_VAULTS } from '../../../content/cotw/vaults';
import { COTW_MONSTERS } from '../../../content/cotw/monsters';
import { DungeonGenerator } from '../dungeon-generator';
import { Mulberry32 } from '../prng';

describe('Vault / Prefab Stamp Injector', () => {
  it('correctly parses ASCII templates and preserves template geometry', () => {
    const blueprint: VaultBlueprint = {
      id: 'test_vault',
      name: 'Test Vault',
      description: 'Test template layout',
      minFloor: 1,
      layout: [
        '#####',
        '#.~X#',
        '@+BP#',
        '#CM.#',
        '#####',
      ],
    };

    const map = new GameMap(10, 10, TILES.WALL);
    const prng = new Mulberry32(111);
    const result = VaultStamper.stamp(map, blueprint, 1, 1, 5, COTW_MONSTERS, [], () => prng.next());

    expect(result.width).toBe(5);
    expect(result.height).toBe(5);
    expect(result.connectors.length).toBe(1);
    expect(result.connectors[0]).toEqual({ x: 1, y: 3 });

    // Verify stamped tiles
    expect(map.getTile(2, 2)?.type).toBe('floor');
    expect(map.getTile(3, 2)?.type).toBe('shallow_water');
    expect(map.getTile(4, 2)?.type).toBe('chasm');
    expect(map.getTile(2, 3)?.type).toBe('door_closed');
    expect(map.getTile(3, 3)?.type).toBe('iron_bars');
    expect(map.getTile(4, 3)?.type).toBe('pillar');

    // Verify chest and monster spawned
    expect(result.chestSpawns.length).toBe(1);
    expect(result.chestSpawns[0]).toEqual({ x: 2, y: 4 });
    const chestItems = map.getItemsAt(2, 4);
    expect(chestItems.length).toBe(1);
    expect(chestItems[0].category).toBe('container');

    expect(result.monsterSpawns.length).toBe(1);
    expect(result.monsterSpawns[0]).toEqual({ x: 3, y: 4 });
    const mon = map.getEntityAt(3, 4);
    expect(mon).not.toBeNull();
    expect(mon?.isAlive()).toBe(true);
  });

  it('validates canonical CotW vaults and stamps them cleanly', () => {
    expect(COTW_VAULTS.length).toBeGreaterThanOrEqual(4);
    const names = COTW_VAULTS.map((v) => v.name);
    expect(names).toContain('The Sunken Cistern');
    expect(names).toContain('The Colonnade Arena');
    expect(names).toContain('The Fortified Strongroom');
    expect(names).toContain('The Chasm Crossing');

    const prng = new Mulberry32(222);
    for (const vault of COTW_VAULTS) {
      const map = new GameMap(30, 25, TILES.WALL);
      const res = VaultStamper.stamp(map, vault, 2, 2, vault.minFloor, [], [], () => prng.next());
      expect(res.connectors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('injects vaults into procedural dungeon generator on floors >= 3', () => {
    let vaultsEncountered = 0;

    for (let seed = 2000; seed < 2020; seed++) {
      const generator = new DungeonGenerator({
        width: 50,
        height: 35,
        floorNumber: 5, // Unlocks Sunken Cistern & Colonnade Arena
        seed,
        spawnMonsters: false,
      });

      const result = generator.generate();
      // Look for tactical tiles characteristic of vaults (shallow_water, pillar, iron_bars, chasm)
      let tacticalTileFound = false;
      for (let y = 0; y < result.map.height; y++) {
        for (let x = 0; x < result.map.width; x++) {
          const t = result.map.getTile(x, y);
          if (
            t &&
            (t.type === 'shallow_water' ||
              t.type === 'pillar' ||
              t.type === 'iron_bars' ||
              t.type === 'chasm')
          ) {
            tacticalTileFound = true;
            break;
          }
        }
        if (tacticalTileFound) break;
      }

      if (tacticalTileFound) {
        vaultsEncountered++;
      }
    }

    expect(vaultsEncountered).toBeGreaterThan(0);
  });
});
