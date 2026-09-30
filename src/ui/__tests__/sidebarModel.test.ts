import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Monster, Item } from '../../engine';
import {
  formatGroundStatus,
  getConditions,
  getExploredPercent,
  getGroundPiles,
  getNearbyThreats,
  isAmbientDuration,
} from '../sidebar/sidebarModel';

function buildEngine(manifest?: unknown) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player, manifest: manifest as any });
  engine.fov.update(engine.map, player.x, player.y, 8);
  return engine;
}

function monster(id: string, name: string, x: number, y: number, hp = 10) {
  return new Monster({ id, name, position: { x, y }, stats: { hp, maxHp: 20, attack: 1, defense: 0 } });
}

describe('getNearbyThreats', () => {
  it('lists visible hostiles nearest first, with distance, direction and HP', () => {
    const engine = buildEngine();
    engine.map.addEntity(monster('far', 'Ogre', 14, 7));
    engine.map.addEntity(monster('near', 'Wolf', 11, 10, 5));
    engine.fov.update(engine.map, 10, 10, 8);

    const threats = getNearbyThreats(engine);
    expect(threats.map((t) => [t.id, t.distance, t.direction])).toEqual([
      ['near', 1, 'E'],
      ['far', 4, 'NE'],
    ]);
    expect(threats[0]).toMatchObject({ hp: 5, maxHp: 20 });
  });

  it('carries a wind-up so the row can warn about it', () => {
    const engine = buildEngine();
    const ogre = monster('ogre', 'Ogre', 12, 10);
    ogre.intent = { type: 'windup', abilityName: 'Crushing Blow', turnsRemaining: 1 } as any;
    engine.map.addEntity(ogre);
    engine.fov.update(engine.map, 10, 10, 8);

    expect(getNearbyThreats(engine)[0].windup).toEqual({ ability: 'Crushing Blow', turnsRemaining: 1 });
  });
});

describe('getConditions', () => {
  it('names manifest statuses with their color and turns left', () => {
    const engine = buildEngine({
      id: 'test_pack',
      name: 'Test',
      statusEffects: [{ id: 'test:glow', name: 'Glow', hudColor: '#123456', damagePerTick: 2 }],
    });
    engine.player.statusManager.applyStatus({ type: 'test:glow', duration: 10 });

    expect(getConditions(engine)).toContainEqual({
      key: 'status:test:glow',
      label: 'Glow',
      color: '#123456',
      turns: 10,
      detail: '−2 HP each turn',
    });
  });

  it('shows an ambient status (a decremented 9999 sentinel) as ongoing, not a countdown', () => {
    const engine = buildEngine({ id: 'test_pack', name: 'Test', statusEffects: [{ id: 'test:glow', name: 'Glow' }] });
    engine.player.statusManager.applyStatus({ type: 'test:glow', duration: 9998 });

    expect(isAmbientDuration(9998)).toBe(true);
    expect(getConditions(engine).find((c) => c.label === 'Glow')?.turns).toBeNull();
  });

  it('is empty for an unhurried, unencumbered hero', () => {
    expect(getConditions(buildEngine())).toEqual([]);
  });
});

describe('getGroundPiles', () => {
  it('lists visible piles, the one underfoot first', () => {
    const engine = buildEngine();
    engine.map.addItemAt(13, 10, new Item({ id: 'gem', name: 'Ruby', category: 'misc', weight: 1, bulk: 1, value: 10 }));
    engine.map.addItemAt(10, 10, new Item({ id: 'rope', name: 'Rope', category: 'misc', weight: 1, bulk: 1, value: 1 }));
    engine.map.addItemAt(10, 10, new Item({ id: 'nail', name: 'Nail', category: 'misc', weight: 1, bulk: 1, value: 1 }));

    const piles = getGroundPiles(engine);
    expect(piles.map((p) => [p.label, p.more, p.distance, p.direction])).toEqual([
      ['Rope', 1, 0, ''],
      ['Ruby', 0, 3, 'E'],
    ]);
  });
});

describe('getExploredPercent', () => {
  it('counts walkable tiles the hero has seen', () => {
    const engine = buildEngine();
    const pct = getExploredPercent(engine);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});

describe('formatGroundStatus', () => {
  it('reports an unknown-void status outside map bounds', () => {
    expect(formatGroundStatus(buildEngine(), -1, -1).standingText).toBe('Standing on: Unknown Void');
  });

  it('says nothing about plain floor, and names stairs only through the prompt', () => {
    const engine = buildEngine();
    expect(formatGroundStatus(engine, 5, 5).standingText).toBe('');
    engine.map.setTile(6, 6, TILES.STAIRS_DOWN);
    const stairs = formatGroundStatus(engine, 6, 6);
    expect(stairs.standingText).toBe('');
    expect(stairs.promptText).toContain('Stairs Down');
  });

  it('names unusual terrain', () => {
    const engine = buildEngine();
    engine.map.setTile(5, 5, TILES.WALL);
    expect(formatGroundStatus(engine, 5, 5).standingText).toBe('Standing on: Carved Stone Wall');
  });
});
