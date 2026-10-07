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

  it('R-rend-2 · offers to disarm a trap the hero has found beside them, and not one still hidden', () => {
    const engine = buildEngine();
    // The model reads only where a trap is and what the hero knows of it.
    const trap = { id: 't', type: 'pit', x: 11, y: 10, revealed: false, disarmed: false };
    engine.map.addTrap(trap as never);
    expect(resolveContextAction(engine).kind).not.toBe('disarm');
    trap.revealed = true;
    expect(resolveContextAction(engine)).toMatchObject({ kind: 'disarm', verb: 'Disarm', x: 11, y: 10 });
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

  it('names the keys the player has bound, not the default letters (R-ui-16)', () => {
    const keys: Record<string, string> = { rest: 'N', pickup: ';', quick_loot: '⇧L', stairs: 'Y', disarm_trap: '⇧X', close_door: 'K' };
    const keyFor = (actionId: string) => keys[actionId];
    const engine = buildEngine();
    engine.map.setTile(9, 10, TILES.DOOR_OPEN);
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'close_door', nativeKey: 'K' });
    engine.player.hp = 4;
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'rest', nativeKey: 'N' });
    // Unbound: no key named at all, rather than a stale one.
    expect(resolveContextAction(engine).nativeKey).toBeUndefined();
    engine.map.addTrap({ id: 't', type: 'pit', x: 11, y: 10, revealed: true, disarmed: false } as never);
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'disarm', nativeKey: '⇧X' });
    engine.map.setTile(10, 10, TILES.STAIRS_DOWN);
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'descend', nativeKey: 'Y' });
    // '>' climbs whatever is bound.
    expect(resolveContextAction(engine).nativeKey).toBe('>');
    engine.map.addItemAt(10, 10, item('gem', 'Ruby'));
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'pickup', nativeKey: ';' });
    engine.map.addItemAt(10, 10, item('rope', 'Rope'));
    expect(resolveContextAction(engine, keyFor)).toMatchObject({ kind: 'take_all', nativeKey: '⇧L' });
  });

  it('neither attacks nor rests short of a neutral beside the hero (R-ui-15)', () => {
    const engine = buildEngine();
    engine.map.setTile(10, 10, TILES.STAIRS_DOWN);
    engine.map.addEntity(new Monster({ id: 'calm', name: 'Haugbui', position: { x: 11, y: 10 }, faction: 'neutral', stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } }));
    engine.fov.update(engine.map, 10, 10, 8);
    expect(resolveContextAction(engine).kind).toBe('descend');
    engine.map.setTile(10, 10, TILES.FLOOR);
    engine.player.hp = 4;
    expect(resolveContextAction(engine).kind).toBe('rest');
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

  it("names the Recall chip's channel key as the player bound it, or none (R-ui-16)", () => {
    const engine = buildEngine();
    engine.player.hasDiscoveredRune = true;
    const recall = (keyFor?: (actionId: string) => string | undefined) =>
      getTrayChips(engine, 'the smith', keyFor).find((c) => c.id === 'rune')?.title ?? '';
    expect(recall((id) => (id === 'channel_rune_of_return' ? 'Y' : undefined))).toContain('Click or press Y to channel a recall.');
    expect(recall()).toContain('Click to channel a recall.');
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
    expect(getObjectiveLine(engine)).toEqual({ text: 'Go down.', bearing: 'stairs down 3 NE' });
  });

  it('points at the nearest entity the objective names, while one is on the floor', () => {
    const engine = buildEngine({
      id: 'test_pack',
      name: 'Test',
      objectives: [{ id: 'free', text: 'Free them.', pointTo: { entityIds: ['far', 'near'], label: 'held villager' } }],
    });
    engine.map.setTile(13, 7, TILES.STAIRS_DOWN);
    engine.fov.update(engine.map, 10, 10, 8);
    const near = new NPC({ id: 'near', name: 'Near', role: 'villager', position: { x: 6, y: 12 } });
    engine.addEntity(new NPC({ id: 'far', name: 'Far', role: 'villager', position: { x: 2, y: 2 } }));
    engine.addEntity(near);
    expect(getObjectiveLine(engine)?.bearing).toBe('held villager 4 SW');

    engine.removeEntity(near);
    engine.removeEntity(engine.map.getEntityById('far')!);
    expect(getObjectiveLine(engine)?.bearing).toBe('stairs down 3 NE');
  });

  it('is undefined for a pack with no objectives', () => {
    expect(getObjectiveLine(buildEngine())).toBeUndefined();
  });
});
