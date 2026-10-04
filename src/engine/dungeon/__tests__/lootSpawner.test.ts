import { describe, it, expect } from 'vitest';
import { COTW_ITEMS } from '../../../content/cotw/items';
import {
  spawnFloorCurrency,
  createDungeonChest,
  createScaledItem,
  populateDungeonLoot,
  selectFloorItemDefinition,
} from '../lootSpawner';
import { Container } from '../../items/container';
import { COTW_MONSTERS } from '../../../content/cotw/monsters';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { flightRecorder } from '../../debug/flightRecorder';
import { Mulberry32 } from '../prng';

describe('Dungeon Loot Spawner & Currency Scaling', () => {
  it('scales currency denominations according to floor depth', () => {
    const prng = new Mulberry32(99);
    // Floors 1-9: Copper (CP) and Silver (SP)
    for (let f = 1; f <= 9; f++) {
      const coin = spawnFloorCurrency(f, `coin-${f}`, () => prng.next());
      expect(['copper', 'silver']).toContain(coin.denomination);
      expect(coin.count).toBeGreaterThan(0);
    }

    // Floors 10-24: Silver (SP) and Gold (GP)
    for (let f = 10; f <= 24; f += 2) {
      const coin = spawnFloorCurrency(f, `coin-${f}`, () => prng.next());
      expect(['silver', 'gold']).toContain(coin.denomination);
      expect(coin.count).toBeGreaterThan(0);
    }

    // Floors 25-50: Gold (GP)
    for (let f = 25; f <= 50; f += 5) {
      const coin = spawnFloorCurrency(f, `coin-${f}`, () => prng.next());
      expect(coin.denomination).toBe('gold');
      expect(coin.count).toBeGreaterThan(0);
    }
  });

  it('generates an ironbound chest with 2 to 4 contained items/coins', () => {
    let callCount = 0;
    const mockRng = () => {
      callCount++;
      return (callCount % 10) / 10; // 0.1, 0.2, 0.3... to ensure variety
    };
    const chest = createDungeonChest('test-chest', 15, COTW_ITEMS, mockRng);
    expect(chest.containerType).toBe('chest');
    expect(chest.name).toBe('Ironbound Wooden Chest');
    expect(chest.getItems().length).toBeGreaterThanOrEqual(2);
    expect(chest.getItems().length).toBeLessThanOrEqual(4);
  });

  it('guarantees COTW_ITEMS item definition templates remain strictly immutable', () => {
    const originalBroadsword = COTW_ITEMS.find((i) => i.id === 'broadsword')!;
    const originalStats = { ...originalBroadsword.stats };
    const originalName = originalBroadsword.name;

    // Spawn scaled broadsword with high floor (e.g. F40) and fixed RNG
    const scaled = createScaledItem(originalBroadsword, 'inst-sword-1', 40, () => 0.5);

    // Instance has scaled stats and level
    expect(scaled.enchantmentLevel).toBeGreaterThan(0);
    expect(scaled.stats.attackBonus).toBeGreaterThan(originalStats.attackBonus ?? 0);

    // Original template must NOT be mutated
    expect(originalBroadsword.stats).toEqual(originalStats);
    expect(originalBroadsword.name).toBe(originalName);
    expect((originalBroadsword as any).enchantmentLevel).toBeUndefined();
    expect((originalBroadsword as any).elementalAffix).toBeUndefined();
  });

  it('populates dungeon rooms with ground items and chests and records flight recorder event', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const rooms = [
      { x1: 2, y1: 2, x2: 6, y2: 6 }, // Room 0 (player spawn, skipped)
      { x1: 10, y1: 10, x2: 18, y2: 18 }, // Room 1
      { x1: 20, y1: 10, x2: 28, y2: 18 }, // Room 2
    ];

    // Use RNG that always triggers ground loot (roll < 0.60) and chest (roll < 0.25)
    let call = 0;
    const mockRng = () => {
      call++;
      return 0.15;
    };

    const spawned = populateDungeonLoot(map, rooms, 5, COTW_ITEMS, mockRng);
    expect(spawned.length).toBeGreaterThan(0);

    // Verify flight recorder captured loot_spawn event
    const events = flightRecorder.getEvents();
    const lootEvents = events.filter((e) => e.type === 'state' && e.details?.category === 'loot_spawn');
    expect(lootEvents.length).toBeGreaterThan(0);
  });
});

describe('createScaledItem hooks', () => {
  it('gives every item a definition hooks, whatever its type', () => {
    const withHooks = COTW_ITEMS.filter((def) => def.hooks?.length);
    // Weapons, armor, a ring and shields carry hooks: guard against a vacuous pass.
    expect(withHooks.length).toBeGreaterThan(5);
    for (const def of withHooks) {
      expect(createScaledItem(def, `item-${def.id}`, 1, () => 0.5).hooks).toEqual(def.hooks);
    }
  });
});

describe('chests as loot', () => {
  it('never rolls a chest as a loose floor item', () => {
    const chestDefs = COTW_ITEMS.filter((d) => d.containerConfig?.containerType === 'chest');
    expect(chestDefs.length).toBeGreaterThan(0);
    const rng = new Mulberry32(11);
    for (let i = 0; i < 4000; i++) {
      const def = selectFloorItemDefinition(chestDefs.concat(COTW_ITEMS.slice(0, 3)), 1 + (i % 50), () => rng.next());
      expect(def?.containerConfig?.containerType).not.toBe('chest');
    }
  });

  it('every chest a cotw monster drops holds something', () => {
    const rng = new Mulberry32(5);
    let chests = 0;
    for (const def of COTW_MONSTERS) {
      for (const rule of def.lootTable ?? []) {
        for (let i = 0; i < 5; i++) {
          const item = rule.generate(`drop-${def.id}-${i}`, () => rng.next());
          if (item instanceof Container && item.containerType === 'chest') {
            chests++;
            expect(item.getItems().length).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(chests).toBeGreaterThan(0);
  });
});
