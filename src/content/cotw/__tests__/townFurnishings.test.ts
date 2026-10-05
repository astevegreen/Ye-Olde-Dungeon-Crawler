import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { NPC } from '../../../engine/entities/npc';
import { WaitAction } from '../../../engine/actions/wait';
import { cotwManifest } from '../index';
import { TOWN_FURNISHINGS, TOWN_LEGEND, TOWN_ROWS } from '../townLayout';
import { COTW_TILES } from '../tiles';

/** Tracker 4.9: one tell per town service (N14), and towns saved before them get them too. */
describe('town furnishings', () => {
  it('the layout places each one, a cotw tile with art', () => {
    for (const f of TOWN_FURNISHINGS) {
      expect(TOWN_ROWS[f.y][f.x], `${f.glyph} at ${f.x},${f.y}`).toBe(f.glyph);
      const type = TOWN_LEGEND[f.glyph];
      expect(COTW_TILES.some((t) => t.type === type), type).toBe(true);
      expect(typeof cotwManifest.spriteRecipes?.[`${type}~prop`], type).toBe('function');
    }
  });

  it('a town saved without them gets them on the hero\'s next turn there, never under someone', () => {
    // The old town: plain floor where the furnishings now stand.
    const map = new GameMap(56, 36, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Sven', position: { x: 30, y: 15 } });
    const engine = new GameEngine({ map, player, floor: 0, manifest: cotwManifest });
    const [first, second] = TOWN_FURNISHINGS;
    map.addEntity(new NPC({ id: 'npc-in-the-way', name: 'Loiterer', position: { x: second.x, y: second.y }, role: 'villager' }));

    engine.handlePlayerAction(new WaitAction(player));

    expect(map.getTile(first.x, first.y)?.type).toBe(TOWN_LEGEND[first.glyph]);
    expect(map.getTile(second.x, second.y)?.type).toBe('floor');
    for (const f of TOWN_FURNISHINGS.slice(2)) expect(map.getTile(f.x, f.y)?.type).toBe(TOWN_LEGEND[f.glyph]);
  });

  it('leaves the dungeon alone', () => {
    const map = new GameMap(56, 36, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Sven', position: { x: 30, y: 15 } });
    const engine = new GameEngine({ map, player, floor: 3, manifest: cotwManifest });
    engine.handlePlayerAction(new WaitAction(player));
    expect(TOWN_FURNISHINGS.every((f) => map.getTile(f.x, f.y)?.type === 'floor')).toBe(true);
  });
});
