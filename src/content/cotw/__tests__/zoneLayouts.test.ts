import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../../../engine/quest/dungeonArc';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { cotwManifest } from '../index';
import { COTW_QUEST } from '../quest';
import { COTW_FLOOR_SIZE } from '../floorLayouts';
import { SIPHON_ALTAR_TILE } from '../hostageRitual';

/**
 * Every zone's layout, through the real generation path (DungeonArc + cotw manifest):
 * playable on many seeds, the right size, and carrying its forced placements.
 */
const QUEST = { ...COTW_QUEST, maxFloor: 50, bossFloor: 50 };

function path(map: GameMap, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length > 0) {
    const p = queue.shift()!;
    if (p.x === to.x && p.y === to.y) return true;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (seen.has(k) || !map.inBounds(n.x, n.y)) continue;
      const t = map.getTile(n.x, n.y);
      if (t && (t.passable || t.type === 'door_closed')) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return false;
}

function stairsDown(map: GameMap): { x: number; y: number } | null {
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.getTile(x, y)?.type === 'stairs_down') return { x, y };
  return null;
}

describe('cotw zone layouts', () => {
  for (const floor of [1, 5, 9, 12, 17, 20, 22, 28, 36, 44, 45]) {
    it(`floor ${floor}: 57x40, stairs reachable, spawn safe, on 15 seeds`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const r = DungeonArc.generateFloor(floor, seed * 104729, QUEST, cotwManifest);
        expect(r.map.width).toBe(COTW_FLOOR_SIZE.width);
        expect(r.map.height).toBe(COTW_FLOOR_SIZE.height);
        expect(r.map.getTile(r.playerSpawn.x, r.playerSpawn.y)?.type).toBe('stairs_up');
        const down = stairsDown(r.map);
        expect(down, `floor ${floor} seed ${seed}: no stairs down`).not.toBeNull();
        expect(path(r.map, r.playerSpawn, down!), `floor ${floor} seed ${seed}: stairs unreachable`).toBe(true);
        const adjacentHazard = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(
          ([dx, dy]) => r.map.getTile(r.playerSpawn.x + dx, r.playerSpawn.y + dy)?.type === 'chasm'
        );
        expect(adjacentHazard, `floor ${floor} seed ${seed}: spawn beside a chasm`).toBe(false);
      }
    });
  }

  it('floor 22 always stamps the Siphon Altar', () => {
    // The altar is a pack tile: it resolves through an engine's registries.
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }), manifest: cotwManifest });
    for (let seed = 1; seed <= 15; seed++) {
      const r = DungeonArc.generateFloor(22, seed * 7919, QUEST, cotwManifest, 1, undefined, engine.registries);
      let altar = false;
      for (let y = 0; y < r.map.height && !altar; y++) for (let x = 0; x < r.map.width; x++) if (r.map.getTile(x, y)?.type === SIPHON_ALTAR_TILE) altar = true;
      expect(altar, `seed ${seed}`).toBe(true);
    }
  });

  it("floor 45 always stamps the fang vault and its herald", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const r = DungeonArc.generateFloor(45, seed * 7919, QUEST, cotwManifest);
      const herald = r.map.getAllEntities().some((e) => e instanceof Monster && e.definitionId === 'miniboss_maw_herald');
      expect(herald, `seed ${seed}`).toBe(true);
    }
  });

  it('the Heartwood lair: boss on the dais, reachable from the stairs', () => {
    const r = DungeonArc.generateFloor(50, 1, QUEST, cotwManifest);
    expect(r.map.width).toBe(57);
    expect(r.map.getTile(r.stairsUp!.x, r.stairsUp!.y)?.type).toBe('stairs_up');
    expect(r.boss).toBeDefined();
    expect(path(r.map, r.playerSpawn, { x: r.boss!.x, y: r.boss!.y })).toBe(true);
    const guards = r.map.getAllEntities().filter((e) => e instanceof Monster && e !== r.boss);
    expect(guards).toHaveLength(4);
  });
});
