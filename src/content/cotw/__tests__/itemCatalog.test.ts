import { describe, it, expect, afterAll } from 'vitest';
import {
  COTW_CATALOG_83,
  COTW_CATALOG_RECORD,
  COTW_ITEMS,
  COTW_WEAPONS,
  COTW_OFFHAND,
  COTW_HEAD,
  COTW_TORSO,
  COTW_CLOAKS,
  COTW_HANDS,
  COTW_FEET,
  COTW_BELTS,
  COTW_NECK,
  COTW_RINGS,
  COTW_CONTAINERS,
  COTW_CONSUMABLES,
} from '../items';
import { GameEngine, GameMap, TILES, Player, Item } from '../../../engine';
import { WaitAction } from '../../../engine/actions/wait';
import {
  GIANT_BLOOD_STATUS,
  giantBloodHandler,
  GIANT_BLOOD_BOOTSTRAP_HOOK,
} from '../giantBlood';
import { StatusHandlerRegistry } from '../../../engine/status/statusHandlers';

describe('CotW 83-Item Catalog Spec', () => {
  it('contains exactly 83 items in COTW_CATALOG_83', () => {
    expect(COTW_CATALOG_83).toHaveLength(83);
  });

  it('has exact category counts according to spec', () => {
    expect(COTW_WEAPONS).toHaveLength(13);
    expect(COTW_OFFHAND).toHaveLength(6);
    expect(COTW_HEAD).toHaveLength(5);
    expect(COTW_TORSO).toHaveLength(6);
    expect(COTW_CLOAKS).toHaveLength(5);
    expect(COTW_HANDS).toHaveLength(5);
    expect(COTW_FEET).toHaveLength(5);
    expect(COTW_BELTS).toHaveLength(5);
    expect(COTW_NECK).toHaveLength(5);
    expect(COTW_RINGS).toHaveLength(7);
    expect(COTW_CONTAINERS).toHaveLength(5);
    expect(COTW_CONSUMABLES).toHaveLength(16);

    const sum =
      COTW_WEAPONS.length +
      COTW_OFFHAND.length +
      COTW_HEAD.length +
      COTW_TORSO.length +
      COTW_CLOAKS.length +
      COTW_HANDS.length +
      COTW_FEET.length +
      COTW_BELTS.length +
      COTW_NECK.length +
      COTW_RINGS.length +
      COTW_CONTAINERS.length +
      COTW_CONSUMABLES.length;
    expect(sum).toBe(83);
  });

  it('ensures every item has a unique ID', () => {
    const ids = COTW_CATALOG_83.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(83);
  });

  it('validates schema correctness of all 83 items', () => {
    for (const item of COTW_CATALOG_83) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.weight).toBeGreaterThan(0);
      expect(item.bulk).toBeGreaterThan(0);
      expect(item.value).toBeDefined();
      expect(item.description).toBeTruthy();
    }
  });

  it('marks corrupted items with cursed quality', () => {
    const corruptedIds = ['rot_porous_cleaver', 'nid_dripping_hauberk', 'marrow_gnawed_ring'];
    for (const id of corruptedIds) {
      const item = COTW_CATALOG_RECORD[id];
      expect(item).toBeDefined();
      expect(item.quality).toBe('cursed');
    }
  });

  it('preserves legacy items in COTW_ITEMS for backward compatibility', () => {
    const legacyIds = [
      'dagger',
      'shortsword',
      'leather_armor',
      'wooden_shield',
      'helmet',
      'boots',
      'health_potion',
      'mana_potion',
      'scroll_phase_door',
      'travel_bread',
      'backpack',
      'coin_purse',
      'utility_belt',
      'chest',
      'broadsword',
      'sun_stone_freyr',
      'hearth_tear_fragment',
    ];

    const catalogOrLegacyIds = new Set(COTW_ITEMS.map((i) => i.id));
    for (const id of legacyIds) {
      expect(catalogOrLegacyIds.has(id)).toBe(true);
    }
  });
});

describe('CotW Giant-Blood Item Interactions', () => {
  afterAll(() => {
    StatusHandlerRegistry.resetToDefaults();
  });

  function buildEngine(floor: number) {
    StatusHandlerRegistry.register(GIANT_BLOOD_STATUS, giantBloodHandler);
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 3, y: 3 },
      stats: { hp: 200, maxHp: 200, attack: 10, defense: 5 },
      level: 1,
    });
    const engine = new GameEngine({ map, player, floor });
    engine.actionPipeline.registerHook(GIANT_BLOOD_BOOTSTRAP_HOOK);
    return { engine, player };
  }

  it('suppresses giant-blood bonus when Sol-Shard Focus is equipped', () => {
    const { engine, player } = buildEngine(3);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    // Normal tick: +3 attack / +3 defense
    engine.handlePlayerAction(new WaitAction(player));
    expect(player.attack).toBe(baseAttack + 3);
    expect(player.defense).toBe(baseDefense + 3);

    // Equip Sol-Shard Focus
    const focusDef = COTW_CATALOG_RECORD['sol_shard_focus'];
    const focusItem = new Item({
      id: focusDef.id,
      definitionId: focusDef.id,
      name: focusDef.name,
      category: focusDef.category,
      slot: focusDef.slot,
      weight: focusDef.weight,
      bulk: focusDef.bulk,
      stats: focusDef.stats,
    });
    player.inventory.paperdoll.equip(focusItem, 'offHand');

    // Attribute recalculation immediately suppresses the giant-blood bonus (+3 is gone; item itself gives +2 attack, +3 defense)
    // baseAttack (10) + focusItem (2) = 12 (instead of 10 + 3 + 2 = 15)
    // baseDefense (5) + focusItem (3) = 8 (instead of 5 + 3 + 3 = 11)
    expect(player.attack).toBe(baseAttack + (focusDef.stats?.attackBonus ?? 0));
    expect(player.defense).toBe(baseDefense + (focusDef.stats?.defenseBonus ?? 0));

    // Next tick confirms suppressed state persists
    engine.handlePlayerAction(new WaitAction(player));
    expect(player.attack).toBe(baseAttack + (focusDef.stats?.attackBonus ?? 0));
    expect(player.defense).toBe(baseDefense + (focusDef.stats?.defenseBonus ?? 0));

    // Unequip Sol-Shard Focus restores giant-blood bonus
    player.inventory.paperdoll.unequip('offHand');
    engine.handlePlayerAction(new WaitAction(player));
    expect(player.attack).toBe(baseAttack + 3);
    expect(player.defense).toBe(baseDefense + 3);
  });

  it('extends giant-blood bonus one zone band deeper when Brim-Wolf Pelt Hood is equipped', () => {
    // Floor 26 normally removes Giant's Blood
    const { engine, player } = buildEngine(26);
    const baseAttack = player.attack;
    const baseDefense = player.defense;

    const hoodDef = COTW_CATALOG_RECORD['brim_wolf_pelt_hood'];
    const hoodItem = new Item({
      id: hoodDef.id,
      definitionId: hoodDef.id,
      name: hoodDef.name,
      category: hoodDef.category,
      slot: hoodDef.slot,
      weight: hoodDef.weight,
      bulk: hoodDef.bulk,
      stats: hoodDef.stats,
    });
    player.inventory.paperdoll.equip(hoodItem, 'head');

    // On floor 26, effective floor with hood is 26 - 8 = 18 (tier 3: +1 attack / +1 defense)
    engine.handlePlayerAction(new WaitAction(player));

    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(true);
    // baseAttack (10) + 1 (giant blood) = 11
    // baseDefense (5) + 2 (hood defense) + 1 (giant blood) = 8
    expect(player.attack).toBe(baseAttack + 1);
    expect(player.defense).toBe(baseDefense + (hoodDef.stats?.defenseBonus ?? 0) + 1);
  });

  it('removes giant-blood on floor 34 even when Brim-Wolf Pelt Hood is equipped', () => {
    const { engine, player } = buildEngine(34);
    const baseAttack = player.attack;

    const hoodDef = COTW_CATALOG_RECORD['brim_wolf_pelt_hood'];
    const hoodItem = new Item({
      id: hoodDef.id,
      definitionId: hoodDef.id,
      name: hoodDef.name,
      category: hoodDef.category,
      slot: hoodDef.slot,
      weight: hoodDef.weight,
      bulk: hoodDef.bulk,
      stats: hoodDef.stats,
    });
    player.inventory.paperdoll.equip(hoodItem, 'head');

    engine.handlePlayerAction(new WaitAction(player));
    expect(player.statusManager.hasStatus(GIANT_BLOOD_STATUS)).toBe(false);
    expect(player.attack).toBe(baseAttack);
  });
});
