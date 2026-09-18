import { describe, it, expect } from 'vitest';
import { CharacterRoller, MIN_ATTRIBUTE, MAX_ATTRIBUTE } from '../characterRoller';
import { Player } from '../../entities/player';
import { Mulberry32 } from '../../dungeon/prng';

describe('CharacterRoller & Attribute Engine', () => {
  it('rolls 3d6 within range 3 to 18', () => {
    const prng = new Mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const roll = CharacterRoller.roll3d6(() => prng.next());
      expect(roll).toBeGreaterThanOrEqual(3);
      expect(roll).toBeLessThanOrEqual(18);
    }
  });

  it('generates a heroic roll with 4 attributes and 5 available points', () => {
    const prng = new Mulberry32(100);
    const roll = CharacterRoller.generateRoll(() => prng.next());
    expect(roll.availablePoints).toBe(5);
    expect(roll.attributes.strength).toBeGreaterThanOrEqual(MIN_ATTRIBUTE);
    expect(roll.attributes.strength).toBeLessThanOrEqual(MAX_ATTRIBUTE);
    expect(roll.attributes.intelligence).toBeGreaterThanOrEqual(MIN_ATTRIBUTE);
    expect(roll.attributes.intelligence).toBeLessThanOrEqual(MAX_ATTRIBUTE);
    expect(roll.attributes.constitution).toBeGreaterThanOrEqual(MIN_ATTRIBUTE);
    expect(roll.attributes.constitution).toBeLessThanOrEqual(MAX_ATTRIBUTE);
    expect(roll.attributes.dexterity).toBeGreaterThanOrEqual(MIN_ATTRIBUTE);
    expect(roll.attributes.dexterity).toBeLessThanOrEqual(MAX_ATTRIBUTE);
  });

  it('calculates derived stats from character attributes', () => {
    const attrs = {
      strength: 16,
      intelligence: 14,
      constitution: 15,
      dexterity: 12,
    };

    const derived = CharacterRoller.calculateDerivedStats(attrs);
    // maxHp = floor(CON * 2 + 10) = 15 * 2 + 10 = 40
    expect(derived.maxHp).toBe(40);
    // maxMana = floor(INT * 2 + 5) = 14 * 2 + 5 = 33
    expect(derived.maxMana).toBe(33);
    // maxCarryWeight = floor(15000 + STR * 1000) = 15000 + 16000 = 31000g
    expect(derived.maxCarryWeight).toBe(31000);
    // baseAttack = floor(16 * 0.4 + 12 * 0.2) = floor(6.4 + 2.4) = 8
    expect(derived.baseAttack).toBe(8);
    // baseDefense = floor(12 * 0.25) = 3
    expect(derived.baseDefense).toBe(3);
    // speed = 100 + (12 - 10) * 2 = 104
    expect(derived.speed).toBe(104);
  });

  it('adjusts attributes cleanly and respects point and bound limits', () => {
    const attrs = {
      strength: 15,
      intelligence: 10,
      constitution: 10,
      dexterity: 10,
    };

    // 1. Increase Strength by 1
    const res1 = CharacterRoller.adjustAttribute(attrs, 'strength', 1, 3);
    expect(res1.success).toBe(true);
    expect(res1.attributes.strength).toBe(16);
    expect(res1.availablePoints).toBe(2);

    // 2. Increase capped at 18
    const maxAttrs = { ...attrs, strength: 18 };
    const resMax = CharacterRoller.adjustAttribute(maxAttrs, 'strength', 1, 2);
    expect(resMax.success).toBe(false);
    expect(resMax.attributes.strength).toBe(18);

    // 3. Fail increase when 0 points left
    const resNoPoints = CharacterRoller.adjustAttribute(attrs, 'intelligence', 1, 0);
    expect(resNoPoints.success).toBe(false);

    // 4. Decrease attribute refunding points
    const resDec = CharacterRoller.adjustAttribute(attrs, 'strength', -1, 1);
    expect(resDec.success).toBe(true);
    expect(resDec.attributes.strength).toBe(14);
    expect(resDec.availablePoints).toBe(2);

    // 5. Fail decrease when at MIN_ATTRIBUTE (8)
    const minAttrs = { ...attrs, dexterity: 8 };
    const resMin = CharacterRoller.adjustAttribute(minAttrs, 'dexterity', -1, 2);
    expect(resMin.success).toBe(false);
  });

  it('equips starting kit with Travel Bread, Dagger, Coin Purse, and Belt', () => {
    const player = new Player({
      id: 'test-hero-kit',
      name: 'Freya',
      position: { x: 5, y: 5 },
    });

    CharacterRoller.equipStartingKit(player, 'test-hero-kit', undefined, undefined, Math.random);

    // Equipped items
    const weapon = player.inventory.paperdoll.getItem('mainHand');
    expect(weapon?.name).toBe('Iron Dagger');

    const purse = player.inventory.paperdoll.getItem('purse');
    expect(purse?.name).toBe('Velvet Coin Purse');

    const belt = player.inventory.paperdoll.getItem('waist');
    expect(belt?.name).toBe('Leather Utility Belt');

    // Pack items
    const packItems = player.inventory.primaryPack.getItems();
    const hasBread = packItems.some((i) => i.name === 'Travel Bread');
    expect(hasBread).toBe(true);

    const hasHealthPot = packItems.some((i) => i.name === 'Minor Health Potion');
    expect(hasHealthPot).toBe(true);

    const hasManaPot = packItems.some((i) => i.name === 'Mana Draught');
    expect(hasManaPot).toBe(true);

    const hasTeleport = packItems.some((i) => i.name === 'Scroll of Phase Door');
    expect(hasTeleport).toBe(true);
  });
});
