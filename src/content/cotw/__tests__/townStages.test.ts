import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { NPC } from '../../../engine/entities/npc';
import { WaitAction } from '../../../engine/actions/wait';
import { TownMapGenerator } from '../../../engine/town/townMap';
import { incrementCounter, setFlag } from '../../../engine';
import { cotwManifest } from '../index';
import { COTW_TOWN } from '../town';
import { COTW_TILES } from '../tiles';
import { TOWN_BUILDINGS, TOWN_FURNISHINGS, TOWN_PLAYER_SPAWN, TOWN_STAIRS_DOWN } from '../townLayout';
import { CARTER_POSITION, TOWN_PATCHES } from '../townStages';
import { HERALD_GATHERING, RETURNED_CAPTIVE_POSITIONS } from '../homecoming';
import { COTW_DEEPEST_FLOOR_COUNTER } from '../spellTablets';
import { HEARTH_TEAR_RETURNED_FLAG } from '../relic';

const tileOf = (type: string) => COTW_TILES.find((t) => t.type === type)!;

function town() {
  const built = new TownMapGenerator(50, 30, COTW_TOWN, COTW_TILES).generate();
  const player = new Player({ id: 'hero', name: 'Sven', position: { ...TOWN_PLAYER_SPAWN } });
  const engine = new GameEngine({ map: built.map, player, floor: 0, manifest: cotwManifest });
  const ws = engine.worldState;
  const logs = engine.messages;
  const turn = () => engine.handlePlayerAction(new WaitAction(player));
  const at = (x: number, y: number) => built.map.getTile(x, y)?.type;
  return { engine, map: built.map, npcs: built.npcs, ws, turn, at, logs };
}

/** Every open cell reachable from the spawn, doors counted as open. */
function reachable(map: GameMap): Set<string> {
  const reach = new Set<string>([`${TOWN_PLAYER_SPAWN.x},${TOWN_PLAYER_SPAWN.y}`]);
  const queue = [TOWN_PLAYER_SPAWN];
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
  return reach;
}

describe('Bjarnarhaven through Act 2', () => {
  it('every tile a stage lays is a cotw tile with art', () => {
    const recipes = cotwManifest.spriteRecipes ?? {};
    for (const patch of TOWN_PATCHES) {
      for (const cell of patch.cells) {
        expect(tileOf(cell.type), cell.type).toBeDefined();
        const art = recipes[`${cell.type}~prop`] ?? recipes[`${cell.type}~q0`];
        expect(typeof art, cell.type).toBe('function');
      }
    }
  });

  it('with every change laid, each way the choices go, everyone and everything is still in reach', () => {
    const exclusive = [
      ['herald-heeded', 'oath-broken'],
      ['herald-defied', 'oath-honored'],
    ];
    for (const leaveOut of exclusive) {
      const { map, npcs } = town();
      const before = reachable(map);
      for (const patch of TOWN_PATCHES) {
        if (leaveOut.includes(patch.id)) continue;
        for (const c of patch.cells) map.setTile(c.x, c.y, tileOf(c.type));
      }
      const after = reachable(map);
      const blocked = new Set(TOWN_PATCHES.flatMap((p) => p.cells).filter((c) => !tileOf(c.type).passable).map((c) => `${c.x},${c.y}`));
      // Nothing is walled off but the props' own cells.
      for (const k of before) if (!blocked.has(k)) expect(after.has(k), `${k} cut off by ${leaveOut.join('/')}`).toBe(true);

      const people = [
        ...npcs.map((n) => ({ x: n.x, y: n.y, name: n.name })),
        ...RETURNED_CAPTIVE_POSITIONS.map((p, i) => ({ ...p, name: `captive ${i + 1}` })),
        ...Object.entries(HERALD_GATHERING).map(([name, p]) => ({ ...p, name })),
        { ...CARTER_POSITION, name: 'carter' },
      ];
      for (const p of people) {
        expect(map.getTile(p.x, p.y)?.passable, p.name).toBe(true);
        expect(after.has(`${p.x},${p.y}`), p.name).toBe(true);
      }
      for (const b of TOWN_BUILDINGS) expect(after.has(`${b.door.x},${b.door.y}`), b.name).toBe(true);
      expect(after.has(`${TOWN_STAIRS_DOWN.x},${TOWN_STAIRS_DOWN.y}`)).toBe(true);
      for (const f of TOWN_FURNISHINGS) expect(blocked.has(`${f.x},${f.y}`), f.glyph).toBe(false);
    }
  });

  it('changes stage by stage: the thaw, the roots, the herald', () => {
    const { ws, turn, at, map, logs } = town();
    turn();
    expect(at(28, 18)).toBe('town_fountain');
    expect(map.getEntityById('npc-ketil')).toBeNull();

    setFlag(ws, HEARTH_TEAR_RETURNED_FLAG, true);
    turn();
    expect([at(28, 18), at(29, 18), at(28, 19), at(29, 19)]).toEqual(Array(4).fill('town_fountain_thawed'));
    expect(at(35, 19)).toBe('town_stall_open');
    const ketil = map.getEntityById('npc-ketil') as NPC;
    expect(ketil).toMatchObject(CARTER_POSITION);
    expect(ketil.spriteKey).toBe('npc-ketil');
    expect(logs.filter((l) => l.includes('come over the pass'))).toHaveLength(1);
    turn();
    expect(logs.filter((l) => l.includes('come over the pass'))).toHaveLength(1);

    incrementCounter(ws, COTW_DEEPEST_FLOOR_COUNTER, 34);
    turn();
    expect(at(28, 18)).toBe('town_fountain_sapped');
    expect(at(36, 13)).toBe('town_toppled_cart');
    expect(at(27, 20)).toBe('town_world_roots');
    expect(at(27, 25)).toBe('town_black_sap');
    expect((map.getEntityById('npc-ketil') as NPC).greeting).toContain('hay cart');

    setFlag(ws, 'vidnir_warning_defied', true);
    setFlag(ws, 'vidnir_slain', true);
    turn();
    expect(map.getEntityById('npc-ketil')).toBeNull();
    expect(logs.some((l) => l.includes('gone back over the pass'))).toBe(true);
    expect(at(35, 19)).toBe('town_market_stall');
    expect(at(37, 18)).toBe('town_laden_cart');
    expect(at(23, 15)).toBe('town_weapon_rack');
    // The roots stay: the herald adds to the town, it does not mend it.
    expect(at(28, 18)).toBe('town_fountain_sapped');
  });

  it('a hero who stays away comes home to every change at once, and never meets the carter', () => {
    const { ws, turn, at, map, logs } = town();
    setFlag(ws, HEARTH_TEAR_RETURNED_FLAG, true);
    incrementCounter(ws, COTW_DEEPEST_FLOOR_COUNTER, 45);
    setFlag(ws, 'vidnir_slain', true);
    setFlag(ws, 'vidnir_warning_heeded', true);
    setFlag(ws, 'captive_villager_2_sacrificed', true);
    setFlag(ws, 'oath_honored', true);
    turn();
    expect(at(28, 18)).toBe('town_fountain_sapped');
    expect(at(35, 19)).toBe('town_market_stall');
    expect(at(23, 21)).toBe('town_ward_stone');
    expect(at(21, 28)).toBe('town_memorial_stone');
    expect(at(21, 27)).not.toBe('town_memorial_stone');
    expect(at(29, 13)).toBe('town_thrym_shrine');
    expect(map.getEntityById('npc-ketil')).toBeNull();
    expect(logs.some((l) => l.includes('over the pass'))).toBe(false);
  });

  it('the roots without the thaw leave the fountain frozen, and the oath broken lights a brazier', () => {
    const { ws, turn, at } = town();
    incrementCounter(ws, COTW_DEEPEST_FLOOR_COUNTER, 36);
    setFlag(ws, 'oath_broken', true);
    turn();
    expect(at(28, 18)).toBe('town_fountain');
    expect(at(36, 13)).toBe('town_toppled_cart');
    expect(at(29, 13)).toBe('town_sol_brazier');
  });

  it('a cell with someone or something on it waits for the next turn', () => {
    const { ws, turn, at, map } = town();
    map.addEntity(new NPC({ id: 'npc-in-the-way', name: 'Loiterer', position: { x: 36, y: 20 }, role: 'villager' }));
    setFlag(ws, HEARTH_TEAR_RETURNED_FLAG, true);
    turn();
    expect(at(36, 20)).not.toBe('town_barrels');
    expect(at(35, 19)).toBe('town_stall_open');
    map.removeEntity(map.getEntityById('npc-in-the-way')!);
    turn();
    expect(at(36, 20)).toBe('town_barrels');
  });

  it('leaves the dungeon alone', () => {
    const map = new GameMap(56, 36, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Sven', position: { x: 10, y: 10 } });
    const engine = new GameEngine({ map, player, floor: 3, manifest: cotwManifest });
    setFlag(engine.worldState, HEARTH_TEAR_RETURNED_FLAG, true);
    engine.handlePlayerAction(new WaitAction(player));
    expect(map.getTile(28, 18)?.type).toBe('floor');
    expect(map.getEntityById('npc-ketil')).toBeNull();
  });
});
