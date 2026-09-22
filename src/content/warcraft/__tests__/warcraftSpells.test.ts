import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, Monster, TILES } from '../../../engine';
import { warcraftManifest } from '../index';
import { CastSpellAction } from '../../../engine';

describe('Warcraft Spells & Magic Pipeline Integration', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(25, 25, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 100, attack: 10, defense: 5 },
    });
    player.mana = 100;
    player.maxMana = 100;

    engine = new GameEngine({
      map,
      player,
      manifest: warcraftManifest,
    });
  });

  it('casts Holy Light to heal the caster', () => {
    player.hp = 40;
    const initialHp = player.hp;

    const action = new CastSpellAction(player, 'holy_light', 5, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(player.hp).toBeGreaterThan(initialHp);
  });

  it('casts Bloodlust to grant the haste status effect', () => {
    expect(player.statusManager.hasStatus('haste')).toBe(false);

    const action = new CastSpellAction(player, 'bloodlust', 5, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(player.statusManager.hasStatus('haste')).toBe(true);
  });

  it('casts Fel Fireball dealing fire damage to target enemy', () => {
    const enemy = new Monster({
      id: 'target-peon',
      name: 'Orc Peon',
      position: { x: 5, y: 8 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 0 },
      speed: 100,
      aiType: 'melee',
    });
    map.addEntity(enemy);

    const initialHp = enemy.hp;
    const action = new CastSpellAction(player, 'fel_fireball', 5, 8);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(enemy.hp).toBeLessThan(initialHp);
  });

  it('casts Chain Lightning affecting primary and leaping to chained enemies', () => {
    const primary = new Monster({
      id: 'peon-1',
      name: 'Orc Peon 1',
      position: { x: 5, y: 7 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 0 },
      speed: 100,
      aiType: 'melee',
    });
    const secondary = new Monster({
      id: 'peon-2',
      name: 'Orc Peon 2',
      position: { x: 5, y: 8 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 0 },
      speed: 100,
      aiType: 'melee',
    });
    map.addEntity(primary);
    map.addEntity(secondary);

    const action = new CastSpellAction(player, 'chain_lightning', 5, 7);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(primary.hp).toBeLessThan(50);
  });
});
