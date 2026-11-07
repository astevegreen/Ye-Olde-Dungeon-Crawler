import { describe, it, expect, vi } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { VaultStamper, type VaultBlueprint } from '../vaultStamp';
import { COTW_VAULTS } from '../../../content/cotw/vaults';
import { COTW_MONSTERS } from '../../../content/cotw/monsters';
import { DungeonGenerator } from '../dungeon-generator';
import { PRNG } from '../prng';

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
    const prng = new PRNG(111);
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

    const prng = new PRNG(222);
    for (const vault of COTW_VAULTS) {
      const map = new GameMap(30, 25, TILES.WALL);
      const res = VaultStamper.stamp(map, vault, 2, 2, vault.minFloor, [], [], () => prng.next());
      expect(res.connectors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps a vault's own guards near their depth, and draws from the floor once they're stale", () => {
    const cistern = COTW_VAULTS.find((v) => v.id === 'sunken_cistern')!; // giant rats and kobolds
    const guards = (floor: number) => {
      const prng = new PRNG(99);
      const map = new GameMap(30, 25, TILES.WALL);
      VaultStamper.stamp(map, cistern, 2, 2, floor, COTW_MONSTERS, [], () => prng.next());
      return map.getAllEntities().map((e) => (e as { definitionId?: string }).definitionId);
    };
    const shallow = guards(4);
    expect(shallow.length).toBeGreaterThan(0);
    expect(shallow.every((id) => id === 'giant_rat' || id === 'kobold')).toBe(true);
    const deep = guards(44);
    expect(deep.length).toBe(shallow.length);
    expect(deep.some((id) => id === 'giant_rat' || id === 'kobold')).toBe(false);
  });

  // The generator only stamps the vaults it is given: without COTW_VAULTS this once passed on
  // pillars and water from ordinary rooms. It now counts the stamps themselves.
  it('injects vaults into procedural dungeon generator on floors >= 3', () => {
    const stamp = vi.spyOn(VaultStamper, 'stamp');
    for (let seed = 2000; seed < 2020; seed++) {
      new DungeonGenerator({ width: 50, height: 35, floorNumber: 5, seed, spawnMonsters: false, vaults: COTW_VAULTS }).generate();
    }

    expect(stamp.mock.calls.length).toBeGreaterThan(0);
    for (const [, blueprint] of stamp.mock.calls) {
      expect(COTW_VAULTS).toContain(blueprint);
      expect(blueprint.minFloor ?? 1).toBeLessThanOrEqual(5);
    }
  });

  it('stamps no vault when given none, or none deep enough', () => {
    const stamp = vi.spyOn(VaultStamper, 'stamp');
    const deepOnly = COTW_VAULTS.filter((v) => (v.minFloor ?? 1) > 2);
    expect(deepOnly.length).toBeGreaterThan(0);
    for (let seed = 2000; seed < 2010; seed++) {
      new DungeonGenerator({ width: 50, height: 35, floorNumber: 5, seed, spawnMonsters: false }).generate();
      new DungeonGenerator({ width: 50, height: 35, floorNumber: 2, seed, spawnMonsters: false, vaults: deepOnly }).generate();
    }
    expect(stamp).not.toHaveBeenCalled();
  });
});

/**
 * R-ai-14: the floor's monster and loot passes skip rooms[0] as the arrival room, but BSP
 * pushed vault rooms first, so with a vault the arrival room was populated and the vault
 * skipped. The generator now returns its rooms arrival-first, as the layout strategies do.
 */
describe('R-ai-14 · a BSP floor lists its arrival room first', () => {
  it('rooms[0] holds the player spawn, vault or not', () => {
    for (let seed = 2000; seed < 2020; seed++) {
      const result = new DungeonGenerator({ width: 50, height: 35, floorNumber: 5, seed, spawnMonsters: false, vaults: COTW_VAULTS, forcedVaultId: 'floor5_rune_vault' }).generate();
      expect(result.forcedVaultPlaced, `seed ${seed}`).toBe(true);
      const first = result.rooms[0];
      const inside =
        result.playerSpawn.x >= first.x1 && result.playerSpawn.x <= first.x2 && result.playerSpawn.y >= first.y1 && result.playerSpawn.y <= first.y2;
      expect(inside, `seed ${seed}`).toBe(true);
    }
  });
});
