import { describe, it, expect } from 'vitest';
import { COTW_ITEM_FAMILIES } from '../itemFamilies';
import { COTW_CATALOG_RECORD, COTW_ITEMS } from '../items';
import { makeLootItem, makeShopItem } from '../items/makeItem';
import { createScaledItem, populateDungeonLoot, rollItemFamily, GameMap, Container, PRNG, type Item } from '../../../engine';

const sword = COTW_CATALOG_RECORD['cinder_edge_shortsword'];

function familyCounts(floor: number, rolls: number): Record<string, number> {
  const prng = new PRNG(floor * 1000 + 17);
  const counts: Record<string, number> = { normal: 0 };
  for (let i = 0; i < rolls; i++) {
    const mod = rollItemFamily(sword, floor, () => prng.next(), COTW_ITEM_FAMILIES, `roll-${i}`);
    const key = mod?.category ?? 'normal';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

describe('cotw item families (Q1 A, Q20 + Q33 B)', () => {
  const byAlignment = (alignment: string) =>
    COTW_ITEM_FAMILIES.families.filter((f) => f.alignment === alignment).reduce((sum, f) => sum + f.perGame, 0);

  it('rolls 60 Positive, 40 Negative and 10 Chaotic items a game; the cursed relics bring Negative to 45', () => {
    // The measured counts, relics and the shallow floors included, are pinned in lootVolume.test.ts.
    expect(byAlignment('positive')).toBe(60);
    expect(byAlignment('negative')).toBe(40);
    expect(byAlignment('chaotic')).toBe(10);
    const relics = COTW_ITEMS.filter((d) => d.family === 'cursed');
    expect(relics.map((d) => d.id).sort()).toEqual(['cursed_mace', 'marrow_gnawed_ring', 'nid_dripping_hauberk', 'rot_porous_cleaver']);
    for (const relic of relics) expect(relic.lootWeight, relic.id).toBe(0.25);
  });

  it('rolls no negative family before floor 3', () => {
    for (const family of COTW_ITEM_FAMILIES.families.filter((f) => f.alignment === 'negative')) {
      expect(family.minFloor, family.category).toBe(3);
    }
    const shallow = familyCounts(2, 4000);
    expect(shallow.cursed ?? 0).toBe(0);
    expect(shallow.hexed ?? 0).toBe(0);
    expect(shallow.unholy ?? 0).toBe(0);
    expect(shallow.blessed).toBeGreaterThan(0);
  });

  it('rolls Normal most of the time and every family some of the time, at the per-game shares', () => {
    const rolls = 20000;
    const counts = familyCounts(20, rolls);
    const total = COTW_ITEM_FAMILIES.families.reduce((sum, f) => sum + f.perGame, 0);
    expect(counts.normal / rolls).toBeCloseTo(1 - total / COTW_ITEM_FAMILIES.itemsPerGame, 1);
    for (const family of COTW_ITEM_FAMILIES.families) {
      const expected = (family.perGame / COTW_ITEM_FAMILIES.itemsPerGame) * rolls;
      expect(counts[family.category], family.category).toBeGreaterThan(expected * 0.7);
      expect(counts[family.category], family.category).toBeLessThan(expected * 1.3);
    }
  });

  it('picks the tier the floor has reached, never one from deeper down', () => {
    const at = (floor: number) => rollItemFamily({ ...sword, family: 'cursed' }, floor, () => 0, COTW_ITEM_FAMILIES, 'x')!;
    expect(at(5).name).toBe('Cursed');
    expect(at(14).name).toBe('Cursed');
    expect(at(15).name).toBe('Blighted');
    expect(at(50).name).toBe('Blighted');
    const blessed = (floor: number) => rollItemFamily({ ...sword, family: 'blessed' }, floor, () => 0, COTW_ITEM_FAMILIES, 'x')!;
    expect([blessed(1).name, blessed(10).name, blessed(25).name]).toEqual(['Blessed', 'Sanctified', 'Celestial']);
  });

  it('rolls each of the eight Chaotic variants, at any depth', () => {
    const prng = new PRNG(31);
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const mod = rollItemFamily({ ...sword, family: 'chaotic' }, 1 + (i % 50), () => prng.next(), COTW_ITEM_FAMILIES, `c-${i}`);
      seen.add(mod!.name);
    }
    expect([...seen].sort()).toEqual(['Bloodthirst', 'Fickle Fortune', 'Glass Fury', 'Mirror Hide', "Trickster's Step", 'Twinstrike', 'Void-Kissed', 'Wildfire']);
  });

  it('is deterministic: the same seed rolls the same family with the same id', () => {
    const a = new PRNG(4242);
    const b = new PRNG(4242);
    const one = makeLootItem('cinder_edge_shortsword', 'loot-1', () => a.next(), 20);
    const two = makeLootItem('cinder_edge_shortsword', 'loot-1', () => b.next(), 20);
    expect(one.modifiers).toEqual(two.modifiers);
    expect(one.enchantmentLevel).toBe(two.enchantmentLevel);
  });

  it('leaves shop stock, potions and artifacts Normal', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeShopItem('cinder_edge_shortsword', `shop-${i}`).modifiers).toEqual([]);
    }
    const prng = new PRNG(9);
    const potion = COTW_ITEMS.find((d) => d.itemType === 'potion')!;
    const artifact = COTW_ITEMS.find((d) => d.quality === 'artifact')!;
    for (let i = 0; i < 200; i++) {
      expect(createScaledItem(potion, `p-${i}`, 30, () => prng.next(), COTW_ITEM_FAMILIES).modifiers).toEqual([]);
      expect(createScaledItem(artifact, `a-${i}`, 30, () => prng.next(), COTW_ITEM_FAMILIES).modifiers).toEqual([]);
    }
  });

  it('puts families on floor loot and chest contents through the loot spawner', () => {
    const map = GameMap.createBoxRoom(60, 40);
    const rooms = Array.from({ length: 40 }, (_, i) => ({ x1: 1 + (i % 8) * 7, y1: 1 + Math.floor(i / 8) * 7, x2: 6 + (i % 8) * 7, y2: 6 + Math.floor(i / 8) * 7 }));
    const prng = new PRNG(777);
    const equipment: Item[] = [];
    for (let pass = 0; pass < 6; pass++) {
      for (const item of populateDungeonLoot(map, rooms, 20, COTW_ITEMS, () => prng.next(), undefined, COTW_ITEM_FAMILIES)) {
        const inner = item instanceof Container && item.containerType === 'chest' ? item.getItems() : [item];
        for (const it of inner) if (COTW_ITEM_FAMILIES.categories.includes(it.category)) equipment.push(it);
      }
    }
    expect(equipment.length).toBeGreaterThan(50);
    const withFamily = equipment.filter((it) => it.modifiers.length > 0);
    expect(withFamily.length).toBeGreaterThan(0);
    // A family modifier carries the family's alignment and the tier's name.
    for (const it of withFamily) {
      const family = COTW_ITEM_FAMILIES.families.find((f) => f.category === it.modifiers[0].category)!;
      expect(it.modifiers[0].alignment).toBe(family.alignment);
      expect(family.tiers.map((t) => t.name)).toContain(it.modifiers[0].name);
    }
  });
});
