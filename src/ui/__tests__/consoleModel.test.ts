import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster, Item, NPC } from '../../engine';
import { getObjectiveLine, getTrayChips, getCompanionCard, resolveContextAction } from '../console/consoleModel';

function buildEngine(manifest?: unknown) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player, manifest: manifest as any });
  engine.fov.update(engine.map, player.x, player.y, 8);
  return engine;
}

const item = (id: string, name: string) => new Item({ id, name, category: 'misc', weight: 1, bulk: 1, value: 1 });

describe('resolveContextAction', () => {
  it('attacks the weakest adjacent monster before anything else', () => {
    const engine = buildEngine();
    engine.map.addItemAt(10, 10, item('gem', 'Ruby'));
    engine.map.addEntity(new Monster({ id: 'a', name: 'Ogre', position: { x: 11, y: 10 }, stats: { hp: 30, maxHp: 30, attack: 1, defense: 0 } }));
    engine.map.addEntity(new Monster({ id: 'b', name: 'Rat', position: { x: 10, y: 9 }, stats: { hp: 3, maxHp: 5, attack: 1, defense: 0 } }));
    engine.fov.update(engine.map, 10, 10, 8);

    expect(resolveContextAction(engine)).toMatchObject({ kind: 'attack', target: 'Rat', dx: 0, dy: -1 });
  });

  it('picks up one item, or takes all of several', () => {
    const engine = buildEngine();
    engine.map.addItemAt(10, 10, item('gem', 'Ruby'));
    expect(resolveContextAction(engine)).toMatchObject({ kind: 'pickup', target: 'Ruby' });
    engine.map.addItemAt(10, 10, item('rope', 'Rope'));
    expect(resolveContextAction(engine)).toMatchObject({ kind: 'take_all', target: '2 items' });
  });

  it('offers the stairs underfoot', () => {
    const engine = buildEngine();
    engine.map.setTile(10, 10, TILES.STAIRS_DOWN);
    expect(resolveContextAction(engine).kind).toBe('descend');
  });

  it('talks to an adjacent townsperson, then opens an adjacent door', () => {
    const engine = buildEngine();
    engine.map.setTile(9, 10, TILES.DOOR_CLOSED);
    expect(resolveContextAction(engine)).toMatchObject({ kind: 'open_door', dx: -1, dy: 0 });
    engine.map.addEntity(new NPC({ id: 'smith', name: 'Smith', position: { x: 11, y: 11 } } as any));
    expect(resolveContextAction(engine)).toMatchObject({ kind: 'talk', target: 'Smith', dx: 1, dy: 1 });
  });

  it('rests when hurt with nothing in sight, and otherwise has nothing to do', () => {
    const engine = buildEngine();
    expect(resolveContextAction(engine).kind).toBe('none');
    engine.player.hp = 4;
    expect(resolveContextAction(engine).kind).toBe('rest');
    engine.map.addEntity(new Monster({ id: 'far', name: 'Wolf', position: { x: 14, y: 10 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } }));
    engine.fov.update(engine.map, 10, 10, 8);
    expect(resolveContextAction(engine).kind).toBe('none');
  });
});

describe('getTrayChips', () => {
  it('is empty when nothing situational applies', () => {
    expect(getTrayChips(buildEngine(), 'the smith')).toEqual([]);
  });

  it('shows overflow debt, named and colored by the pack', () => {
    const engine = buildEngine({
      id: 'test_pack',
      name: 'Test',
      magic: { overflow: { debtName: 'Void Debt', tiers: [{ minDebt: 1, label: 'Tier 1', color: '#123456', burstRadius: 0, burstDurationMs: 0, outcomes: [] }] } },
    });
    engine.player.voidDebt = 7;
    expect(getTrayChips(engine, 'the smith')).toContainEqual(expect.objectContaining({ id: 'debt', label: 'Void Debt', value: '7', color: '#123456' }));
  });
});

describe('getCompanionCard', () => {
  it('is undefined without a companion', () => {
    expect(getCompanionCard(buildEngine())).toBeUndefined();
  });
});

describe('getObjectiveLine', () => {
  it('shows the current objective with a bearing to the nearest known stairs down', () => {
    const engine = buildEngine({ id: 'test_pack', name: 'Test', objectives: [{ id: 'go', text: 'Go down.' }] });
    engine.map.setTile(13, 7, TILES.STAIRS_DOWN);
    engine.fov.update(engine.map, 10, 10, 8);
    expect(getObjectiveLine(engine)).toEqual({ text: 'Go down.', stairs: 'stairs down 3 NE' });
  });

  it('is undefined for a pack with no objectives', () => {
    expect(getObjectiveLine(buildEngine())).toBeUndefined();
  });
});
