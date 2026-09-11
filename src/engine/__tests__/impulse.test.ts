import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { applyImpulse } from '../combat/impulse';
import { TILES } from '../grid/tile';

describe('Positional Impulse Physics & Wall Splats', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let target: Monster;

  beforeEach(() => {
    map = new GameMap(10, 10);
    map.fill(TILES.FLOOR);
    // Fill perimeter with walls
    for (let x = 0; x < 10; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, 9, TILES.WALL);
    }
    for (let y = 0; y < 10; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(9, y, TILES.WALL);
    }

    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      strength: 16,
    });

    target = new Monster({
      id: 'target-orc',
      name: 'Orc Warrior',
      position: { x: 6, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
      speed: 100,
      definitionId: 'orc',
      aiType: 'melee',
    });

    map.addEntity(player);
    map.addEntity(target);
    engine = new GameEngine({ map, player });
  });

  it('pushes entity across clear floor tiles without collision', () => {
    // Shove from (5,5) towards (6,5) with distance 2: should end at (8,5)
    const result = applyImpulse(engine, player, target, 1, 0, 2);

    expect(result.pushed).toBe(true);
    expect(result.distanceTraveled).toBe(2);
    expect(result.wallSplat).toBe(false);
    expect(target.x).toBe(8);
    expect(target.y).toBe(5);
  });

  it('triggers Wall Splat with kinetic damage and 1-turn stunned when colliding into wall', () => {
    // Target is at (6,5). Wall is at (9,5).
    // Shove distance 4: moves 6->7->8 (2 tiles), then collides with wall at 9!
    // Remaining distance = 2. Strength = 16 (halfStr = 8).
    // Kinetic damage = 2 * 4 + 8 = 16!
    const hpBefore = target.hp;
    const result = applyImpulse(engine, player, target, 1, 0, 4);

    expect(result.pushed).toBe(true);
    expect(result.wallSplat).toBe(true);
    expect(result.distanceTraveled).toBe(2);
    expect(target.x).toBe(8); // Stopped right in front of wall
    expect(result.impactDamageDealt).toBe(16);
    expect(target.hp).toBe(hpBefore - 16);
    expect(target.statusManager.hasStatus('stunned')).toBe(true);
    expect(target.canMove()).toBe(false);
    expect(engine.messages.some((m) => m.includes('slams violently into'))).toBe(true);
  });

  it('eliminates victim instantly upon falling into a chasm', () => {
    // Place chasm at (7,5)
    map.setTile(7, 5, TILES.CHASM);

    const result = applyImpulse(engine, player, target, 1, 0, 2);

    expect(result.fellInChasm).toBe(true);
    expect(target.isAlive()).toBe(false);
    expect(engine.messages.some((m) => m.includes('plunges into the bottomless abyss'))).toBe(true);
    expect(map.getEntityAt(7, 5)).toBeNull();
  });

  it('triggers trap when shoved onto a trap tile', () => {
    // Place trap at (7,5)
    map.setTile(7, 5, TILES.TRAP);

    const hpBefore = target.hp;
    const result = applyImpulse(engine, player, target, 1, 0, 1);

    expect(result.triggeredTrap).toBeDefined();
    expect(target.x).toBe(7);
    expect(target.y).toBe(5);
    expect(target.hp).toBeLessThan(hpBefore);
    expect(engine.messages.some((m) => m.includes('triggers a hidden trap'))).toBe(true);
  });

  it('stops early and damages victim when colliding into another entity', () => {
    const obstacleMonster = new Monster({
      id: 'blocker',
      name: 'Giant Rat',
      position: { x: 7, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 2, defense: 0 },
      speed: 100,
      definitionId: 'giant_rat',
      aiType: 'melee',
    });
    map.addEntity(obstacleMonster);

    const result = applyImpulse(engine, player, target, 1, 0, 3);

    expect(result.wallSplat).toBe(true);
    expect(target.x).toBe(6); // Blocked from entering 7
    expect(result.distanceTraveled).toBe(0);
    expect(result.impactDamageDealt).toBeGreaterThan(0);
    expect(target.statusManager.hasStatus('stunned')).toBe(true);
  });
});
