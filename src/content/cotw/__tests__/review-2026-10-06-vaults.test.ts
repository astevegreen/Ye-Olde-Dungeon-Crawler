import { describe, it, expect } from 'vitest';
import { VaultStamper } from '../../../engine/dungeon/vaultStamp';
import { COTW_VAULTS } from '../vaults';

/**
 * Whole-codebase review, 2026-10-06, area 4 (dungeon generation). R-ai-2: the Abyssal
 * Treasury (`chasm_treasury`) seals both chests behind chasm and bars — 238 of 238 such
 * chests were unreachable across 980 generated floors. This test walks the blueprint
 * itself (doors open, bars and chasm closed, no secrets) from every `@` connector and
 * asks that every `C` be reachable. Marked `it.fails` until the blueprint gets a route.
 */

function reachableChests(layout: readonly string[], legend?: Record<string, string>): { chests: number; reachable: number } {
  const h = layout.length;
  const w = layout[0].length;
  const walkable = (x: number, y: number) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    const ch = layout[y][x];
    if (ch === '+') return true; // a closed door opens
    return VaultStamper.parseSymbol(ch, legend).tile.walkable;
  };
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (layout[y][x] === '@') { queue.push([x, y]); seen.add(`${x},${y}`); }
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && walkable(nx, ny)) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  let chests = 0, reachable = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (layout[y][x] === 'C') { chests++; if (seen.has(`${x},${y}`)) reachable++; }
  return { chests, reachable };
}

describe('R-ai-2 · every chest in every cotw vault blueprint is reachable from a connector without crossing chasm or bars', () => {
  it('the Abyssal Treasury (chasm_treasury) has a route to its chests', () => {
    const vault = COTW_VAULTS.find((v) => v.id === 'chasm_treasury')!;
    const { chests, reachable } = reachableChests(vault.layout, (vault as { legend?: Record<string, string> }).legend);
    expect(chests).toBe(2); // (passes today)
    expect(reachable).toBe(chests);
  });

  it('every other vault with a chest has a route to all of them (guards the fix from regressing elsewhere)', () => {
    const sealed = COTW_VAULTS.filter((v) => v.id !== 'chasm_treasury')
      .map((v) => ({ id: v.id, ...reachableChests(v.layout, (v as { legend?: Record<string, string> }).legend) }))
      .filter((r) => r.chests > 0 && r.reachable < r.chests);
    expect(sealed).toEqual([]);
  });
});

describe('R-ai-4 · a secret door hides only its cache, never a stitched-on cave', () => {
  it('on floors 1-49 (4 seeds each), every cell reachable only through a secret door lies in that door’s cache', async () => {
    const { GameEngine } = await import('../../../engine/engine');
    const { GameMap } = await import('../../../engine/grid/map');
    const { Player } = await import('../../../engine/entities/player');
    const { DungeonArc } = await import('../../../engine/quest/dungeonArc');
    const { cotwManifest } = await import('../index');
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }), manifest: cotwManifest });
    const quest = { ...cotwManifest.quest!, floorGenerators: cotwManifest.quest?.floorGenerators ?? cotwManifest.floorGenerators, maxFloor: 50, bossFloor: 50 };
    type Map = InstanceType<typeof GameMap>;
    const reach = (map: Map, from: { x: number; y: number }, secrets: boolean) => {
      const W = map.width;
      const seen = new Uint8Array(W * map.height);
      const q = [from.y * W + from.x];
      seen[q[0]] = 1;
      for (let k = 0; k < q.length; k++) {
        const x = q[k] % W, y = (q[k] - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= map.height || seen[j]) continue;
          const t = map.getTile(nx, ny);
          if (!(t?.walkable || t?.type === 'door_closed' || (secrets && t?.type === 'secret_door'))) continue;
          seen[j] = 1;
          q.push(j);
        }
      }
      return seen;
    };
    const gated: string[] = [];
    for (let f = 1; f < 50; f++) {
      for (let s = 0; s < 4; s++) {
        const { map, playerSpawn } = DungeonArc.generateFloor(f, (f * 7919 + s * 104729) >>> 0, quest, cotwManifest, 1, 'medium', engine.registries);
        const shut = reach(map, playerSpawn, false), open = reach(map, playerSpawn, true);
        const doors: Array<[number, number]> = [];
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.getTile(x, y)?.type === 'secret_door') doors.push([x, y]);
        for (let i = 0; i < open.length; i++) {
          if (!open[i] || shut[i]) continue;
          const x = i % map.width, y = (i - x) / map.width;
          // A 3x3 cache sits 1-3 cells beyond its door.
          if (!doors.some(([dx, dy]) => Math.max(Math.abs(dx - x), Math.abs(dy - y)) <= 3)) gated.push(`f${f} s${s} (${x},${y})`);
        }
      }
    }
    expect(gated.slice(0, 5)).toEqual([]);
  });
});

describe('R-ai-6 · a story altar or runestone lands where the hero can walk to it', () => {
  it('every middle-of-room placement, 25 seeds each, is reachable without a secret door', async () => {
    const { GameEngine } = await import('../../../engine/engine');
    const { GameMap } = await import('../../../engine/grid/map');
    const { Player } = await import('../../../engine/entities/player');
    const { DungeonArc } = await import('../../../engine/quest/dungeonArc');
    const { SpawnSiteFilter } = await import('../../../engine/dungeon/spawnSites');
    const { cotwManifest } = await import('../index');
    const engine = new GameEngine({ map: new GameMap(10, 10), player: new Player({ id: 'p', name: 'P', position: { x: 1, y: 1 } }), manifest: cotwManifest });
    const quest = { ...cotwManifest.quest!, floorGenerators: cotwManifest.quest?.floorGenerators ?? cotwManifest.floorGenerators, maxFloor: 50, bossFloor: 50 };
    const stranded: string[] = [];
    for (const p of cotwManifest.fixedTilePlacements ?? []) {
      if (p.placement !== 'middle_room_center') continue;
      for (let s = 0; s < 25; s++) {
        const { map, playerSpawn } = DungeonArc.generateFloor(p.floor, (p.floor * 7919 + s * 104729) >>> 0, quest, cotwManifest, 1, 'medium', engine.registries);
        const walk = new SpawnSiteFilter(map, { anchor: playerSpawn, minDistance: 0 });
        let placed = false;
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            if (map.getTile(x, y)?.type !== p.tileId) continue;
            placed = true;
            if (!walk.reaches(x, y)) stranded.push(`${p.tileId} f${p.floor} s${s}`);
          }
        }
        if (!placed) stranded.push(`${p.tileId} f${p.floor} s${s} (missing)`);
      }
    }
    expect(stranded).toEqual([]);
  });
});
