import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterRegistry, type MonsterDefinition } from '../../bestiary/monsterDefinitions';
import { populateDungeonFloor } from '../../dungeon/spawner';
import { PRNG } from '../../dungeon/prng';

const packDef = (overrides: Partial<MonsterDefinition> = {}): MonsterDefinition => ({
  id: 'test_packer',
  name: 'Packer',
  stats: { hp: 30, maxHp: 30, attack: 1, defense: 0 },
  speed: 100,
  aiType: 'melee',
  xpValue: 5,
  fleeHealthPercent: 0,
  lootTable: [],
  pack: { size: [2, 3] },
  ...overrides,
});

function packer(id: string, x: number, y: number, definitionId = 'test_packer'): Monster {
  return new Monster({
    id,
    name: 'Packer',
    position: { x, y },
    stats: { hp: 30, maxHp: 30, attack: 1, defense: 0 },
    definitionId,
    aiType: 'melee',
    aiState: 'hunting',
    xpValue: 1,
    lootTable: [],
  });
}

/** An open hall with the hero in the middle and one packmate already at the hero's east side. */
function hall(def: MonsterDefinition) {
  const map = new GameMap(24, 12, TILES.WALL);
  for (let y = 1; y < 11; y++) for (let x = 1; x < 23; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 10, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  MonsterRegistry.register(def);
  const first = packer('first', 11, 5, def.id);
  engine.addEntity(first);
  return { engine, player, first };
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('packs', () => {
  it('a pack monster closes on a free side of its prey, away from its packmates', () => {
    const { engine, player, first } = hall(packDef());
    const second = packer('second', 15, 5);
    engine.addEntity(second);

    for (let t = 0; t < 12 && chebyshev(second, player) > 1; t++) second.takeTurn(engine);

    expect(chebyshev(second, player)).toBe(1);
    expect(chebyshev(second, first)).toBeGreaterThan(1);
  });

  it('a monster that hunts alone takes the nearest side', () => {
    const { engine, player, first } = hall(packDef({ id: 'test_loner', pack: undefined }));
    const second = packer('second', 15, 5, 'test_loner');
    engine.addEntity(second);

    for (let t = 0; t < 12 && chebyshev(second, player) > 1; t++) second.takeTurn(engine);

    expect(chebyshev(second, player)).toBe(1);
    expect(chebyshev(second, first)).toBe(1);
  });

  it('a room drawn a pack monster holds the pack', () => {
    const map = new GameMap(60, 12, TILES.WALL);
    const rooms = [0, 1, 2, 3].map((i) => ({ x1: 1 + i * 14, y1: 1, x2: 12 + i * 14, y2: 10 }));
    for (const r of rooms) for (let y = r.y1; y <= r.y2; y++) for (let x = r.x1; x <= r.x2; x++) map.setTile(x, y, TILES.FLOOR);
    const rng = new PRNG(7);

    populateDungeonFloor(map, rooms, 5, [packDef()], () => rng.next());

    for (const r of rooms.slice(1)) {
      const inRoom = map.getAllEntities().filter((e) => e.x >= r.x1 && e.x <= r.x2);
      expect(inRoom.length).toBeGreaterThanOrEqual(2);
      expect(inRoom.length).toBeLessThanOrEqual(3);
    }
  });
});
