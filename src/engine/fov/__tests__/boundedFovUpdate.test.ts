import { describe, it, expect } from 'vitest';
import { FovManager } from '../fov-manager';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Visibility } from '../types';

/**
 * FOV updates demote only what the previous pass lit, not the whole map
 * (ARCHITECTURE.md §6). The behaviour must be identical to the old full sweep — the point
 * is cost, not semantics — so these check both.
 */
const bigMap = () => new GameMap(120, 120, TILES.FLOOR);

describe('Bounded fog-of-war update', () => {
  it('demotes tiles that left view, and keeps them explored', () => {
    const map = bigMap();
    const fov = new FovManager(120, 120);

    fov.update(map, 10, 10, 4);
    expect(fov.isVisible(10, 10)).toBe(true);

    fov.update(map, 80, 80, 4);

    expect(fov.isVisible(10, 10)).toBe(false);
    expect(fov.isExplored(10, 10)).toBe(true);
    expect(fov.isVisible(80, 80)).toBe(true);
  });

  it('touches a number of tiles that tracks the view, not the map', () => {
    const map = bigMap();
    const fov = new FovManager(120, 120);

    fov.update(map, 60, 60, 4);
    const lit = fov.lastDemotedTiles; // first pass had nothing to demote
    fov.update(map, 61, 60, 4);

    expect(lit).toBe(0);
    // A radius-4 view is at most ~81 tiles; the map is 14,400. The old sweep touched all of it.
    expect(fov.lastDemotedTiles).toBeGreaterThan(0);
    expect(fov.lastDemotedTiles).toBeLessThan(200);
  });

  it('still demotes everything after a bulk reveal', () => {
    const map = bigMap();
    const fov = new FovManager(120, 120);

    fov.revealAll();
    expect(fov.isVisible(5, 90)).toBe(true);

    fov.update(map, 10, 10, 3);

    // A tile revealed in bulk and now out of view must fall back to explored, not stay lit.
    expect(fov.isVisible(5, 90)).toBe(false);
    expect(fov.isExplored(5, 90)).toBe(true);
  });

  it('demotes a tile marked visible directly through setVisibility', () => {
    const map = bigMap();
    const fov = new FovManager(120, 120);

    fov.setVisibility(40, 40, Visibility.Visible);
    fov.update(map, 10, 10, 3);

    expect(fov.isVisible(40, 40)).toBe(false);
    expect(fov.isExplored(40, 40)).toBe(true);
  });

  it('matches a full-sweep reference implementation over a walk', () => {
    const map = bigMap();
    const bounded = new FovManager(120, 120);
    const reference = new FovManager(120, 120);

    for (let step = 0; step < 12; step++) {
      const x = 20 + step * 3;
      bounded.update(map, x, 30, 5);
      // Reference: force the full-sweep path every turn.
      reference.revealAll();
      for (let y = 0; y < 120; y++) for (let xx = 0; xx < 120; xx++) reference.setVisibility(xx, y, Visibility.Explored);
      reference.update(map, x, 30, 5);
    }

    for (let y = 25; y < 40; y++) {
      for (let x = 45; x < 65; x++) {
        expect(bounded.isVisible(x, y)).toBe(reference.isVisible(x, y));
      }
    }
  });
});
