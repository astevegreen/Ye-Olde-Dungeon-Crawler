import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { AutoRestManager } from '../../actions/autoRest';

describe('Rest: status ticking and interruption', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = GameMap.createBoxRoom(20, 20);
    player = new Player({
      id: 'rest_hero',
      name: 'Ragnar',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 50, attack: 10, defense: 5 },
      mana: 15,
      maxMana: 30,
    });
    engine = new GameEngine({ map, player, floor: 1 });
  });

  it('rejects resting when player already has 100% HP and Mana', () => {
    player.hp = 50;
    player.mana = 30;

    const result = AutoRestManager.executeFullRest(engine);

    expect(result.interrupted).toBe(true);
    expect(result.reason).toContain('already fully rested');
  });

  it('rejects resting when a hostile monster is visible in line of sight', () => {
    const goblin = new Monster({
      id: 'goblin_watch',
      name: 'Goblin Scout',
      position: { x: 7, y: 5 }, // 2 tiles East in direct line of sight
      stats: { hp: 10, maxHp: 10, attack: 4, defense: 1 },
    });
    engine.addEntity(goblin);
    engine.updateFov();

    const result = AutoRestManager.executeFullRest(engine);

    expect(result.interrupted).toBe(true);
    expect(result.reason).toContain('Cannot rest now');
    expect(result.reason).toContain('Goblin Scout');
  });

  it('ticks status effects on each rest step and interrupts rest immediately upon taking damage', () => {
    // Afflict player with poison (deals 5 damage per tick, duration 3 ticks)
    player.statusManager.applyStatus({ type: 'poison', duration: 3, potency: 5 });
    expect(player.statusManager.hasStatus('poison')).toBe(true);

    const initialHp = player.hp; // 30
    const result = AutoRestManager.executeFullRest(engine, 50);

    expect(result.interrupted).toBe(true);
    expect(result.turn).toBe(1);
    // Natural heal (+1) - poison damage (-5) = net -4 damage
    expect(player.hp).toBe(initialHp - 4);
    expect(result.reason).toBe('Rest interrupted! You took 5 damage!');
  });

  it('successfully rests to full health when free of afflictions and hostiles', () => {
    expect(player.hp).toBe(30);
    expect(player.mana).toBe(15);

    const result = AutoRestManager.executeFullRest(engine, 100);

    expect(result.interrupted).toBe(false);
    expect(player.hp).toBe(50);
    expect(player.mana).toBe(30);
    expect(engine.messages.some((m) => m.includes('Fully rested'))).toBe(true);
  });
});
