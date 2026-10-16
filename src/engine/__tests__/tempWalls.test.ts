import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { TILES } from '../grid/tile';
import { findPath } from '../ai/pathfinding';
import { stepAlongDistanceField } from '../ai/distanceField';
import { traceProjectile } from '../magic/targeting';
import { serializeMapObject, deserializeMapObject } from '../storage/serializer';
import { MovementAction } from '../actions/movement';
import { CastSpellAction } from '../actions/spell-actions';
import { useTestSpells } from '../__fixtures__/testHelpers';

// The P-35 spike (plan risk 7): a timed wall across a corridor, checked for paths, sight,
// shots, an occupant, its turns, its HP and a save.
describe('temporary walls', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  const WALL = { x: 5, y: 2 };
  const spec = { hp: 20, turns: 3, rubble: { kind: 'mud', turns: 6 } };

  /** A corridor along y = 2 from x = 1 to 10, walled on every side. */
  beforeEach(() => {
    map = new GameMap(12, 5);
    for (let x = 1; x <= 10; x++) map.setTile(x, 2, TILES.FLOOR);
    player = new Player({ position: { x: 1, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 } });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
  });

  const monster = (id: string, x: number, y: number) => {
    const m = new Monster({ id, name: id, position: { x, y }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 0 } });
    map.addEntity(m);
    return m;
  };

  it('blocks paths, sight and shots, and gives the floor back when its turns run out', () => {
    expect(findPath(map, { x: 1, y: 2 }, { x: 9, y: 2 }).length).toBeGreaterThan(0);
    expect(map.tempWalls.raise(map, WALL.x, WALL.y, spec)).toBe(true);

    expect(findPath(map, { x: 1, y: 2 }, { x: 9, y: 2 })).toEqual([]);
    expect(map.isTransparent(WALL.x, WALL.y)).toBe(false);
    const shot = traceProjectile(map, 1, 2, 9, 2, 12);
    expect(shot.hitWall).toBe(true);
    expect(shot.path.every((s) => s.x < WALL.x)).toBe(true);

    for (let i = 0; i < spec.turns; i++) engine.surfaces.tick(engine);
    expect(map.tempWalls.has(WALL.x, WALL.y)).toBe(false);
    expect(map.getTile(WALL.x, WALL.y)).toBe(TILES.FLOOR);
    expect(engine.surfaces.getSurface(WALL.x, WALL.y)).toBe('mud');
    expect(findPath(map, { x: 1, y: 2 }, { x: 9, y: 2 }).length).toBeGreaterThan(0);
  });

  it('a far monster stops walking into a wall raised later in the same turn', () => {
    const goal = { x: 1, y: 2 };
    expect(stepAlongDistanceField(map, { x: 9, y: 2 }, goal, 7)).toEqual({ x: 8, y: 2 });
    map.tempWalls.raise(map, 8, 2, spec);
    expect(stepAlongDistanceField(map, { x: 9, y: 2 }, goal, 7)).toBeNull();
  });

  it('falls when its HP is spent', () => {
    map.tempWalls.raise(map, WALL.x, WALL.y, spec);
    expect(map.tempWalls.damage(engine, WALL.x, WALL.y, 12)).toBe(true);
    expect(map.tempWalls.hpAt(WALL.x, WALL.y)).toBe(8);
    map.tempWalls.damage(engine, WALL.x, WALL.y, 8);
    expect(map.tempWalls.has(WALL.x, WALL.y)).toBe(false);
    expect(map.getTile(WALL.x, WALL.y)).toBe(TILES.FLOOR);
    expect(map.tempWalls.damage(engine, WALL.x, WALL.y, 5)).toBe(false);
  });

  it('shoves a creature standing there aside, and is refused when it has nowhere to go', () => {
    const wolf = monster('wolf', WALL.x, WALL.y);
    expect(map.tempWalls.raise(map, WALL.x, WALL.y, spec)).toBe(true);
    expect(wolf.y).toBe(2);
    expect([4, 6]).toContain(wolf.x);

    const boxed = monster('boxed', 8, 2);
    monster('left', 7, 2);
    monster('right', 9, 2);
    expect(map.tempWalls.raise(map, 8, 2, spec)).toBe(false);
    expect(boxed.x).toBe(8);
    expect(map.getTile(8, 2)).toBe(TILES.FLOOR);
  });

  it('rises only on walkable floor', () => {
    expect(map.tempWalls.raise(map, 5, 1, spec)).toBe(false);
    map.tempWalls.raise(map, WALL.x, WALL.y, spec);
    expect(map.tempWalls.raise(map, WALL.x, WALL.y, spec)).toBe(false);
  });

  it('survives a save with its HP and turns, and still falls to floor', () => {
    map.tempWalls.raise(map, WALL.x, WALL.y, spec);
    map.tempWalls.damage(engine, WALL.x, WALL.y, 5);
    engine.surfaces.tick(engine);

    const saved = JSON.parse(JSON.stringify(serializeMapObject(map)));
    const back = deserializeMapObject(saved);
    expect(back.getTile(WALL.x, WALL.y)).toBe(TILES.WALL);
    expect(back.tempWalls.hpAt(WALL.x, WALL.y)).toBe(15);
    expect(saved.tempWalls).toEqual([{ x: WALL.x, y: WALL.y, hp: 15, maxHp: 20, turns: 2, rubble: spec.rubble }]);

    // A map save holds no hero; the game file adds one beside it.
    const hero = new Player({ position: { x: 1, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 } });
    back.addEntity(hero);
    const backEngine = new GameEngine({ map: back, player: hero });
    backEngine.surfaces.tick(backEngine);
    backEngine.surfaces.tick(backEngine);
    expect(back.getTile(WALL.x, WALL.y)?.type).toBe('floor');
  });

  it('writes nothing to a save with no walls', () => {
    expect(serializeMapObject(map).tempWalls).toBeUndefined();
  });
});

// P-35 6a-2: blows and spells reach a temporary wall.
describe('striking a temporary wall', () => {
  useTestSpells([
    { id: 'bolt', name: 'Bolt', school: 'Combat', manaCost: 1, element: 'fire', range: 9, basePower: 6, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 6, element: 'fire' }] },
    { id: 'cairn', name: 'Cairn', school: 'Combat', manaCost: 1, element: 'physical', range: 9, basePower: 0, areaOfEffect: 1, shape: 'wall', reflects: false, targetType: 'tile', targetingMode: 'tile', description: '', effects: [{ type: 'raise_wall', hp: 30, turns: 15, name: 'cairn', rubble: { kind: 'mud', turns: 10 } }] },
    { id: 'blast', name: 'Blast', school: 'Combat', manaCost: 1, element: 'fire', range: 9, basePower: 4, areaOfEffect: 1, reflects: false, targetType: 'ray', targetingMode: 'area_burst', description: '', effects: [{ type: 'damage', amount: 4, element: 'fire' }] },
  ]);

  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(12, 5);
    for (let x = 1; x <= 10; x++) map.setTile(x, 2, TILES.FLOOR);
    player = new Player({
      position: { x: 4, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 7, defense: 2 },
      mana: 50,
      maxMana: 50,
      spellsKnown: ['bolt', 'blast', 'cairn'],
    });
    map.addEntity(player);
    engine = new GameEngine({ map, player, seed: 3 });
    map.tempWalls.raise(map, 5, 2, { hp: 20, turns: 15, name: 'cairn' });
  });

  it('a bump is a blow: a turn spent and the attack in damage', () => {
    const result = new MovementAction(player, 1, 0).perform(engine);
    expect(result.cost).toBeGreaterThan(0);
    expect(map.tempWalls.hpAt(5, 2)).toBe(13);
    expect(player.x).toBe(4);
    expect(engine.messages.at(-1)).toBe('The cairn takes 7 damage (13/20).');
  });

  it('a ray that strikes it deals its roll, and enough blows fell it', () => {
    new CastSpellAction(player, 'bolt', 9, 2).perform(engine);
    expect(map.tempWalls.hpAt(5, 2)).toBe(14);
    new MovementAction(player, 1, 0).perform(engine);
    new MovementAction(player, 1, 0).perform(engine);
    expect(map.tempWalls.has(5, 2)).toBe(false);
    expect(engine.messages).toContain('The cairn crumbles!');
  });

  it('a burst at it hits it once', () => {
    map.moveEntity(player, 2, 2);
    new CastSpellAction(player, 'blast', 9, 2).perform(engine);
    expect(map.tempWalls.hpAt(5, 2)).toBe(16);
  });

  it('a plain wall is still bumped, not struck', () => {
    const result = new MovementAction(player, 0, 1).perform(engine);
    expect(result.cost).toBe(0);
  });

  it('a raise_wall spell stands a wall across the aim, on walkable tiles only', () => {
    for (let y = 1; y <= 3; y++) map.setTile(8, y, TILES.FLOOR);
    map.setTile(8, 3, TILES.WALL);
    new CastSpellAction(player, 'cairn', 8, 2).perform(engine);
    expect(map.tempWalls.has(8, 1)).toBe(true);
    expect(map.tempWalls.has(8, 2)).toBe(true);
    expect(map.tempWalls.has(8, 3)).toBe(false);
    expect(map.tempWalls.hpAt(8, 2)).toBe(30);
  });
});
