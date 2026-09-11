import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '../entities/entity';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { createTestGoblin } from '../__fixtures__/testHelpers';

describe('Entity System - Stats, Damage, and Energy', () => {
  let hero: Player;
  let goblin: Monster;

  beforeEach(() => {
    hero = new Player({
      id: 'player',
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 },
      speed: 100,
    });

    goblin = createTestGoblin('goblin-1', { x: 5, y: 5 });
  });

  it('initializes with correct attributes and full health', () => {
    expect(hero.id).toBe('player');
    expect(hero.type).toBe('player');
    expect(hero.faction).toBe('player');
    expect(hero.hp).toBe(30);
    expect(hero.maxHp).toBe(30);
    expect(hero.isAlive()).toBe(true);
    expect(hero.speed).toBe(100);
    expect(hero.energy).toBe(0);
    expect(hero.canAct()).toBe(false);
  });

  it('correctly assesses hostility between factions', () => {
    expect(hero.isHostileTo(goblin)).toBe(true);
    expect(goblin.isHostileTo(hero)).toBe(true);

    const friendlyNpc = new Entity({
      id: 'npc',
      name: 'Elder',
      type: 'monster',
      faction: 'player',
      position: { x: 1, y: 1 },
      stats: { hp: 10, maxHp: 10, attack: 0, defense: 0 },
    });
    expect(hero.isHostileTo(friendlyNpc)).toBe(false);
  });

  it('handles damage calculation and death threshold', () => {
    const { damageDealt, killed } = goblin.takeDamage(6);
    expect(damageDealt).toBe(6);
    expect(goblin.hp).toBe(10);
    expect(killed).toBe(false);
    expect(goblin.isAlive()).toBe(true);

    // Overkill damage
    const lethal = goblin.takeDamage(20);
    expect(lethal.damageDealt).toBe(10);
    expect(goblin.hp).toBe(0);
    expect(lethal.killed).toBe(true);
    expect(goblin.isAlive()).toBe(false);
  });

  it('handles healing up to maxHp and prevents healing while dead', () => {
    hero.takeDamage(15);
    expect(hero.hp).toBe(15);

    const healed = hero.heal(10);
    expect(healed).toBe(10);
    expect(hero.hp).toBe(25);

    // Over-heal capped at maxHp
    const cappedHeal = hero.heal(20);
    expect(cappedHeal).toBe(5);
    expect(hero.hp).toBe(30);

    // Dead entity cannot heal
    hero.takeDamage(50);
    expect(hero.isAlive()).toBe(false);
    expect(hero.heal(10)).toBe(0);
    expect(hero.hp).toBe(0);
  });

  it('manages energy accumulation and consumption', () => {
    hero.gainEnergy(50);
    expect(hero.energy).toBe(50);
    expect(hero.canAct()).toBe(false);

    hero.gainEnergy(50);
    expect(hero.energy).toBe(100);
    expect(hero.canAct()).toBe(true);

    hero.consumeEnergy(100);
    expect(hero.energy).toBe(0);
    expect(hero.canAct()).toBe(false);
  });
});
