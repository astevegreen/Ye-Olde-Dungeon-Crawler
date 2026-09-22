import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, TILES, Player, NPC, getItemBuyPrice } from '../../../engine';
import { ItemFactory } from '../../../engine';
import {
  rescueCaptiveVillager,
  resolveHostageRitual,
  HOSTAGE_VILLAGERS,
} from '../hostageRitual';
import { COTW_MANIFEST } from '../index';
import { createGuntherArmory } from '../town';

describe('Hostage Ritual Encounter: 5-Tier Moral Spectrum & Economy Impact', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 8, defense: 3 },
    });
    map.addEntity(player);

    engine = new GameEngine({
      map,
      player,
      floor: 22,
      manifest: COTW_MANIFEST,
      worldState: {
        flags: {},
        counters: {},
        factions: {
          townsfolk: 0,
        },
      },
    });
  });

  it('Tier 1: Rescuing all 4 captives grants +30 standing, 25% shop discount, and unlocks 0 dark spells', () => {
    for (const v of HOSTAGE_VILLAGERS) {
      const captive = new NPC({
        id: v.id,
        name: v.name,
        role: 'villager',
        position: { x: 6, y: 6 },
      });
      map.addEntity(captive);
      rescueCaptiveVillager(engine, captive);
    }

    expect(engine.getWorldCounter('hostages_rescued')).toBe(4);
    expect(engine.getWorldCounter('hostages_sacrificed')).toBe(0);
    expect(engine.getWorldFlag('siphon_ritual_resolved')).toBe(true);
    expect(engine.getWorldFlag('savior_of_jarnvidr')).toBe(true);
    expect(engine.getFactionStanding('townsfolk')).toBe(30);
    expect(engine.getFactionStanding('temple_standing')).toBe(15);

    // No blood magic spells unlocked
    expect(player.hasBloodMagicUnlocked()).toBe(false);
    expect(player.spellsKnown.includes('blood_reap')).toBe(false);

    // Test shop pricing: 25% discount
    const testSword = ItemFactory.createBroadsword('broadsword-1');
    const baseBuyPrice = getItemBuyPrice(testSword); // 15000 CP
    const discountedPrice = getItemBuyPrice(testSword, engine.worldState);
    expect(discountedPrice).toBe(Math.floor(baseBuyPrice * 0.75));

    // Test shop stock predicate: heroic item is available!
    const gunther = createGuntherArmory();
    const stock = gunther.getAvailableStock(engine.worldState);
    const heroArmor = stock.find((item) => item.id === 'gunther-hero-armor');
    expect(heroArmor).toBeDefined();
  });

  it('Tier 2: Rescuing 3 captives (1 sacrificed) grants +15 standing, 10% discount, and unlocks Blood Tap', () => {
    engine.modifyWorldCounter('hostages_rescued', 3);
    engine.modifyWorldCounter('hostages_sacrificed', 1);

    resolveHostageRitual(engine);

    expect(engine.getFactionStanding('townsfolk')).toBe(15);
    expect(engine.getFactionStanding('temple_standing')).toBe(5);
    expect(player.hasBloodMagicUnlocked()).toBe(true);
    expect(player.spellsKnown).toContain('blood_reap');
    expect(player.spellsKnown).not.toContain('crimson_ward');

    const testSword = ItemFactory.createBroadsword('broadsword-2');
    const baseBuyPrice = getItemBuyPrice(testSword);
    // At standing 15 (less than 20), discount is standard
    expect(getItemBuyPrice(testSword, engine.worldState)).toBe(baseBuyPrice);
  });

  it('Tier 3 (Halfway Path): Rescuing 2 captives (2 sacrificed) yields neutral standing, normal prices, and 2 spells', () => {
    engine.modifyWorldCounter('hostages_rescued', 2);
    engine.modifyWorldCounter('hostages_sacrificed', 2);

    resolveHostageRitual(engine);

    expect(engine.getFactionStanding('townsfolk')).toBe(0); // Neutral standing (0 delta)
    expect(engine.getFactionStanding('temple_standing')).toBe(0);
    expect(player.hasBloodMagicUnlocked()).toBe(true);
    expect(player.spellsKnown).toContain('blood_reap');
    expect(player.spellsKnown).toContain('crimson_ward');
    expect(player.spellsKnown).not.toContain('blood_spear');

    // Negligible price consequences
    const testSword = ItemFactory.createBroadsword('broadsword-3');
    expect(getItemBuyPrice(testSword, engine.worldState)).toBe(getItemBuyPrice(testSword));
  });

  it('Tier 4: Rescuing 1 captive (3 sacrificed) gives -15 standing, 15% markup, and unlocks 3 spells', () => {
    engine.modifyWorldCounter('hostages_rescued', 1);
    engine.modifyWorldCounter('hostages_sacrificed', 3);

    resolveHostageRitual(engine);

    expect(engine.getFactionStanding('townsfolk')).toBe(-15);
    expect(engine.getFactionStanding('temple_standing')).toBe(-10);
    expect(player.hasBloodMagicUnlocked()).toBe(true);
    expect(player.spellsKnown).toContain('blood_reap');
    expect(player.spellsKnown).toContain('crimson_ward');
    expect(player.spellsKnown).toContain('blood_spear');
    expect(player.spellsKnown).not.toContain('exsanguinate');

    // 15% markup in town shops
    const testSword = ItemFactory.createBroadsword('broadsword-4');
    const baseBuyPrice = getItemBuyPrice(testSword);
    expect(getItemBuyPrice(testSword, engine.worldState)).toBe(Math.floor(baseBuyPrice * 1.15));
  });

  it('Tier 5: Sacrificing all 4 captives yields -30 standing, 30% markup, and unlocks all 4 Blood Magic spells', () => {
    engine.modifyWorldCounter('hostages_sacrificed', 4);

    resolveHostageRitual(engine);

    expect(engine.getFactionStanding('townsfolk')).toBe(-30);
    expect(engine.getFactionStanding('temple_standing')).toBe(-25);
    expect(engine.getWorldFlag('blood_tainted_hero')).toBe(true);
    expect(player.hasBloodMagicUnlocked()).toBe(true);
    expect(player.spellsKnown).toEqual(
      expect.arrayContaining(['blood_reap', 'crimson_ward', 'blood_spear', 'exsanguinate'])
    );

    // 30% markup in town shops
    const testSword = ItemFactory.createBroadsword('broadsword-5');
    const baseBuyPrice = getItemBuyPrice(testSword);
    expect(getItemBuyPrice(testSword, engine.worldState)).toBe(Math.floor(baseBuyPrice * 1.30));

    // Heroic items should NOT be accessible to the blood-tainted hero
    const gunther = createGuntherArmory();
    const stock = gunther.getAvailableStock(engine.worldState);
    const heroArmor = stock.find((item) => item.id === 'gunther-hero-armor');
    expect(heroArmor).toBeUndefined();
  });

  it('engine.interactWithNpc frees captive villager upon bump and resolves the encounter sequentially', () => {
    const captive = new NPC({
      id: 'captive_villager_1',
      name: 'Astrid of the Mill',
      role: 'villager',
      position: { x: 5, y: 6 },
    });
    map.addEntity(captive);

    engine.interactWithNpc(captive);

    expect(engine.getWorldCounter('hostages_rescued')).toBe(1);
    expect(engine.getWorldFlag('captive_villager_1_rescued')).toBe(true);
    // Entity removed from map on rescue
    expect(map.getEntityById('captive_villager_1')).toBeNull();
  });
});
