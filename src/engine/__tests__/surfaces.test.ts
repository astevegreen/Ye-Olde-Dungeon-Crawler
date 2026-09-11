import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { TILES } from '../grid/tile';

describe('Emergent Surface & Gas Simulation Layer', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let monster: Monster;

  beforeEach(() => {
    map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 3, y: 3 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    monster = new Monster({
      id: 'test-goblin',
      name: 'Goblin',
      position: { x: 6, y: 3 },
      stats: { hp: 30, maxHp: 30, attack: 4, defense: 1 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
    });
    map.addEntity(player);
    map.addEntity(monster);
    engine = new GameEngine({ map, player });
  });

  it('ignites oil slick with fire into a blazing fire storm', () => {
    engine.surfaces.setSurface(5, 5, 'oil_slick', 5);
    expect(engine.surfaces.getSurface(5, 5)).toBe('oil_slick');

    const result = engine.surfaces.triggerElementalReaction(5, 5, 'fire', engine);
    expect(result.occurred).toBe(true);
    expect(result.reactionName).toBe('Ignition');
    expect(engine.surfaces.getGas(5, 5)).toBe('fire_storm');
    expect(engine.messages.some((m) => m.includes('FireStorm inferno'))).toBe(true);
  });

  it('vaporizes water with fire into dense steam that blocks LOS', () => {
    engine.surfaces.setSurface(5, 5, 'water', 5);

    const result = engine.surfaces.triggerElementalReaction(5, 5, 'fire', engine);
    expect(result.occurred).toBe(true);
    expect(result.reactionName).toBe('Vaporization');
    expect(engine.surfaces.getGas(5, 5)).toBe('dense_steam');
    expect(map.isTransparent(5, 5)).toBe(false); // Steam blocks line of sight!
  });

  it('conducts lightning through water, electrocuting all entities standing in pool', () => {
    engine.surfaces.setSurface(6, 3, 'water', 5); // Monster at (6,3)
    const initialHp = monster.hp;

    const result = engine.surfaces.triggerElementalReaction(6, 3, 'lightning', engine);
    expect(result.occurred).toBe(true);
    expect(result.reactionName).toBe('Electrocution');
    expect(monster.hp).toBeLessThan(initialHp);
    expect(engine.messages.some((m) => m.includes('shocked for'))).toBe(true);
  });

  it('freezes water into an ice sheet when struck by cold/frost', () => {
    engine.surfaces.setSurface(4, 4, 'water', 5);

    const result = engine.surfaces.triggerElementalReaction(4, 4, 'cold', engine);
    expect(result.occurred).toBe(true);
    expect(result.reactionName).toBe('Freezing');
    expect(engine.surfaces.getSurface(4, 4)).toBe('ice_sheet');
  });

  it('causes entity to slide 2 tiles forward when stepping onto an ice sheet', () => {
    // Player at (3,3). Move East to (4,3).
    // Ice sheet at (4,3). Should slide across (5,3) to (6,3) if clear.
    engine.surfaces.setSurface(4, 3, 'ice_sheet', 5);
    // Remove monster so path is unobstructed
    map.removeEntity(monster);

    const move = new MovementAction(player, 1, 0);
    move.perform(engine);

    expect(player.x).toBe(6); // 4 + 2 slide = 6!
    expect(player.y).toBe(3);
    expect(engine.messages.some((m) => m.includes('slips on the slick ice sheet'))).toBe(true);
  });

  it('inflicts corrosive damage when stepping into an acid pool', () => {
    engine.surfaces.setSurface(4, 3, 'acid_pool', 5);
    const hpBefore = player.hp;

    const move = new MovementAction(player, 1, 0);
    move.perform(engine);

    expect(player.x).toBe(4);
    expect(player.hp).toBeLessThan(hpBefore);
    expect(engine.messages.some((m) => m.includes('caustic acid'))).toBe(true);
  });

  it('decays surfaces and gasses on discrete tick and cleans up expired cells', () => {
    engine.surfaces.setSurface(2, 2, 'oil_slick', 2);
    engine.surfaces.setGas(2, 2, 'poison_cloud', 1);

    expect(engine.surfaces.getCell(2, 2)?.surface?.duration).toBe(2);
    expect(engine.surfaces.getCell(2, 2)?.gas?.duration).toBe(1);

    // Tick 1
    engine.surfaces.tick(engine);
    expect(engine.surfaces.getCell(2, 2)?.surface?.duration).toBe(1);
    expect(engine.surfaces.getGas(2, 2)).toBeUndefined(); // Expired!

    // Tick 2
    engine.surfaces.tick(engine);
    expect(engine.surfaces.getSurface(2, 2)).toBeUndefined(); // Expired!
  });
});
