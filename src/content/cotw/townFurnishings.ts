import type { ActionHook } from '../../engine';
import { COTW_TILES } from './tiles';
import { TOWN_FURNISHINGS, TOWN_LEGEND } from './townLayout';

/**
 * The town's service furnishings for a save made before them (N14, tracker 4.9). A new
 * hero's town is laid with them (townLayout.ts); a saved town is stored as it was, so on the
 * hero's next turn in town each missing one is set on its open, unoccupied cell. One pass a
 * turn over eight cells; a cell someone stands on waits for the next turn.
 */
export const COTW_TOWN_FURNISHING_HOOK: ActionHook = {
  id: 'cotw-town-furnishings',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.currentFloor !== 0) return;
    const map = engine.map;
    for (const f of TOWN_FURNISHINGS) {
      const type = TOWN_LEGEND[f.glyph];
      const here = map.getTile(f.x, f.y);
      if (!here || here.type === type || !here.passable) continue;
      if (map.getEntityAt(f.x, f.y) || map.getItemsAt(f.x, f.y).length > 0) continue;
      const tile = COTW_TILES.find((t) => t.type === type);
      if (tile) map.setTile(f.x, f.y, tile);
    }
  },
};
