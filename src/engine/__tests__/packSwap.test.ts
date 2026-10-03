import { describe, expect, it } from 'vitest';
import { InventoryManager } from '../inventory/inventory-manager';
import { Container } from '../items/container';
import { ItemFactory } from '../items/factory';
import { ProfileManager, MemoryStorage } from '../storage/profile-manager';
import { serializeGame, deserializeGame } from '../storage/serializer';
import { cotwManifest } from '../../content/cotw';

function pack(id: string, maxWeightCapacity: number, maxBulkCapacity: number): Container {
  return new Container({
    id,
    name: id,
    category: 'container',
    slot: 'pack',
    containerType: 'pack',
    weight: 1000,
    bulk: 2000,
    maxWeightCapacity,
    maxBulkCapacity,
    identified: true,
  });
}

describe('equipping a different pack', () => {
  it('makes the new pack the one that holds everything, the old pack and its contents included', () => {
    const inv = new InventoryManager();
    const oldPack = inv.primaryPack;
    const armor = ItemFactory.createLeatherArmor('armor-1');
    inv.primaryPack.addItem(armor);
    const frame = pack('frame', 45000, 35000);
    inv.primaryPack.addItem(frame);

    const result = inv.equipFromPack('frame');

    expect(result.success).toBe(true);
    expect(inv.primaryPack).toBe(frame);
    expect(inv.paperdoll.getItem('pack')).toBe(frame);
    expect(frame.getItem('armor-1')).toBe(armor);
    expect(frame.getItem(oldPack.id)).toBe(oldPack);
    expect(oldPack.getItems()).toHaveLength(0);
    expect(inv.storeItem(ItemFactory.createLeatherArmor('armor-2')).success).toBe(true);
    expect(frame.getItem('armor-2')).toBeDefined();
  });

  it('refuses a pack too small for what the old one holds, and changes nothing', () => {
    const inv = new InventoryManager();
    const oldPack = inv.primaryPack;
    for (let i = 0; i < 3; i++) inv.primaryPack.addItem(ItemFactory.createLeatherArmor(`armor-${i}`));
    const pouch = pack('pouch', 3000, 3000);
    inv.primaryPack.addItem(pouch);

    const result = inv.equipFromPack('pouch');

    expect(result.success).toBe(false);
    expect(inv.primaryPack).toBe(oldPack);
    expect(inv.paperdoll.getItem('pack')).toBe(oldPack);
    expect(oldPack.getItem('pouch')).toBe(pouch);
    expect(oldPack.getItems()).toHaveLength(4);
  });

  it('keeps the new pack across a save and load', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Packer', { seed: 5 });
    const inv = engine.player.inventory;
    const oldId = inv.primaryPack.id;
    inv.primaryPack.addItem(pack('frame', 45000, 35000));
    inv.equipFromPack('frame');

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    const loadedInv = loaded.player.inventory;
    expect(loadedInv.primaryPack.id).toBe('frame');
    expect(loadedInv.paperdoll.getItem('pack')).toBe(loadedInv.primaryPack);
    expect(loadedInv.primaryPack.getItem(oldId)).toBeDefined();
  });
});
