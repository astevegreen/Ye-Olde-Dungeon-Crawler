import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { MeleeAttackAction } from '../actions/combat';

describe('Combat System - Bump Attack and Damage Resolution', () => {
  let map: GameMap;
  let player: Player;
  let goblin: Monster;
  let engine: GameEngine;

  beforeEach(() => {
    map = GameMap.createBoxRoom(10, 10);
    player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 4, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 7, defense: 2 },
      speed: 100,
    });
    player.gainEnergy(100);

    goblin = new Monster({
      id: 'goblin-1',
      name: 'Goblin',
      position: { x: 5, y: 5 }, // Directly East of player
      stats: { hp: 12, maxHp: 12, attack: 4, defense: 2 },
      speed: 100,
    });

    engine = new GameEngine({ map, player });
    engine.addEntity(goblin);
  });

  it('resolves a melee bump-attack when walking into an opposing entity', () => {
    // Player attempts to walk East into Goblin's tile
    const moveAction = new MovementAction(player, 1, 0);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(100);

    // Positions must NOT change (player does not occupy goblin tile)
    expect(player.x).toBe(4);
    expect(player.y).toBe(5);
    expect(goblin.x).toBe(5);
    expect(goblin.y).toBe(5);

    // Damage = max(1, player.attack - goblin.defense) = 7 - 2 = 5
    expect(goblin.hp).toBe(7);
    expect(goblin.isAlive()).toBe(true);
    expect(result.message).toContain('Hero attacks Goblin for 5 damage');
  });

  it('eliminates opposing entity when lethal damage is dealt', () => {
    // Set goblin HP lower than net damage (5)
    goblin.hp = 4;

    const moveAction = new MovementAction(player, 1, 0);
    const result = moveAction.perform(engine);

    expect(result.success).toBe(true);
    expect(goblin.hp).toBe(0);
    expect(goblin.isAlive()).toBe(false);

    // Goblin must be removed from the map
    expect(map.getEntityAt(5, 5)).toBeNull();
    expect(result.message).toContain('Goblin is slain!');

    // Player should now be able to step into (5, 5) on the next move
    player.gainEnergy(100);
    const stepIn = new MovementAction(player, 1, 0);
    const stepResult = stepIn.perform(engine);
    expect(stepResult.success).toBe(true);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });

  it('guarantees a minimum of 1 damage on high defense target', () => {
    // Armored monster with defense exceeding player's attack
    const armoredGolem = new Monster({
      id: 'golem-1',
      name: 'Iron Golem',
      position: { x: 3, y: 5 }, // Directly West of player
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 99 },
    });
    engine.addEntity(armoredGolem);

    const attackAction = new MeleeAttackAction(player, armoredGolem);
    const result = attackAction.perform(engine);

    expect(result.success).toBe(true);
    // 7 attack vs 99 defense => clamped to 1
    expect(armoredGolem.hp).toBe(49);
    expect(result.message).toContain('for 1 damage');
  });

  it('prevents bump attack on friendly entities and blocks movement without consuming energy', () => {
    const friendlyDog = new Player({
      id: 'companion-1',
      name: 'Hound',
      position: { x: 4, y: 4 }, // Directly North of player
      stats: { hp: 15, maxHp: 15, attack: 3, defense: 1 },
    });
    engine.addEntity(friendlyDog);

    player.energy = 100;
    const moveNorth = new MovementAction(player, 0, -1);
    const result = moveNorth.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(friendlyDog.hp).toBe(15);
    expect(player.x).toBe(4);
    expect(player.y).toBe(5);
    expect(player.energy).toBe(100); // Energy preserved
    expect(result.message).toContain('cannot move onto friendly Hound');
  });
});
