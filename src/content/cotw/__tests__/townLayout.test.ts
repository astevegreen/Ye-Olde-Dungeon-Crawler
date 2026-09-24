import { describe, it, expect } from 'vitest';
import { TownMapGenerator } from '../../../engine/town/townMap';
import { COTW_TOWN } from '../town';
import { COTW_TILES } from '../tiles';
import { TOWN_ROWS, TOWN_LEGEND, TOWN_BUILDINGS } from '../townLayout';

/** Bjarnarhaven's authored ground plan: everyone and everything can be walked to. */
describe('Bjarnarhaven layout', () => {
  const town = new TownMapGenerator(50, 30, COTW_TOWN, COTW_TILES).generate();
  const map = town.map;
  const reach = new Set<string>();
  const queue = [town.playerSpawn];
  reach.add(`${town.playerSpawn.x},${town.playerSpawn.y}`);
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      const t = map.inBounds(x, y) ? map.getTile(x, y) : undefined;
      if (!t || reach.has(`${x},${y}`) || !(t.passable || t.type === 'door_closed')) continue;
      reach.add(`${x},${y}`);
      queue.push({ x, y });
    }
  }

  it('uses every legend tile, resolved from the pack before any engine exists', () => {
    for (const type of Object.values(TOWN_LEGEND)) {
      let found = false;
      for (let y = 0; y < map.height && !found; y++) for (let x = 0; x < map.width; x++) if (map.getTile(x, y)?.type === type) found = true;
      expect(found, type).toBe(true);
    }
    expect(TOWN_ROWS.every((r) => r.length === TOWN_ROWS[0].length)).toBe(true);
  });

  it('puts every NPC on open ground, and every NPC, door and the cellar stairs within reach of the spawn', () => {
    for (const npc of town.npcs) {
      const neighbours = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => `${npc.x + dx},${npc.y + dy}`);
      expect(map.getTile(npc.x, npc.y)?.passable, npc.name).toBe(true);
      expect(neighbours.some((k) => reach.has(k)) || reach.has(`${npc.x},${npc.y}`), npc.name).toBe(true);
    }
    for (const b of TOWN_BUILDINGS) expect(reach.has(`${b.door.x},${b.door.y}`), b.name).toBe(true);
    expect(reach.has(`${town.stairsDown.x},${town.stairsDown.y}`)).toBe(true);
    expect(map.getTile(COTW_TOWN.stairsDown.x, COTW_TOWN.stairsDown.y + 1)?.passable).toBe(true);
  });

  it('keeps each shopkeeper inside their own building', () => {
    const inside = (id: string, building: string) => {
      const npc = town.npcs.find((n) => n.id === id)!;
      const b = TOWN_BUILDINGS.find((x) => x.name === building)!.bounds;
      return npc.x > b.x1 && npc.x < b.x2 && npc.y > b.y1 && npc.y < b.y2;
    };
    expect(inside('npc-olaf', "Olaf's General Store")).toBe(true);
    expect(inside('npc-gunther', "Gunther's Armory")).toBe(true);
    expect(inside('npc-astrid', "Astrid's Alchemy")).toBe(true);
    expect(inside('npc-priest', 'Temple of Thor')).toBe(true);
    expect(inside('npc-banker', 'Sage Study & Vault')).toBe(true);
  });
});
