import { describe, it, expect, beforeEach } from 'vitest';
import { TownMapGenerator } from '../../town/townMap';
import { COTW_TOWN } from '../../../content/cotw/town';
import { cotwManifest } from '../../../content/cotw';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { ItemFactory } from '../../items/factory';
import { getPlayerTotalCp, getPlayerCurrencyBreakdown } from '../currency';

describe('Town Hub Generation & Multi-Floor Persistence', () => {
  let storage: MemoryStorage;
  let manager: ProfileManager;

  beforeEach(() => {
    storage = new MemoryStorage();
    manager = new ProfileManager(storage, cotwManifest);
  });

  it('generates Bjarnarhaven layout with complete shops, services, and dungeon entrance', () => {
    const townGen = new TownMapGenerator(50, 30, COTW_TOWN);
    const town = townGen.generate();

    expect(town.map.width).toBe(COTW_TOWN.width);
    expect(town.map.height).toBe(COTW_TOWN.height);

    // Verify stairs down
    expect(town.stairsDown).toEqual(COTW_TOWN.stairsDown);
    expect(town.map.getTile(COTW_TOWN.stairsDown.x, COTW_TOWN.stairsDown.y)?.type).toBe('stairs_down');

    // Verify NPCs
    expect(town.npcs.length).toBeGreaterThanOrEqual(6);
    const names = town.npcs.map((n) => n.name);
    expect(names).toContain('Olaf the Chandler');
    expect(names).toContain('Gunther the Smith');
    expect(names).toContain('Astrid the Alchemist');
    expect(names).toContain('Father Torvald');
    expect(names).toContain('Sage Mimir');
    expect(names).toContain('Banker Haakon');

    // Verify Merchants
    expect(town.merchants.size).toBe(3);
    expect(town.merchants.has('merchant-olaf')).toBe(true);
    expect(town.merchants.has('merchant-gunther')).toBe(true);
    expect(town.merchants.has('merchant-astrid')).toBe(true);
  });

  it('supports bidirectional floor transitions between Town (Floor 0) and Dungeon (Floor 1)', () => {
    const { profile, engine } = manager.createCharacter('Sigurd');
    expect(engine.currentFloor).toBe(0);
    expect(profile.floor).toBe(0);

    // 1. Descend to Floor 1
    engine.changeFloor(1);
    expect(engine.currentFloor).toBe(1);

    // Verify Floor 1 contains stairs_up to return to town
    const stairsUp = engine.map.getTile(engine.player.x, engine.player.y);
    expect(stairsUp?.type).toBe('stairs_up');

    // 2. Drop an item on Floor 1
    const testRing = ItemFactory.createDagger('floor1-dagger');
    engine.map.addItemAt(engine.player.x, engine.player.y, testRing);

    // 3. Return to Bjarnarhaven (Floor 0)
    engine.changeFloor(0);
    expect(engine.currentFloor).toBe(0);
    const olaf = engine.map.getAllEntities().find((e) => e.name === 'Olaf the Chandler');
    expect(olaf).toBeDefined();

    // 4. Return to Floor 1: verified dropped loot persisted!
    engine.changeFloor(1);
    expect(engine.currentFloor).toBe(1);
    const groundItems = engine.map.getItemsAt(engine.player.x, engine.player.y);
    expect(groundItems.some((i) => i.id === 'floor1-dagger')).toBe(true);
  });

  it('preserves multi-floor maps and merchant states across serialize and deserialize', () => {
    const { profile, engine } = manager.createCharacter('Hilda');
    expect(engine.currentFloor).toBe(0);

    // Hilda has starter coins: 50 CP, 10 SP, 2 GP = 350 CP
    expect(getPlayerTotalCp(engine.player)).toBe(350);

    // Save game in town
    manager.saveCharacter(engine, profile);

    // Reload from storage
    const restored = manager.loadCharacter(profile.id);
    expect(restored).not.toBeNull();
    if (!restored) return;

    expect(restored.engine.currentFloor).toBe(0);
    expect(restored.profile.floor).toBe(0);

    // Verify starter coins preserved in purse
    expect(getPlayerTotalCp(restored.engine.player)).toBe(350);
    const breakdown = getPlayerCurrencyBreakdown(restored.engine.player);
    expect(breakdown.copper).toBe(50);
    expect(breakdown.silver).toBe(10);
    expect(breakdown.gold).toBe(2);

    // Verify town merchants restored
    expect(restored.engine.merchants.size).toBe(3);
    expect(restored.engine.merchants.get('merchant-gunther')).toBeDefined();

    // Verify NPCs on active town map
    const gunther = restored.engine.map.getAllEntities().find((e) => e.name === 'Gunther the Smith');
    expect(gunther).toBeDefined();
  });

  it('keeps what the hero bought gone and what they sold on the shelf across a reload', () => {
    const { profile, engine } = manager.createCharacter('Hilda');
    const olaf = engine.merchants.get('merchant-olaf')!;
    const before = olaf.stock.length;
    const torch = olaf.stock.find((i) => i.id === 'olaf-torch-1')!;
    expect(olaf.buyItem(engine.player, torch.id).success).toBe(true);
    const dagger = ItemFactory.createDagger('hilda-old-dagger');
    engine.player.inventory.primaryPack.addItem(dagger);
    expect(olaf.sellItem(engine.player, dagger.id).success).toBe(true);
    manager.saveCharacter(engine, profile);

    const restored = manager.loadCharacter(profile.id)!.engine.merchants.get('merchant-olaf')!;
    const ids = restored.stock.map((i) => i.id);
    expect(ids).not.toContain('olaf-torch-1');
    expect(ids).toContain('hilda-old-dagger');
    expect(restored.stock).toHaveLength(before);
    expect(restored.stock.find((i) => i.id === 'hilda-old-dagger')!.identified).toBe(true);
  });

  it("keeps a shop item's availability rule across a reload (Astrid's tablets unlock by depth)", () => {
    const { profile, engine } = manager.createCharacter('Hilda');
    const gated = engine.merchants.get('merchant-astrid')!.stock.filter((i) => i.predicate);
    expect(gated.length).toBeGreaterThan(0);
    manager.saveCharacter(engine, profile);
    const restored = manager.loadCharacter(profile.id)!.engine.merchants.get('merchant-astrid')!;
    for (const item of gated) expect(restored.stock.find((i) => i.id === item.id)?.predicate).toEqual(item.predicate);
  });
});
