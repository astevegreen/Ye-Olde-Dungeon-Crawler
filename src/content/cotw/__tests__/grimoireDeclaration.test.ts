import { describe, it, expect } from 'vitest';
import { cotwManifest } from '..';
import { COTW_GRIMOIRES } from '../grimoires';
import { validateGrimoireSystem } from '../../../engine/magic/grimoires';
import { validateNeighbourLending } from '../../../engine/magic/neighbourLending';

/**
 * The engine's two pack validators check a declaration the engine itself never inspects at
 * startup, so the pack's own tests are what run them on the shipping tables.
 */
describe('the shipping pack’s magic declarations', () => {
  it('declares sound grimoires', () => {
    expect(validateGrimoireSystem(COTW_GRIMOIRES)).toEqual([]);
  });

  it('declares lending tables every spell’s lends list can find', () => {
    expect(COTW_GRIMOIRES.lending?.flavours.length).toBeGreaterThan(0);
    expect(cotwManifest.spells?.length).toBeGreaterThan(0);

    expect(validateNeighbourLending(COTW_GRIMOIRES.lending!, cotwManifest.spells!)).toEqual([]);
  });
});
