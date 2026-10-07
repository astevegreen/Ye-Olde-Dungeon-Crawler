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
import { PRNG } from '../prng';
import type { ItemDefinition } from '../../types/manifest';

describe('Dungeon Loot Spawner & Currency Scaling', () => {
  it('scales currency denominations according to floor depth', () => {
    const prng = new PRNG(99);
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
    const rng = new PRNG(11);
    for (let i = 0; i < 4000; i++) {
      const def = selectFloorItemDefinition(chestDefs.concat(COTW_ITEMS.slice(0, 3)), 1 + (i % 50), () => rng.next());
      expect(def?.containerConfig?.containerType).not.toBe('chest');
    }
  });

  it('every chest a cotw monster drops holds something', () => {
    const rng = new PRNG(5);
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

describe('loot rates as pack data (manifest.loot, Q2 "C")', () => {
  const def = (id: string, minFloor: number): ItemDefinition => ({
    id,
    name: id,
    category: 'weapon',
    weight: 1000,
    bulk: 1000,
    minFloor,
  });

  it('spreads the newest share over the newest definitions, not the one that unlocked last', () => {
    const candidates = [def('old-a', 1), def('old-b', 1), def('two', 2), def('three', 3), def('four', 4), def('five', 5)];
    const rng = new PRNG(3);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) {
      const picked = selectFloorItemDefinition(candidates, 5, () => rng.next(), { newestShare: 0.8, newestDefinitions: 4 })!;
      counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    // 80% over the four newest (20% each), 20% over the two older ones (10% each).
    for (const id of ['two', 'three', 'four', 'five']) expect(counts[id] / 8000, id).toBeCloseTo(0.2, 1);
    for (const id of ['old-a', 'old-b']) expect(counts[id] / 8000, id).toBeCloseTo(0.1, 1);
  });

  it('keeps definitions that share a floor together in the newest group', () => {
    const candidates = [def('old', 1), def('mid-a', 3), def('mid-b', 3), def('mid-c', 3), def('new', 4)];
    const rng = new PRNG(8);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 8000; i++) {
      const picked = selectFloorItemDefinition(candidates, 4, () => rng.next(), { newestShare: 1, newestDefinitions: 2 })!;
      counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    expect(counts.old ?? 0).toBe(0);
    for (const id of ['mid-a', 'mid-b', 'mid-c', 'new']) expect(counts[id] / 8000, id).toBeCloseTo(0.25, 1);
  });

  it('without rates, draws as before: 75% from the definitions of the newest floor alone', () => {
    const candidates = [def('old-a', 1), def('old-b', 1), def('two', 2), def('five', 5)];
    const rng = new PRNG(21);
    let five = 0;
    for (let i = 0; i < 8000; i++) if (selectFloorItemDefinition(candidates, 5, () => rng.next())!.id === 'five') five++;
    expect(five / 8000).toBeCloseTo(0.75, 1);
  });

  it('fills a chest with the pack’s number of entries', () => {
    const rng = new PRNG(4);
    for (let i = 0; i < 200; i++) {
      const chest = createDungeonChest(`c-${i}`, 10, COTW_ITEMS, () => rng.next(), undefined, undefined, { chestEntries: [1, 1] });
      expect(chest.getItems()).toHaveLength(1);
    }
  });

  it('rolls each room with the pack’s drop, coin and chest chances', () => {
    const map = new GameMap(60, 60, TILES.FLOOR);
    const rooms = Array.from({ length: 30 }, (_, i) => ({ x1: (i % 6) * 10, y1: Math.floor(i / 6) * 10, x2: (i % 6) * 10 + 8, y2: Math.floor(i / 6) * 10 + 8 }));
    const rng = new PRNG(6);
    const spawned = populateDungeonLoot(map, rooms, 10, COTW_ITEMS, () => rng.next(), undefined, undefined, {
      roomDropChance: 1,
      roomCoinShare: 1,
      roomChestChance: 0,
    });
    // One coin pile in every room but the arrival room, and nothing else.
    expect(spawned).toHaveLength(29);
    expect(spawned.every((item) => item.category === 'currency')).toBe(true);
  });
});

describe('loot weight (ItemDefinition.lootWeight)', () => {
  it('draws a definition by its weight against the others in its group', () => {
    const candidates: ItemDefinition[] = [
      { id: 'common', name: 'common', category: 'weapon', weight: 1, bulk: 1, minFloor: 5 },
      { id: 'relic', name: 'relic', category: 'weapon', weight: 1, bulk: 1, minFloor: 5, lootWeight: 0.25 },
    ];
    const rng = new PRNG(12);
    let relic = 0;
    for (let i = 0; i < 10000; i++) if (selectFloorItemDefinition(candidates, 5, () => rng.next())!.id === 'relic') relic++;
    // 0.25 against 1: a fifth of the draws.
    expect(relic / 10000).toBeCloseTo(0.2, 1);
  });

  it('with every weight at 1, picks the same definition the uniform draw did', () => {
    const candidates = COTW_ITEMS.filter((d) => d.lootWeight === undefined);
    for (let i = 0; i < 200; i++) {
      const r = (i + 0.5) / 200;
      const eligible = candidates.filter((d) => d.category !== 'quest' && d.containerConfig?.containerType !== 'chest' && (d.minFloor ?? 1) <= 1);
      const picked = selectFloorItemDefinition(candidates, 1, () => r);
      expect(picked).toBe(eligible[Math.floor(r * eligible.length)]);
    }
  });
});
