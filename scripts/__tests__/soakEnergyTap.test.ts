import type { Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { readMagic, tapMagic } from '../../e2e/soak/magicTap';

/**
 * The soak's magic tap (e2e/soak/magicTap.ts) counts every actor's energy spends per floor, and
 * those dearer than the energy banked. Run here on a stand-in engine: the tap's page function
 * only touches `window`, so a page whose `evaluate` calls it straight away runs the real code.
 */

// Stand-ins for the engine's entity classes: the method lives on the base, as on `Entity`.
class Actor {
  constructor(public energy: number) {}
  consumeEnergy(amount: number): number {
    this.energy -= amount;
    return this.energy;
  }
}
class Hero extends Actor {
  spellsKnown: string[] = [];
  voidDebt = 0;
  x = 0;
  y = 0;
}

const page = { evaluate: async (fn: () => unknown) => fn() } as unknown as Page;
const engine = (player: Hero, currentFloor: number) => ({
  player,
  currentFloor,
  turnCount: 0,
  manifest: {},
  map: { width: 0, height: 0, getTile: () => undefined },
  handlePlayerAction: () => ({ success: true, cost: 100 }),
  onGameEvent: () => undefined,
});

describe('soak energy tap', () => {
  it('counts actions, the ones in debt and the energy the old floor forgave, per floor, for hero and foes', async () => {
    const hero = new Hero(50);
    const foe = new Actor(150);
    const w: any = { __cotwEngine: engine(hero, 3) };
    vi.stubGlobal('window', w);
    await tapMagic(page);

    // The wrapped call returns what the original returns and leaves the same energy.
    expect(hero.consumeEnergy(100)).toBe(-50); // 50 banked: 50 into debt
    expect(hero.energy).toBe(-50);
    hero.consumeEnergy(100); // already in debt: all 100 forgiven by the old floor
    foe.consumeEnergy(100); // 150 banked: no debt
    expect(foe.energy).toBe(50);

    // A new engine on the same classes (a load, a new floor) re-taps without wrapping twice.
    w.__cotwEngine = engine(hero, 0);
    await tapMagic(page);
    hero.energy = 100;
    hero.consumeEnergy(100);

    const magic = await readMagic(page);
    expect(magic?.energy).toEqual({
      '3': { hero: { actions: 2, debt: 2, debtEnergy: 150 }, foes: { actions: 1, debt: 0, debtEnergy: 0 } },
      '0': { hero: { actions: 1, debt: 0, debtEnergy: 0 }, foes: { actions: 0, debt: 0, debtEnergy: 0 } },
    });
  });
});
