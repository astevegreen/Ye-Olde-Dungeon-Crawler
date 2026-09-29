import { describe, it, expect } from 'vitest';
import { COTW_MAGIC } from '../magic';
import { COTW_TILES } from '../tiles';
import { cotwManifest } from '../index';
import { COTW_SPELLS } from '../spells';
import { COTW_ESSENCE_BY_ELEMENT } from '../items/essences';

describe('cotw runic altars', () => {
  const altars = COTW_MAGIC.altars ?? [];
  const placements = cotwManifest.fixedTilePlacements ?? [];

  it('gives every altar a tile that triggers it and at least one floor', () => {
    for (const altar of altars) {
      const tile = COTW_TILES.find((t) => t.type === altar.id);
      expect(tile?.interactionHandlerId, altar.id).toBe(altar.id);
      expect(placements.some((p) => p.tileId === altar.id), altar.id).toBe(true);
    }
  });

  it("places one Hel's Grave-Altar per sealed corner", () => {
    const sealed = 9 - (COTW_MAGIC.grimoire?.initialOpenSlots?.length ?? 9);
    const hel = altars.find((a) => a.rite === 'ground')!;
    expect(placements.filter((p) => p.tileId === hel.id).length).toBeGreaterThanOrEqual(sealed);
  });

  it('never places two altars, or an altar and a story altar, on one floor', () => {
    const floors = placements.map((p) => p.floor);
    expect(new Set(floors).size).toBe(floors.length);
  });

  it('has a glyph for every essence element', () => {
    for (const element of Object.keys(COTW_ESSENCE_BY_ELEMENT)) {
      expect(COTW_MAGIC.grimoire?.glyphs?.some((g) => g.fromElements?.includes(element)), element).toBe(true);
    }
  });

  it('forges only into real hybrid spells', () => {
    const ids = new Set(COTW_SPELLS.map((s) => s.id));
    for (const recipe of COTW_MAGIC.hybrids ?? []) expect(ids.has(recipe.spellId), recipe.spellId).toBe(true);
  });

  it("lets Loki teach only spells that exist", () => {
    const ids = new Set(COTW_SPELLS.map((s) => s.id));
    const loki = altars.find((a) => a.rite === 'gamble')!;
    for (const id of loki.gamble!.spellPool) expect(ids.has(id), id).toBe(true);
  });
});
