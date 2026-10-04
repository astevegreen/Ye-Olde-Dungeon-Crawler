import { describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { Monster } from '../../../engine/entities/monster';
import { Container } from '../../../engine/items/container';
import { CoinItem, mintCoinPile } from '../../../engine/economy/currency';
import { PRNG } from '../../../engine/dungeon/prng';
import type { Item } from '../../../engine/items/item';
import { cotwManifest } from '../index';
import { COTW_COINAGE, coinDrop } from '../coinage';

/**
 * Q43 "A" (2026-10-04): coin income on the shop's copper scale, rising with depth (about 400
 * CP on floor 1, 1,500 on floor 10, 6,000 on floor 49 for a full clear), copper early and gold
 * deep. `npm run balance` measures the whole curve; this pins its anchors.
 */
const valueOf = (item: Item | null): number => (item instanceof CoinItem ? item.valueInCp : 0);

/** What a full clear of one floor pays: its ground coin plus every monster's expected purse. */
function floorPay(floor: number, seeds: number): number {
  let total = 0;
  for (let s = 0; s < seeds; s++) {
    const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Coin', { seed: 4100 + s });
    engine.onChoiceInteract = undefined;
    engine.changeFloor(floor);
    const prng = new PRNG(77 + s);
    const rng = () => prng.next();
    const count = (item: Item): number =>
      item instanceof Container && item.containerType === 'chest'
        ? item.getItems().reduce((sum, inner) => sum + count(inner), 0)
        : valueOf(item);
    for (const { items } of engine.map.getAllGroundItems()) for (const item of items) total += count(item);
    for (const m of engine.map.getAllEntities()) {
      if (!(m instanceof Monster) || m.faction === 'player') continue;
      for (const rule of m.lootTable) {
        for (let t = 0; t < 10; t++) total += (rule.chance * count(rule.generate(`c-${t}`, rng, floor) ?? new CoinItem({ id: 'none', denomination: 'copper', count: 1 }))) / 10;
      }
    }
  }
  return total / seeds;
}

/** The share of a floor's coin piles that come in `metal`. */
function share(floor: number, metal: 'copper' | 'silver' | 'gold'): number {
  const prng = new PRNG(9);
  let ofMetal = 0;
  for (let i = 0; i < 2000; i++) {
    if (mintCoinPile(`p${i}`, floor, () => prng.next(), COTW_COINAGE).denomination === metal) ofMetal += 1;
  }
  return ofMetal / 2000;
}

describe('the cotw coin scale', () => {
  it('a full clear pays about 400 CP on floor 1, 1,500 on floor 10 and 6,000 on floor 49', () => {
    expect(floorPay(1, 4)).toBeGreaterThan(250);
    expect(floorPay(1, 4)).toBeLessThan(600);
    expect(floorPay(10, 4)).toBeGreaterThan(1000);
    expect(floorPay(10, 4)).toBeLessThan(2200);
    expect(floorPay(49, 4)).toBeGreaterThan(4000);
    expect(floorPay(49, 4)).toBeLessThan(9000);
  });

  it('pays in copper and silver piles early and mostly gold piles deep', () => {
    expect(share(1, 'copper')).toBeGreaterThan(0.4);
    expect(share(1, 'gold')).toBe(0);
    expect(share(45, 'copper')).toBe(0);
    expect(share(45, 'gold')).toBeGreaterThan(0.5);
  });

  it('a monster purse is its richness in ordinary piles of the floor it dies on', () => {
    const prng = new PRNG(3);
    const mean = (floor: number, richness: number) => {
      let sum = 0;
      for (let i = 0; i < 400; i++) sum += valueOf(coinDrop(richness)(`d${i}`, () => prng.next(), floor));
      return sum / 400;
    };
    expect(mean(10, 1)).toBeGreaterThan(COTW_COINAGE.pileValueCp(10) * 0.8);
    expect(mean(10, 1)).toBeLessThan(COTW_COINAGE.pileValueCp(10) * 1.2);
    expect(mean(10, 4) / mean(10, 1)).toBeGreaterThan(3);
    expect(mean(40, 1)).toBeGreaterThan(mean(5, 1));
  });
});

describe('mintCoinPile', () => {
  const flat = (metal: 'copper' | 'silver' | 'gold', cp: number) => ({
    pileValueCp: () => cp,
    metalWeights: () => ({ copper: 0, silver: 0, gold: 0, [metal]: 1 }),
  });

  it('steps down a metal rather than mint one or two coins of it', () => {
    const pile = mintCoinPile('p', 1, () => 0.5, flat('gold', 30));
    expect(pile.denomination).toBe('silver');
    expect(pile.valueInCp).toBe(30);
  });

  it('steps up a metal rather than mint a heap of cheap coins', () => {
    const pile = mintCoinPile('p', 1, () => 0.5, flat('copper', 500));
    expect(pile.denomination).toBe('silver');
    expect(pile.count).toBe(50);
  });
});
