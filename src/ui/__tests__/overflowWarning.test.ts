import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { OverflowWarning } from '../overflowWarning';

function engineWith(overflow: boolean, mana = 2): GameEngine {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 } });
  player.mana = mana;
  const manifest = {
    id: 'test_pack',
    name: 'Test',
    manaTerms: { name: 'Seiðr', unit: 'Seiðr' },
    magic: overflow ? { overflow: { debtName: 'Void Debt', tiers: [] } } : {},
  } as any;
  return new GameEngine({ map: new GameMap(5, 5, TILES.FLOOR), player, manifest, floor: 1 });
}

/** An overflow pack with a worst tier at 16 that lingers, and a hero 3 short of a 5-cost cast. */
function worstTierEngine(debt: number): GameEngine {
  const engine = engineWith(true);
  const tier = (minDebt: number, label: string) => ({ minDebt, label, color: '#fff', burstRadius: 1, burstDurationMs: 1, outcomes: [] });
  (engine.manifest as any).magic.overflow = {
    debtName: 'Void Debt',
    lingeringDebt: 16,
    tiers: [tier(1, 'Tier 1'), tier(6, 'Tier 2'), tier(16, 'Tier 3 Scar')],
  };
  engine.player.voidDebt = debt;
  return engine;
}

// Casting short of mana in an overflow pack draws debt and may surge (N38). The first such
// cast on each floor is held back with a warning; casting again goes ahead.
describe('the overflow warning', () => {
  it('holds the first short cast on a floor with a warning, then lets the next through', () => {
    const engine = engineWith(true);
    const warn = new OverflowWarning();
    const first = warn.check(engine, 5);
    expect(first).toContain('3');
    expect(first).toContain('Void Debt');
    expect(first).toContain('again');
    expect(warn.check(engine, 5)).toBeNull();

    engine.currentFloor = 2;
    expect(warn.check(engine, 5)).not.toBeNull();
  });

  it('says nothing when the mana covers the cost, or the pack has no overflow', () => {
    expect(new OverflowWarning().check(engineWith(true, 9), 5)).toBeNull();
    expect(new OverflowWarning().check(engineWith(false), 5)).toBeNull();
  });

  it('holds a cast that crosses into the worst tier every time, even after the floor warned', () => {
    const engine = worstTierEngine(14);
    const warn = new OverflowWarning();
    const first = warn.check(engine, 5);
    expect(first).toContain('from 14 to 17');
    expect(first).toContain('Tier 3 Scar');
    expect(first).toContain('resting in the dungeon will not lower it');
    expect(warn.check(engine, 5)).toBeNull();

    // The floor's first warning is spent; a later crossing still warns.
    engine.player.voidDebt = 13;
    expect(warn.check(engine, 5)).toContain('from 13 to 16');
    expect(warn.check(engine, 5)).toBeNull();
  });

  it('gives the floor warning, not the worst-tier one, for a cast that stays below it or starts in it', () => {
    const warn = new OverflowWarning();
    expect(warn.check(worstTierEngine(2), 5)).toContain('may surge');
    const deep = new OverflowWarning();
    expect(deep.check(worstTierEngine(16), 5)).toContain('may surge');
  });

  it('skips the worst-tier warning when worn gear keeps the cast from adding debt', () => {
    const engine = worstTierEngine(14);
    (engine.player as any).perkModifiers = [{ id: 'void_kissed', name: 'Void-Kissed', overflowNoDebt: true }];
    const warn = new OverflowWarning();
    expect(warn.check(engine, 5)).toContain('may surge');
  });

  it('starts over for a new game', () => {
    const warn = new OverflowWarning();
    warn.check(engineWith(true), 5);
    warn.reset();
    expect(warn.check(engineWith(true), 5)).not.toBeNull();
  });
});
