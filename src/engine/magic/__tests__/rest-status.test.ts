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

  // Playtest 2026-10-18: each poison tick stopped the rest after one turn. The hero now
  // rests the poison out; harm from anything else still stops the rest.
  it('ticks status effects on each rest step and rests through their damage', () => {
    // Poison deals 5 a tick for 3 ticks: 30 + 3 x (1 - 5) = 18, then a point a turn to 50.
    player.statusManager.applyStatus({ type: 'poison', duration: 3, potency: 5 });
    expect(player.statusManager.hasStatus('poison')).toBe(true);

    const result = AutoRestManager.executeFullRest(engine, 50);

    expect(result.interrupted).toBe(false);
    expect(player.statusManager.hasStatus('poison')).toBe(false);
    expect(player.hp).toBe(50);
    expect(engine.messages.some((m) => m.includes('Rest interrupted'))).toBe(false);
  });

  it('stops the rest when the hero is hurt by anything but a status tick', () => {
    player.statusManager.applyStatus({ type: 'poison', duration: 3, potency: 5 });
    engine.surfaces.setSurface(5, 5, 'fire', 5);

    const result = AutoRestManager.executeFullRest(engine, 50);

    expect(result.interrupted).toBe(true);
    expect(result.turn).toBe(1);
    expect(result.reason).toMatch(/^Rest interrupted! You took \d+ damage!$/);
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
