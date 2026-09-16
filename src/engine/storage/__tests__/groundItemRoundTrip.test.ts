import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { CorpseItemInstance } from '../../items/corpse';
import { serializeGame, deserializeGame } from '../serializer';

/**
 * Ground-item piles are keyed plane-qualified (`${planeId}:${x},${y}`, ARCHITECTURE.md §5).
 * `getAllGroundItems()` once split that key on ',' alone, so x parsed as NaN, serialized as
 * null, and every dropped item was silently lost on load.
 */
function buildEngine() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 } });
  return { map, engine: new GameEngine({ map, player, seed: 99 }) };
}

const roundTrip = (engine: GameEngine) => deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine)))).engine;

describe('Ground items survive a save/load round trip', () => {
  it('reports real coordinates for every pile, never NaN', () => {
    const { map } = buildEngine();
    map.addItemAt(6, 7, new Item({ id: 'rock-1', name: 'Rock', category: 'misc', weight: 10, bulk: 10 }));

    const piles = map.getAllGroundItems();

    expect(piles).toHaveLength(1);
    expect(piles[0].x).toBe(6);
    expect(piles[0].y).toBe(7);
    expect(Number.isNaN(piles[0].x)).toBe(false);
  });

  it('restores a dropped item at the same tile', () => {
    const { map, engine } = buildEngine();
    map.addItemAt(6, 7, new Item({ id: 'rock-1', name: 'Rock', category: 'misc', weight: 10, bulk: 10 }));

    const restored = roundTrip(engine);

    expect(restored.map.getItemsAt(6, 7).map((i) => i.id)).toEqual(['rock-1']);
  });

  it('restores a corpse with its archetype and decay intact', () => {
    const { map, engine } = buildEngine();
    map.addItemAt(3, 4, new CorpseItemInstance({ id: 'c1', archetypeId: 'kobold', decayTicksRemaining: 33 }));

    const corpse = roundTrip(engine).map.getItemsAt(3, 4)[0];

    expect(corpse).toBeInstanceOf(CorpseItemInstance);
    expect((corpse as CorpseItemInstance).archetypeId).toBe('kobold');
    expect((corpse as CorpseItemInstance).decayTicksRemaining).toBe(33);
  });
});
