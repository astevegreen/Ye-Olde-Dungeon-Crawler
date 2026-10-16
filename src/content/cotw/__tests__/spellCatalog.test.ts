import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { spellCatalog } from '../../../engine/magic/spellCatalog';
import { cotwManifest } from '../index';

/** 5c: the Spells page lists every spell a cotw hero can learn, each with where it is had. */
describe('the cotw Spells page', () => {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 }, spellsKnown: ['magic_arrow', 'heal_spell'] });
  const engine = new GameEngine({ map: new GameMap(5, 5, TILES.FLOOR), player, manifest: cotwManifest });
  const catalog = spellCatalog(engine)!;

  it('holds every spell a hero can learn, once, and nothing else', () => {
    // Scrolls, tablets' learn spells and the monsters' Lightning Bolt are no hero's to learn.
    const learnable = (cotwManifest.spells ?? [])
      .filter((s) => s.school !== 'Scroll' && s.school !== 'Lore' && s.id !== 'lightning_bolt')
      .map((s) => s.id);
    expect(catalog.map((e) => e.spell.id).sort()).toEqual([...learnable].sort());
  });

  it('says where each is had, and every stone spell has a tablet', () => {
    for (const entry of catalog) {
      expect(entry.floors ?? entry.where, entry.spell.id).toBeTruthy();
      expect(entry.taughtElsewhere, entry.spell.id).toBe(entry.floors !== undefined);
    }
    expect(catalog.find((e) => e.spell.id === 'firebolt')!.floors).toEqual({ min: 4, max: 8 });
  });

  it('knows the start spells, and hides the rest until a stone shows them', () => {
    expect(catalog.filter((e) => e.known).map((e) => e.spell.id)).toEqual(['magic_arrow', 'heal_spell']);
    expect(catalog.filter((e) => e.seen)).toHaveLength(2);
  });
});
