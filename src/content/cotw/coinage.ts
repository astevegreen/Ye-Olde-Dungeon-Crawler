import { mintCoinPile, type CoinageDefinition, type CoinDenomination, type Item } from '../../engine';

/**
 * The coin scale (Q43, 2026-10-04): what a floor pays is on the shop's copper scale and rises
 * with depth (about 400 CP on floor 1, 1,500 on floor 10, 3,000 on floor 25, 6,000 on floor 49
 * for a full clear), paid in copper early, silver in the middle floors and gold deep. Ground
 * piles, chest coins, the hoard and every monster's purse mint from this one curve, so the
 * balance report (`npm run balance`) tunes it in one place.
 */

/** Mean value of one ordinary pile, in copper, at these floors; linear between them. */
const PILE_VALUE_CP: ReadonlyArray<readonly [floor: number, cp: number]> = [
  [1, 28],
  [10, 75],
  [25, 100],
  // The Silver Veins hold half the Siphon's monsters: richer piles keep the pay rising.
  [26, 190],
  [35, 220],
  [49, 250],
];

/** How likely each metal is, at these floors; linear between them. */
const METAL_WEIGHTS: ReadonlyArray<readonly [floor: number, weights: Readonly<Record<CoinDenomination, number>>]> = [
  [1, { copper: 45, silver: 55, gold: 0 }],
  [10, { copper: 30, silver: 65, gold: 5 }],
  [20, { copper: 10, silver: 65, gold: 25 }],
  [30, { copper: 5, silver: 45, gold: 50 }],
  [45, { copper: 0, silver: 25, gold: 75 }],
];

function along<T>(points: ReadonlyArray<readonly [number, T]>, floor: number, mix: (a: T, b: T, t: number) => T): T {
  if (floor <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [f1, v1] = points[i];
    if (floor <= f1) {
      const [f0, v0] = points[i - 1];
      return mix(v0, v1, (floor - f0) / (f1 - f0));
    }
  }
  return points[points.length - 1][1];
}

export const COTW_COINAGE: CoinageDefinition = {
  pileValueCp: (floor) => along(PILE_VALUE_CP, floor, (a, b, t) => a + (b - a) * t),
  metalWeights: (floor) =>
    along(METAL_WEIGHTS, floor, (a, b, t) => ({
      copper: a.copper + (b.copper - a.copper) * t,
      silver: a.silver + (b.silver - a.silver) * t,
      gold: a.gold + (b.gold - a.gold) * t,
    })),
  maxPileCoins: 40,
};

/**
 * A monster's purse, for its loot table: `richness` ordinary piles' worth of coin on the floor
 * where it dies. 1 is an ordinary monster of its depth; a hoarder or a boss carries more.
 */
export function coinDrop(richness = 1): (id: string, rng: () => number, floor?: number) => Item {
  return (id, rng, floor) => mintCoinPile(id, floor ?? 1, rng, COTW_COINAGE, richness);
}
