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

  it('starts over for a new game', () => {
    const warn = new OverflowWarning();
    warn.check(engineWith(true), 5);
    warn.reset();
    expect(warn.check(engineWith(true), 5)).not.toBeNull();
  });
});
