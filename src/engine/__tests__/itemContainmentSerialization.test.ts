import { describe, it, expect, beforeEach } from 'vitest';
import { Item } from '../items/item';
import { Container } from '../items/container';
import { WandItem, PotionItem } from '../items/consumables';
import { CoinItem } from '../economy/currency';
import { safeJsonStringify } from '../storage/safeJson';
import { serializeItem, deserializeItem } from '../storage/serializer';
import { Player } from '../entities/player';
import { flightRecorder } from '../debug/flightRecorder';

describe('Item Containment Scalar ID Normalization & Serialization Hardening', () => {
  beforeEach(() => {
    Container.clearContainerRegistry();
    flightRecorder.clear();
  });

  describe('Scalar ID Normalization for Item-Container Relationships', () => {
    it('sets parentId and resolves parent container via scalar ID registry without live object references', () => {
      const backpack = new Container({
        id: 'pack-alpha',
        name: 'Adventurer Backpack',
        category: 'container',
        containerType: 'pack',
        weight: 1000,
        bulk: 500,
        maxWeightCapacity: 20000,
        maxBulkCapacity: 10000,
      });

      const pouch = new Container({
        id: 'pouch-beta',
        name: 'Small Belt Pouch',
        category: 'container',
        containerType: 'pack',
        weight: 200,
        bulk: 100,
        maxWeightCapacity: 3000,
        maxBulkCapacity: 1500,
      });

      const gem = new Item({
        id: 'gem-ruby',
        name: 'Cut Ruby',
        category: 'misc',
        weight: 50,
        bulk: 20,
      });

      // Add pouch into backpack
      expect(backpack.addItem(pouch)).toBe(true);
      expect(pouch.parentId).toBe('pack-alpha');
      expect(pouch.getParentContainer()).toBe(backpack);
      expect((pouch as any).parent).toBeUndefined();

      // Add gem into pouch
      expect(pouch.addItem(gem)).toBe(true);
      expect(gem.parentId).toBe('pouch-beta');
      expect(gem.getParentContainer()).toBe(pouch);
      expect((gem as any).parent).toBeUndefined();

      // Check ancestry prevention (cycle prevention)
      expect(pouch.canContain(backpack).allowed).toBe(false);
      expect(pouch.canContain(backpack).reason).toContain('Cannot create circular container nesting');

      // Native JSON.stringify on the nested structure MUST NOT throw circular structure error
      expect(() => JSON.stringify(backpack)).not.toThrow();

      // Remove gem from pouch
      const removedGem = pouch.removeItem('gem-ruby');
      expect(removedGem).toBe(gem);
      expect(gem.parentId).toBeNull();
      expect(gem.getParentContainer()).toBeNull();
    });

    it('propagates ownerId through container hierarchies when owner is set or modified', () => {
      const backpack = new Container({
        id: 'pack-delta',
        name: 'Traveler Pack',
        category: 'container',
        containerType: 'pack',
        weight: 1000,
        bulk: 500,
        maxWeightCapacity: 20000,
        maxBulkCapacity: 10000,
      });

      const dagger = new Item({
        id: 'dagger-iron',
        name: 'Iron Dagger',
        category: 'weapon',
        weight: 400,
        bulk: 150,
      });

      backpack.addItem(dagger);
      expect(dagger.ownerId).toBeNull();

      // Set ownerId on the root container
      backpack.setOwnerId('player-42');
      expect(backpack.ownerId).toBe('player-42');
      expect(dagger.ownerId).toBe('player-42');

      // New items added inherit the container ownerId
      const potion = new PotionItem({
        id: 'pot-heal',
        name: 'Healing Potion',
        potionType: 'health',
      });
      backpack.addItem(potion);
      expect(potion.ownerId).toBe('player-42');
      expect(potion.parentId).toBe('pack-delta');

      // Removing item clears parentId (ownerId retained until stashed or dropped)
      backpack.removeItem('pot-heal');
      expect(potion.parentId).toBeNull();
    });

    it('player inventory initializes with player id as ownerId and propagates to stashed items', () => {
      const player = new Player({
        id: 'hero-1',
        name: 'Hero',
        position: { x: 0, y: 0 },
        stats: { hp: 30, maxHp: 30, attack: 5, defense: 5 },
        inventory: undefined,
      });

      expect(player.inventory.ownerId).toBe('hero-1');
      expect(player.inventory.primaryPack.ownerId).toBe('hero-1');

      const sword = new Item({
        id: 'sword-broad',
        name: 'Broadsword',
        category: 'weapon',
        weight: 1200,
        bulk: 400,
      });

      player.inventory.storeItem(sword);
      expect(sword.ownerId).toBe('hero-1');
      expect(sword.parentId).toBe(player.inventory.primaryPack.id);
      expect(sword.getParentContainer()).toBe(player.inventory.primaryPack);

      // Equipping to paperdoll
      player.inventory.removeItem('sword-broad');
      expect(sword.parentId).toBeNull();
      player.inventory.paperdoll.equip(sword, 'mainHand');
      expect(player.inventory.paperdoll.getItem('mainHand')).toBe(sword);
    });
  });

  describe('Item Serialization & Deserialization with Scalar IDs', () => {
    it('serializes and deserializes container item trees with parentId and ownerId preserved', () => {
      const backpack = new Container({
        id: 'bp-save-test',
        name: 'Loot Bag',
        category: 'container',
        containerType: 'pack',
        weight: 500,
        bulk: 200,
        maxWeightCapacity: 10000,
        maxBulkCapacity: 5000,
        ownerId: 'hero-save',
      });

      const wand = new WandItem({
        id: 'wand-fire',
        name: 'Wand of Fire',
        spellId: 'fireball',
        charges: 5,
        maxCharges: 10,
        ownerId: 'hero-save',
      });

      const coins = new CoinItem({
        id: 'coins-gold',
        denomination: 'gold',
        count: 50,
        ownerId: 'hero-save',
      });

      backpack.addItem(wand);
      backpack.addItem(coins);

      const serialized = serializeItem(backpack);

      // Verify native JSON stringify succeeds cleanly
      const jsonStr = JSON.stringify(serialized);
      expect(jsonStr).not.toContain('"[Circular]"');
      expect(jsonStr).toContain('"parentId":"bp-save-test"');
      expect(jsonStr).toContain('"ownerId":"hero-save"');

      // Clear container registry to simulate a fresh load
      Container.clearContainerRegistry();

      // Deserialize
      const deserialized = deserializeItem(JSON.parse(jsonStr)) as Container;
      expect(deserialized.id).toBe('bp-save-test');
      expect(deserialized.ownerId).toBe('hero-save');
      expect(deserialized.getItems()).toHaveLength(2);

      const loadedWand = deserialized.getItem('wand-fire');
      expect(loadedWand).toBeInstanceOf(WandItem);
      expect(loadedWand?.parentId).toBe('bp-save-test');
      expect(loadedWand?.ownerId).toBe('hero-save');
      expect(loadedWand?.getParentContainer()).toBe(deserialized);

      const loadedCoins = deserialized.getItem('coins-gold');
      expect(loadedCoins).toBeInstanceOf(CoinItem);
      expect(loadedCoins?.parentId).toBe('bp-save-test');
      expect(loadedCoins?.ownerId).toBe('hero-save');
      expect(loadedCoins?.getParentContainer()).toBe(deserialized);
    });
  });

  describe('Defensive Serialization (safeJsonStringify)', () => {
    it('handles direct and indirect circular references without crashing', () => {
      const circularObj: any = { name: 'Root', child: {} };
      circularObj.child.parent = circularObj;
      circularObj.self = circularObj;

      // Standard JSON.stringify MUST throw
      expect(() => JSON.stringify(circularObj)).toThrow(TypeError);

      // safeJsonStringify MUST NOT throw and should replace with "[Circular]"
      let safeStr = '';
      expect(() => {
        safeStr = safeJsonStringify(circularObj);
      }).not.toThrow();

      expect(safeStr).toContain('"name":"Root"');
      expect(safeStr).toContain('"[Circular]"');

      const parsed = JSON.parse(safeStr);
      expect(parsed.name).toBe('Root');
      expect(parsed.self).toBe('[Circular]');
      expect(parsed.child.parent).toBe('[Circular]');
    });

    it('handles BigInt and undefined values properly', () => {
      const complexData = {
        bigNumber: BigInt(9007199254740991) + 100n,
        regularNumber: 42,
        undefProp: undefined,
      };

      // Standard JSON.stringify throws on BigInt
      expect(() => JSON.stringify(complexData)).toThrow(TypeError);

      const safe = safeJsonStringify(complexData);
      expect(safe).toContain('"bigNumber":"9007199254741091"');
      expect(safe).toContain('"regularNumber":42');
    });

    it('returns fallback string if stringify catastrophically fails', () => {
      const poisonObj: any = {};
      Object.defineProperty(poisonObj, 'badProp', {
        get() {
          throw new Error('Exploding property getter!');
        },
        enumerable: true,
      });

      const safe = safeJsonStringify(poisonObj, 0, '{"error":"fallback"}');
      expect(safe).toBe('{"error":"fallback"}');
    });
  });

  describe('Flight Recorder Hardening & Log Cascade Prevention', () => {
    it('safely records events containing circular references without throwing', () => {
      const circularPayload: any = { status: 'bad' };
      circularPayload.ref = circularPayload;

      expect(() => {
        flightRecorder.record({
          type: 'combat',
          summary: 'Combat hit',
          details: circularPayload,
        });
      }).not.toThrow();

      const events = flightRecorder.getRecentEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('combat');
    });

    it('safely records errors containing circular metadata and generates reports cleanly', () => {
      const circularErrMeta: any = { action: 'attack' };
      circularErrMeta.loop = circularErrMeta;

      expect(() => {
        flightRecorder.recordError(new Error('Simulated combat stall'), circularErrMeta);
      }).not.toThrow();

      let report = '';
      expect(() => {
        report = flightRecorder.generateReport();
      }).not.toThrow();

      expect(report).toContain('Diagnostic Flight Report');
      expect(report).toContain('Simulated combat stall');

      const events = flightRecorder.getRecentEvents(1);
      const detailsStr = safeJsonStringify(events[0].details);
      expect(detailsStr).toContain('[Circular]');
    });
  });
});
