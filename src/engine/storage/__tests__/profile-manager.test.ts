import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { Container } from '../../items/container';
import { Item } from '../../items/item';
import { ItemFactory } from '../../items/factory';
import { createTestKobold } from '../../__fixtures__/testHelpers';

describe('Multi-Character Profile Save Manager', () => {
  let storage: MemoryStorage;
  let manager: ProfileManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new ProfileManager(storage);
  });

  it('isolates save data when multiple character profiles are created', () => {
    // 1. Create Character 1: Sven
    const { profile: svenProfile, engine: svenEngine } = manager.createCharacter('Sven', { hp: 40 });
    expect(svenProfile.name).toBe('Sven');
    expect(svenEngine.player.hp).toBe(40);

    // Sven takes damage
    svenEngine.player.takeDamage(15);
    expect(svenEngine.player.hp).toBe(25);
    manager.saveCharacter(svenEngine, svenProfile);

    // 2. Create Character 2: Astrid
    const { profile: astridProfile, engine: astridEngine } = manager.createCharacter('Astrid', { hp: 35 });
    expect(astridProfile.name).toBe('Astrid');
    expect(astridEngine.player.hp).toBe(35);

    // Astrid takes different damage
    astridEngine.player.takeDamage(5);
    expect(astridEngine.player.hp).toBe(30);
    manager.saveCharacter(astridEngine, astridProfile);

    // 3. Verify distinct storage keys
    const svenKey = `${manager.saveKeyPrefix}${svenProfile.id}`;
    const astridKey = `${manager.saveKeyPrefix}${astridProfile.id}`;
    expect(storage.getItem(svenKey)).not.toBeNull();
    expect(storage.getItem(astridKey)).not.toBeNull();
    expect(svenKey).not.toBe(astridKey);

    // 4. Verify loading Sven does not leak Astrid's data
    const loadedSven = manager.loadCharacter(svenProfile.id);
    expect(loadedSven).not.toBeNull();
    expect(loadedSven?.engine.player.name).toBe('Sven');
    expect(loadedSven?.engine.player.hp).toBe(25);

    // 5. Verify loading Astrid does not leak Sven's data
    const loadedAstrid = manager.loadCharacter(astridProfile.id);
    expect(loadedAstrid).not.toBeNull();
    expect(loadedAstrid?.engine.player.name).toBe('Astrid');
    expect(loadedAstrid?.engine.player.hp).toBe(30);

    // 6. Check roster manifest lists both characters
    const profiles = manager.listProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.name)).toContain('Sven');
    expect(profiles.map((p) => p.name)).toContain('Astrid');
  });

  it('preserves exact inventory nesting hierarchy and entity HP across save/load', () => {
    const { profile, engine } = manager.createCharacter('Gunnar');

    // 1. Build nested container structure:
    // Backpack -> Belt/Pouch -> Velvet Purse -> Gold Coins & Dagger
    const pouch = new Container({
      id: 'leather-pouch',
      name: 'Belt Pouch',
      category: 'container',
      containerType: 'pack',
      weight: 300,
      bulk: 500,
      maxWeightCapacity: 4000,
      maxBulkCapacity: 3000,
    });

    const magicGem = new Item({
      id: 'rune-gem-1',
      name: 'Rune of Power',
      category: 'misc',
      weight: 75,
      bulk: 50,
      quality: 'enchanted',
      identified: true,
      stats: { attackBonus: 5 },
    });

    pouch.addItem(magicGem);
    engine.player.inventory.primaryPack.addItem(pouch);

    // 2. Equip weapon and armor
    const sword = ItemFactory.createBroadsword('gunnar-sword');
    engine.player.inventory.primaryPack.addItem(sword);
    engine.player.inventory.equipFromPack('gunnar-sword');

    // 3. Add damaged monster into dungeon
    const monster = createTestKobold('dungeon-kobold', { x: 10, y: 10 });
    monster.takeDamage(6); // 10 HP - 6 = 4 HP
    engine.addEntity(monster);

    // Player health reduction
    engine.player.takeDamage(12);

    // Save Game
    manager.saveCharacter(engine, profile);

    // Load Game
    const restored = manager.loadCharacter(profile.id);
    expect(restored).not.toBeNull();
    if (!restored) return;

    const restoredPlayer = restored.engine.player;

    // Verify Player HP and stats
    expect(restoredPlayer.hp).toBe(engine.player.hp);
    expect(restoredPlayer.inventory.paperdoll.getItem('mainHand')?.id).toBe('gunnar-sword');
    expect(restoredPlayer.attack).toBe(engine.player.attack);

    // Verify nested container hierarchy in backpack
    const restoredPack = restoredPlayer.inventory.primaryPack;
    const restoredPouch = restoredPack.getItem('leather-pouch') as Container;
    expect(restoredPouch).toBeInstanceOf(Container);
    expect(restoredPouch.itemCount).toBe(1);

    const restoredGem = restoredPouch.getItem('rune-gem-1');
    expect(restoredGem).not.toBeNull();
    expect(restoredGem?.name).toBe('Rune of Power');
    expect(restoredGem?.stats.attackBonus).toBe(5);

    // Verify total recursive weight preserved
    expect(restoredPack.totalWeight()).toBe(engine.player.inventory.primaryPack.totalWeight());

    // Verify Monster state and HP
    const restoredMonster = restored.engine.map.getEntityAt(10, 10);
    expect(restoredMonster).not.toBeNull();
    expect(restoredMonster?.hp).toBe(4);
    expect(restoredMonster?.name).toBe('Kobold');
  });

  it('deleting a profile does not corrupt remaining profiles', () => {
    // Create 3 characters
    const { profile: p1 } = manager.createCharacter('Hero 1');
    const { profile: p2 } = manager.createCharacter('Hero 2');
    const { profile: p3 } = manager.createCharacter('Hero 3');

    expect(manager.listProfiles()).toHaveLength(3);

    // Delete Hero 2
    const deleted = manager.deleteCharacter(p2.id);
    expect(deleted).toBe(true);

    // Verify Hero 2 save payload removed
    expect(storage.getItem(`${manager.saveKeyPrefix}${p2.id}`)).toBeNull();

    // Verify Hero 1 and Hero 3 remain
    const remaining = manager.listProfiles();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.id)).toContain(p1.id);
    expect(remaining.map((p) => p.id)).toContain(p3.id);
    expect(remaining.map((p) => p.id)).not.toContain(p2.id);

    // Hero 1 and Hero 3 remain fully loadable
    expect(manager.loadCharacter(p1.id)).not.toBeNull();
    expect(manager.loadCharacter(p3.id)).not.toBeNull();
  });

  it('supports exporting and importing .sav JSON files across profiles', () => {
    const { profile, engine } = manager.createCharacter('Ragnar');
    engine.player.takeDamage(7);
    manager.saveCharacter(engine, profile);

    // Export .sav
    const jsonString = manager.exportHero(profile.id);
    expect(typeof jsonString).toBe('string');
    expect(jsonString).toContain('Ragnar');

    // Simulate clean browser/storage instance
    const freshStorage = new MemoryStorage();
    const freshManager = new ProfileManager(freshStorage);
    expect(freshManager.listProfiles()).toHaveLength(0);

    // Import into fresh storage
    const importedProfile = freshManager.importHero(jsonString);
    expect(importedProfile.name).toBe('Ragnar');
    expect(freshManager.listProfiles()).toHaveLength(1);

    // Verify imported character loads with state
    const loaded = freshManager.loadCharacter(importedProfile.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.engine.player.name).toBe('Ragnar');
    expect(loaded?.engine.player.hp).toBe(28); // 35 - 7
  });

  // The pack slot and `primaryPack` are the same container, saved twice. Loading used to
  // equip a second copy over the restored pack: a ghost whose contents counted twice
  // toward carried weight, while new pickups went into the other copy.
  it('restores one backpack, equipped as the primary pack, at the weight it was saved with', () => {
    const { profile, engine } = manager.createCharacter('Bodvar');
    engine.player.inventory.primaryPack.addItem(
      new Item({ id: 'anvil-1', name: 'Anvil', category: 'misc', weight: 5000, bulk: 10 })
    );
    const savedWeight = engine.player.inventory.totalWeight();
    manager.saveCharacter(engine, profile);

    const inv = manager.loadCharacter(profile.id)!.engine.player.inventory;
    expect(inv.paperdoll.getItem('pack')).toBe(inv.primaryPack);
    expect(inv.primaryPack.getItem('anvil-1')).toBeDefined();
    expect(inv.totalWeight()).toBe(savedWeight);
  });
});

