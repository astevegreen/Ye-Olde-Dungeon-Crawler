import { beforeAll, describe, it, expect } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../../engine/storage/profile-manager';
import { Monster } from '../../../engine/entities/monster';
import { Container } from '../../../engine/items/container';
import { CoinItem } from '../../../engine/economy/currency';
import { PRNG } from '../../../engine/dungeon/prng';
import { selectFloorItemDefinition } from '../../../engine/dungeon/lootSpawner';
import type { Item } from '../../../engine/items/item';
import { cotwManifest } from '../index';
import { COTW_ITEMS } from '../items';
import { COTW_ITEM_FAMILIES } from '../itemFamilies';
import { COTW_LOOT_RATES } from '../loot';

/**
 * Q2 "C" (tracker 2.4): about 8–10 items a floor, no floor filled by one item, and the family
 * budgets of Q20 + Q33 "B" (60 Positive, 45 Negative, 10 Chaotic a game) as measured counts,
 * not just configured ones. `npm run balance` measures the same with 20 seeds.
 */
const SEEDS = 5;
const LAST_FLOOR = 49; // floor 50 is the lair
const KILLS = 5; // each monster's table rolled this many times, weighted 1/KILLS

interface GameTally {
  items: number;
  byAlignment: Record<string, number>;
}

function alignmentOf(item: Item): string {
  const category = item.modifiers[0]?.category;
  return COTW_ITEM_FAMILIES.families.find((f) => f.category === category)?.alignment ?? 'normal';
}

/** A full clear of floors 1–49: ground items (chest contents counted) and expected monster drops. */
function fullClear(seed: number): GameTally {
  const tally: GameTally = { items: 0, byAlignment: {} };
  const add = (item: Item | null, weight: number): void => {
    if (!item || item instanceof CoinItem) return;
    if (item instanceof Container && item.containerType === 'chest') {
      for (const inner of item.getItems()) add(inner, weight);
      return;
    }
    tally.items += weight;
    const alignment = alignmentOf(item);
    tally.byAlignment[alignment] = (tally.byAlignment[alignment] ?? 0) + weight;
  };
  const { engine } = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Loot', { seed });
  engine.onChoiceInteract = undefined;
  const prng = new PRNG(seed * 7 + 1);
  const rng = () => prng.next();
  for (let floor = 1; floor <= LAST_FLOOR; floor++) {
    engine.changeFloor(floor);
    for (const { items } of engine.map.getAllGroundItems()) for (const item of items) add(item, 1);
    for (const m of engine.map.getAllEntities()) {
      if (!(m instanceof Monster) || m.faction === 'player' || m === engine.companion) continue;
      for (const carried of m.getItems()) add(carried, 1);
      for (let k = 0; k < KILLS; k++) {
        for (const rule of m.lootTable) {
          if (rng() < rule.chance) add(rule.generate(`v-${floor}-${m.id}-${k}`, rng, floor), 1 / KILLS);
        }
      }
    }
  }
  return tally;
}

describe('cotw loot volume (Q2 "C")', () => {
  let games: GameTally[] = [];
  beforeAll(() => {
    games = Array.from({ length: SEEDS }, (_, s) => fullClear(5200 + s));
  }, 120_000);
  const perGame = (pick: (g: GameTally) => number) => games.reduce((sum, g) => sum + pick(g), 0) / SEEDS;

  it('offers about 8–10 items a floor (it was 17–29)', () => {
    const perFloor = perGame((g) => g.items) / LAST_FLOOR;
    expect(perFloor).toBeGreaterThan(8);
    expect(perFloor).toBeLessThan(10);
  });

  it('offers 60 Positive, 45 Negative and 10 Chaotic items a game, relics included', () => {
    expect(perGame((g) => g.byAlignment.positive ?? 0)).toBeGreaterThan(60 * 0.85);
    expect(perGame((g) => g.byAlignment.positive ?? 0)).toBeLessThan(60 * 1.15);
    expect(perGame((g) => g.byAlignment.negative ?? 0)).toBeGreaterThan(45 * 0.85);
    expect(perGame((g) => g.byAlignment.negative ?? 0)).toBeLessThan(45 * 1.15);
    expect(perGame((g) => g.byAlignment.chaotic ?? 0)).toBeGreaterThan(10 * 0.65);
    expect(perGame((g) => g.byAlignment.chaotic ?? 0)).toBeLessThan(10 * 1.35);
  });

  it('never lets one item fill a floor: no definition is more than a sixth of any floor’s draws', () => {
    const prng = new PRNG(404);
    for (let floor = 1; floor <= 50; floor++) {
      const counts = new Map<string, number>();
      const draws = 1000; // the largest true share is ~9% (floor 29's eight newest)
      for (let i = 0; i < draws; i++) {
        const def = selectFloorItemDefinition(COTW_ITEMS, floor, () => prng.next(), COTW_LOOT_RATES)!;
        counts.set(def.id, (counts.get(def.id) ?? 0) + 1);
      }
      const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      expect(n / draws, `floor ${floor}: ${top}`).toBeLessThan(1 / 6);
    }
  }, 30_000);
});
