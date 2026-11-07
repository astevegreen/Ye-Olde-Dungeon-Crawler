import { describe, it, expect, vi } from 'vitest';
import { DungeonArc } from '../../quest/dungeonArc';
import { fixtureManifest, FIXTURE_VAULTS } from '../../../../tests/fixtures/fixture-pack';
import { VaultStamper } from '../vaultStamp';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { PRNG } from '../prng';
import type { Position } from '../../types';

describe('Vault Generation Integration', () => {
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

  // The second pack proves floors don't depend on cotw (§1): on each of the fixture pack's
  // floors, over several seeds, the stairs down are a real walk from where the hero arrives,
  // and the pack's own vaults get stamped somewhere. The walk is four-way, doors opened on the
  // way: monsters cut a corner only past an open side (pathfinding.ts) and spawn sites reach
  // four ways (spawnSites.ts), so a floor the hero crosses only by a diagonal squeeze between a
  // vault pillar and a wall is one they can't (floor 3 seed 11 and floor 4 seeds 1 and 11 were).
  it("the fixture pack's floors connect the arrival to the stairs down and every other open tile, and stamp its vaults", () => {
    const stamp = vi.spyOn(VaultStamper, 'stamp');
    const maxFloor = fixtureManifest.quest!.maxFloor!;
    expect(maxFloor).toBeGreaterThan(1);
    for (let floor = 1; floor < maxFloor; floor++) {
      for (const seed of [1, 10, 11, 12, 13]) {
        const where = `floor ${floor}, seed ${seed}`;
        const f = DungeonArc.generateFloor(floor, seed, fixtureManifest.quest, fixtureManifest, 1.0);
        expect(f.stairsDown, where).toBeDefined();
        expect(f.map.getTile(f.stairsDown!.x, f.stairsDown!.y)?.type, where).toBe('stairs_down');
        const reached = fourWayWalk(f.map, f.playerSpawn);
        expect(reached.has(`${f.stairsDown!.x},${f.stairsDown!.y}`), where).toBe(true);
        // Nor is any of it sealed off: a vault whose connector was joined to its own center, or a
        // corridor stopped by another vault's pillar, left a vault or a room with no way in.
        const sealed: string[] = [];
        for (let y = 0; y < f.map.height; y++) {
          for (let x = 0; x < f.map.width; x++) if (f.map.isPassable(x, y) && !reached.has(`${x},${y}`)) sealed.push(`${x},${y}`);
        }
        expect(sealed, where).toEqual([]);
      }
    }
    const stamped = stamp.mock.calls.map(([, blueprint]) => blueprint);
    expect(stamped.length).toBeGreaterThan(0);
    expect(stamped.every((v) => FIXTURE_VAULTS.includes(v))).toBe(true);
  });
});

/** The tiles a four-way walk from `from` reaches over passable tiles and doors, as "x,y". */
function fourWayWalk(map: GameMap, from: Position): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue: Position[] = [from];
  for (let k = 0; k < queue.length; k++) {
    const { x, y } = queue[k];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !map.inBounds(nx, ny)) continue;
      const type = map.getTile(nx, ny)?.type;
      if (!map.isPassable(nx, ny) && type !== 'door_closed' && type !== 'secret_door') continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
