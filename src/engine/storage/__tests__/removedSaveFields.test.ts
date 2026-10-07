import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { serializeGame, deserializeGame } from '../serializer';

/**
 * Planes and reactive substances were removed (ADR-0015). A save written before carries a
 * `planes` record and each map's `substances`: it still loads, and those fields are ignored.
 * A save written now carries neither.
 */
describe('saves from before planes and substances were removed', () => {
  function engine() {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    return new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, seed: 9 });
  }

  it('a save written now has no planes or substances', () => {
    const saved = serializeGame(engine()) as unknown as Record<string, unknown> & { map: Record<string, unknown> };
    expect(saved.planes).toBeUndefined();
    expect(saved.map.substances).toBeUndefined();
  });

  it('an older save that has them loads, the hero where it stood', () => {
    const saved = JSON.parse(JSON.stringify(serializeGame(engine())));
    saved.planes = { physical: { id: 'physical', name: 'Physical', driftPhase: 0 } };
    saved.map.substances = [{ x: 3, y: 3, mask: 6 }];

    const { engine: restored } = deserializeGame(saved);

    expect(restored.player.x).toBe(2);
    expect(restored.player.y).toBe(2);
  });
});
