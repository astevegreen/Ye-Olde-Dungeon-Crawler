import { describe, it, expect } from 'vitest';
import { COTW_ITEMS } from '../../../content/cotw/items';
import {
  calculateEnchantmentLevel,
  rollElementalAffix,
  createScaledItem,
  selectFloorItemDefinition,
} from '../../dungeon/lootSpawner';
import { Item } from '../item';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { MeleeAttackAction } from '../../actions/combat';
import { serializeItem, deserializeItem } from '../../storage/serializer';
import { Mulberry32 } from '../../dungeon/prng';

describe('Depth-Scaled Tiered Loot & Enchantments', () => {
  it('restricts Floor 1 item definitions strictly to Tier 1 items', () => {
    const prng = new Mulberry32(101);
    for (let i = 0; i < 50; i++) {
      const def = selectFloorItemDefinition(COTW_ITEMS, 1, () => prng.next());
      expect(def).toBeDefined();
      expect(def!.minFloor ?? 1).toBeLessThanOrEqual(1);
      expect(def!.tier ?? 1).toBe(1);
    }
  });

  it('allows Tier 3 and Tier 4 item generation on deep floors (e.g. Floor 45)', () => {
    const prng = new Mulberry32(202);
    const selectedTiers = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const def = selectFloorItemDefinition(COTW_ITEMS, 45, () => prng.next());
      if (def?.tier) {
        selectedTiers.add(def.tier);
      }
    }
    // High floors should generate high tiers
    expect(selectedTiers.has(3) || selectedTiers.has(4)).toBe(true);
  });

  it('calculates procedural enchantment bonuses scaled by depth (+0 to +5)', () => {
    const prng1 = new Mulberry32(303);
    // Floor 1: target 0, clamped [0, 1]
    const f1Levels = Array.from({ length: 30 }, () => calculateEnchantmentLevel(1, () => prng1.next()));
    expect(Math.max(...f1Levels)).toBeLessThanOrEqual(1);
    expect(Math.min(...f1Levels)).toBe(0);

    const prng2 = new Mulberry32(404);
    // Floor 45: target 4, clamped [3, 5]
    const f45Levels = Array.from({ length: 30 }, () => calculateEnchantmentLevel(45, () => prng2.next()));
    expect(Math.min(...f45Levels)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...f45Levels)).toBeLessThanOrEqual(5);
  });

  it('creates scaled weapons and armors with calculated stats and updated display names', () => {
    const daggerDef = COTW_ITEMS.find((it) => it.id === 'dagger')!;
    expect(daggerDef).toBeDefined();

    // Deterministic RNG that produces variance +1 (so for F20: target 2, variance +1 => 3)
    const mockRng = () => 0.8; // floor(0.8 * 3) - 1 = 1
    const scaledDagger = createScaledItem(daggerDef, 'test-dagger', 20, mockRng);

    expect(scaledDagger.enchantmentLevel).toBe(3);
    // Base attack is 3, + (3 * 2) = 9
    expect(scaledDagger.stats.attackBonus).toBe(9);
    expect(scaledDagger.displayName).toBe('Iron Dagger +3');

    // Shield test (+1 defense per level)
    const shieldDef = COTW_ITEMS.find((it) => it.id === 'wooden_shield')!;
    const scaledShield = createScaledItem(shieldDef, 'test-shield', 20, mockRng);
    expect(scaledShield.enchantmentLevel).toBe(3);
    // Base defense is 3, + (3 * 1) = 6
    expect(scaledShield.stats.defenseBonus).toBe(6);
    expect(scaledShield.displayName).toBe('Reinforced Wooden Shield +3');
  });

  it('rolls elemental affixes on weapons on Floors 30+ only', () => {
    // Floor 20: weapons never roll elemental affixes
    const f20Affix = rollElementalAffix(20, 'weapon', () => 0.05);
    expect(f20Affix).toBeUndefined();

    // Floor 35: non-weapons never roll elemental affixes
    const f35ArmorAffix = rollElementalAffix(35, 'armor', () => 0.05);
    expect(f35ArmorAffix).toBeUndefined();

    // Floor 35 weapon: when roll succeeds (< 0.20)
    let callCount = 0;
    const mockRng = () => {
      callCount++;
      return callCount === 1 ? 0.10 : 0.20; // 0.10 triggers affix (< 0.20), 0.20 selects fire
    };
    const affix = rollElementalAffix(35, 'weapon', mockRng);
    expect(affix).toBeDefined();
    expect(affix!.element).toBe('fire');
    expect(affix!.name).toBe('of Fire');
    expect(affix!.bonusDamage).toBe(5);
  });

  it('updates player attack and defense upon equipping enchanted gear', () => {
    const player = new Player({
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 1 },
      strength: 15,
    });

    expect(player.attack).toBe(5);
    expect(player.defense).toBe(1);

    const sword = new Item({
      id: 'sw-1',
      name: 'Steel Broadsword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 400,
      identified: true,
      enchantmentLevel: 3,
      stats: { attackBonus: 14 }, // 8 base + 6 enchant
    });

    const plate = new Item({
      id: 'pl-1',
      name: 'Plate Mail',
      category: 'armor',
      slot: 'torso',
      weight: 15000,
      bulk: 3000,
      identified: true,
      enchantmentLevel: 2,
      stats: { defenseBonus: 9 }, // 7 base + 2 enchant
    });

    player.inventory.paperdoll.equip(sword, 'mainHand');
    player.inventory.paperdoll.equip(plate, 'torso');

    // Player attack = base (5) + sword (14) = 19
    expect(player.attack).toBe(19);
    // Player defense = base (1) + plate (9) = 10
    expect(player.defense).toBe(10);
  });

  it('deals bonus elemental damage during melee combat with an elemental weapon', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 2, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      strength: 15,
    });
    const engine = new GameEngine({ map, player });

    const elementalSword = new Item({
      id: 'flame-blade',
      name: 'Steel Broadsword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 400,
      identified: true,
      enchantmentLevel: 2,
      elementalAffix: {
        element: 'fire',
        bonusDamage: 8,
        name: 'of Fire',
      },
      stats: { attackBonus: 12 },
    });
    player.inventory.paperdoll.equip(elementalSword, 'mainHand');

    const monster = new Monster({
      id: 'frost-troll',
      name: 'Frost Troll',
      position: { x: 3, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      speed: 100,
      resistances: { fire: 'weak' }, // Takes 1.5x elemental fire damage!
    });
    engine.addEntity(monster);

    const initialHp = monster.hp;
    const action = new MeleeAttackAction(player, monster);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    // Monster took physical damage AND fire damage (8 * 1.5 = 12 bonus fire damage)
    expect(monster.hp).toBeLessThan(initialHp - 12);
  });

  it('persists and deserializes enchantment level, elemental affix, and tier through storage serializer', () => {
    const enchantedWeapon = new Item({
      id: 'persisted-blade',
      name: 'Adamantine Greatsword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 3200,
      bulk: 900,
      tier: 4,
      minFloor: 37,
      enchantmentLevel: 4,
      elementalAffix: {
        element: 'lightning',
        bonusDamage: 6,
        name: 'of Lightning',
      },
      identified: true,
      stats: { attackBonus: 22 },
      description: 'A crackling blade of ancient ore.',
      value: 1200,
    });

    const serialized = serializeItem(enchantedWeapon);
    expect(serialized.enchantmentLevel).toBe(4);
    expect(serialized.elementalAffix).toEqual({
      element: 'lightning',
      bonusDamage: 6,
      name: 'of Lightning',
    });
    expect(serialized.tier).toBe(4);
    expect(serialized.minFloor).toBe(37);
    expect(serialized.stats.attackBonus).toBe(22);

    const deserialized = deserializeItem(serialized);
    expect(deserialized.enchantmentLevel).toBe(4);
    expect(deserialized.elementalAffix).toEqual({
      element: 'lightning',
      bonusDamage: 6,
      name: 'of Lightning',
    });
    expect(deserialized.tier).toBe(4);
    expect(deserialized.minFloor).toBe(37);
    expect(deserialized.stats.attackBonus).toBe(22);
    expect(deserialized.displayName).toBe('Adamantine Greatsword +4 of Lightning');
  });
});
