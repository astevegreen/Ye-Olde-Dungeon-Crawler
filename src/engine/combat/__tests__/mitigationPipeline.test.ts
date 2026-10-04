import { describe, it, expect } from 'vitest';
import { calculateAspectModifier, resolveCombatMitigation } from '../mitigationPipeline';
import { Item } from '../../items/item';
import { Actor } from '../../entities/actor';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';

describe('Mitigation Pipeline & Aspect Alignment', () => {
  it('leaves gear as it was: nothing wears out', () => {
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 5, y: 5 } });
    const sword = new Item({ id: 'sword', name: 'Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, stats: { attackBonus: 5 } });
    player.inventory.paperdoll.equip(sword, 'mainHand');
    const foe = new Actor({ id: 'foe', name: 'Foe', type: 'monster', faction: 'hostile', position: { x: 6, y: 5 }, stats: { hp: 30, maxHp: 30, attack: 4, defense: 0 } });
    const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: new Player({ id: 'seed-holder', name: 'Seed', position: { x: 1, y: 1 } }), seed: 7 });
    for (let i = 0; i < 50; i++) resolveCombatMitigation(player, foe, 10, engine);
    expect(sword.effectiveStats.attackBonus).toBe(5);
  });

  it('calculates aspect alignment bonuses for radiant vs corrupt/undead', () => {
    // Radiant vs Corrupt
    const radiantVsCorrupt = calculateAspectModifier('aspect_radiant', 'aspect_corrupt');
    expect(radiantVsCorrupt.multiplier).toBe(1.5);
    expect(radiantVsCorrupt.flatBonus).toBe(3);

    // Radiant vs Undead faction tag
    const radiantVsUndead = calculateAspectModifier('aspect_radiant', undefined, ['undead']);
    expect(radiantVsUndead.multiplier).toBe(1.5);
    expect(radiantVsUndead.flatBonus).toBe(3);

    // Corrupt vs Radiant
    const corruptVsRadiant = calculateAspectModifier('aspect_corrupt', 'aspect_radiant');
    expect(corruptVsRadiant.multiplier).toBe(1.5);
    expect(corruptVsRadiant.flatBonus).toBe(2);

    // Neutral vs Neutral
    const neutral = calculateAspectModifier('neutral', 'neutral');
    expect(neutral.multiplier).toBe(1.0);
    expect(neutral.flatBonus).toBe(0);
  });

  it('resolves full combat mitigation in combat engagement', () => {
    const player = new Player({
      id: 'p1',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
    });

    const radiantBlade = new Item({
      id: 'radiant-blade',
      name: 'Radiant Sunblade',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 600,
      aspectState: 'aspect_radiant',
      stats: { attackBonus: 4 },
    });
    player.inventory.paperdoll.equip(radiantBlade, 'mainHand');

    const corruptZombie = new Actor({
      id: 'zombie-1',
      name: 'Decaying Zombie',
      type: 'monster',
      faction: 'hostile',
      position: { x: 6, y: 5 },
      stats: { hp: 25, maxHp: 25, attack: 4, defense: 0 },
    });
    corruptZombie.aspectState = 'aspect_corrupt';

    const engine = new GameEngine({
      map: new GameMap(12, 12, TILES.FLOOR),
      player: new Player({ id: 'seed-holder', name: 'Seed', position: { x: 1, y: 1 } }),
      seed: 7,
    });
    const result = resolveCombatMitigation(player, corruptZombie, 10, engine);
    // 10 base * 1.5 + 3 = 18 damage
    expect(result.finalDamage).toBe(18);
  });
});
