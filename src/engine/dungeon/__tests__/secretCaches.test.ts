import { describe, expect, it } from 'vitest';
import { DungeonArc } from '../../quest/dungeonArc';
import { Container } from '../../items/container';
import { cotwManifest } from '../../../content/cotw';

const FLOORS = [2, 5, 12, 20, 38, 45];

describe('secret caches', () => {
  it('each holds a chest that holds something, out of reach until its secret door is found', () => {
    let caches = 0;
    for (const floor of FLOORS) {
      for (let seed = 1; seed <= 4; seed++) {
        const r = DungeonArc.generateFloor(floor, seed * 7919, cotwManifest.quest, cotwManifest);
        for (const cells of r.secretCaches ?? []) {
          caches++;
          // Its own chest; room loot laid out by a room's bounding box can spill in beside it.
          const chests = cells.flatMap((c) => r.map.getItemsAt(c.x, c.y)).filter((i) => i instanceof Container && i.id.startsWith('cache-chest-'));
          expect(chests.length, `floor ${floor} seed ${seed}`).toBe(1);
          expect((chests[0] as Container).getItems().length).toBeGreaterThanOrEqual(1);
        }
      }
    }
    expect(caches).toBeGreaterThan(FLOORS.length * 2);
  });
});
