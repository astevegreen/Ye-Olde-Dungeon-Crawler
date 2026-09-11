import { describe, it, expect } from 'vitest';
import { Paperdoll, type EquipmentSlotDefinition } from '../inventory/paperdoll';
import { Item } from '../items/item';
import { InventoryManager } from '../inventory/inventory-manager';
import { serializeGame, deserializeGame } from '../storage/serializer';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { TILES } from '../grid/tile';
import type { GameContentManifest } from '../types/manifest';

describe('Configurable Equipment Slot Topology & Two-Handed Weapons', () => {
  it('supports custom slot definitions such as shoulders and trinket', () => {
    const customSlots: EquipmentSlotDefinition[] = [
      { id: 'head', name: 'Helmet', acceptedCategories: ['helmet'] },
      { id: 'shoulders', name: 'Shoulders', acceptedCategories: ['armor'] },
      { id: 'torso', name: 'Chestplate', acceptedCategories: ['armor'] },
      { id: 'trinket', name: 'Trinket', acceptedCategories: ['misc', 'quest'] },
      { id: 'mainHand', name: 'Weapon', acceptedCategories: ['weapon'] },
      { id: 'offHand', name: 'Shield / Offhand', acceptedCategories: ['shield', 'weapon'] },
    ];

    const doll = new Paperdoll(customSlots);
    expect(doll.getSlotDefinitions()).toHaveLength(6);
    expect(doll.getSlotDefinition('shoulders')?.name).toBe('Shoulders');

    const pauldrons = new Item({
      id: 'pauldron-1',
      name: 'Iron Pauldrons',
      category: 'armor',
      slot: 'shoulders',
      weight: 1500,
      bulk: 2000,
      stats: { defenseBonus: 4 },
    });

    const talisman = new Item({
      id: 'tal-1',
      name: 'Lucky Troll Tooth',
      category: 'misc',
      slot: 'trinket',
      weight: 100,
      bulk: 50,
      stats: { attackBonus: 2 },
    });

    // Successfully equip into custom slots
    expect(doll.equip(pauldrons).success).toBe(true);
    expect(doll.equip(talisman).success).toBe(true);

    expect(doll.getItem('shoulders')?.id).toBe('pauldron-1');
    expect(doll.getItem('trinket')?.id).toBe('tal-1');

    const stats = doll.calculateStats();
    expect(stats.defenseBonus).toBe(4);
    expect(stats.attackBonus).toBe(2);
  });

  it('rejects items with invalid category for a custom slot', () => {
    const customSlots: EquipmentSlotDefinition[] = [
      { id: 'trinket', name: 'Trinket', acceptedCategories: ['misc'] },
    ];

    const doll = new Paperdoll(customSlots);
    const sword = new Item({
      id: 'sw-1',
      name: 'Iron Sword',
      category: 'weapon',
      slot: 'trinket',
      weight: 1000,
      bulk: 1000,
    });

    const result = doll.canEquip(sword, 'trinket');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('cannot be equipped');
  });

  it('correctly handles two-handed weapon slot blocking and displacement', () => {
    const doll = new Paperdoll();

    const shield = new Item({
      id: 'sh-1',
      name: 'Kite Shield',
      category: 'shield',
      slot: 'offHand',
      weight: 2000,
      bulk: 2000,
      stats: { defenseBonus: 5 },
    });

    const greatsword = new Item({
      id: 'gs-1',
      name: 'Zweihander',
      category: 'weapon',
      slot: 'mainHand',
      weight: 4000,
      bulk: 5000,
      twoHanded: true,
      blocksSlot: 'offHand',
      stats: { attackBonus: 18 },
    });

    // 1. Equip shield first
    expect(doll.equip(shield).success).toBe(true);
    expect(doll.getItem('offHand')?.id).toBe('sh-1');
    expect(doll.isSlotBlocked('offHand')).toBe(false);

    // 2. Equip 2H weapon in mainHand: automatically unequips offHand shield
    const equipResult = doll.equip(greatsword);
    expect(equipResult.success).toBe(true);
    expect(doll.getItem('mainHand')?.id).toBe('gs-1');
    expect(doll.getItem('offHand')).toBeNull();
    expect(doll.isSlotBlocked('offHand')).toBe(true);
    expect(equipResult.unequippedItems?.some((it) => it.id === 'sh-1')).toBe(true);

    // 3. Attempting to equip shield into offHand while holding 2H weapon is rejected
    const blockedCheck = doll.canEquip(shield, 'offHand');
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.reason).toContain('blocked');

    // 4. Unequip 2H weapon: offHand is unblocked again
    doll.unequip('mainHand');
    expect(doll.isSlotBlocked('offHand')).toBe(false);
    expect(doll.canEquip(shield, 'offHand').allowed).toBe(true);
  });

  it('serializes and deserializes custom slots dynamically through savegame pipeline', () => {
    const customSlots: EquipmentSlotDefinition[] = [
      { id: 'head', name: 'Head', acceptedCategories: ['helmet'] },
      { id: 'shoulders', name: 'Shoulders', acceptedCategories: ['armor'] },
      { id: 'torso', name: 'Torso', acceptedCategories: ['armor'] },
      { id: 'mainHand', name: 'Main Hand', acceptedCategories: ['weapon'] },
      { id: 'offHand', name: 'Off Hand', acceptedCategories: ['shield'] },
      { id: 'pack', name: 'Pack', acceptedCategories: ['container'] },
      { id: 'purse', name: 'Purse', acceptedCategories: ['container'] },
    ];

    const customManifest: Partial<GameContentManifest> = {
      id: 'custom-rpg',
      name: 'Custom RPG',
      equipmentSlots: customSlots,
    };

    const inv = new InventoryManager({ slots: customSlots });
    const pauldrons = new Item({
      id: 'p-1',
      name: 'Spiked Pauldrons',
      category: 'armor',
      slot: 'shoulders',
      weight: 800,
      bulk: 800,
      stats: { defenseBonus: 3 },
    });
    inv.paperdoll.equip(pauldrons, 'shoulders');

    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'hero',
      name: 'Arthas',
      position: { x: 5, y: 5 },
      inventory: inv,
    });

    const engine = new GameEngine({
      map,
      player,
      manifest: customManifest as GameContentManifest,
    });

    // Serialize
    const saveData = serializeGame(engine, {
      id: 'profile-1',
      name: 'Arthas',
      difficulty: 'medium',
      level: 1,
      floor: 1,
      maxFloor: 5,
      lastSaved: Date.now(),
      hp: 100,
      maxHp: 100,
      strength: 15,
    });

    expect((saveData.player.inventory.paperdoll as any).shoulders).toBeDefined();
    expect((saveData.player.inventory.paperdoll as any).shoulders.id).toBe('p-1');

    // Deserialize with custom manifest
    const restored = deserializeGame(saveData, customManifest as GameContentManifest);
    expect(restored.engine.player.inventory.paperdoll.getItem('shoulders')?.name).toBe('Spiked Pauldrons');
    expect(restored.engine.player.inventory.paperdoll.getSlotDefinitions()).toHaveLength(7);
  });
});
