import { describe, it, expect } from 'vitest';
import { COTW_MAGIC } from '../magic';
import { COTW_TILES } from '../tiles';
import { cotwManifest } from '../index';
import { COTW_SPELLS } from '../spells';
import { COTW_ESSENCE_BY_ELEMENT } from '../items/essences';
import { COTW_AFFINITY_MATRIX } from '../elements';
import { SKALDIC_RUNESTONE_LORE } from '../runestones';

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

  it('never places two altars, or an altar and a story altar, on one floor', () => {
    const floors = placements.map((p) => p.floor);
    expect(new Set(floors).size).toBe(floors.length);
  });

  it('refunds every old glyph as an Essence-Rune that exists', () => {
    const essences = new Set(Object.values(COTW_ESSENCE_BY_ELEMENT));
    const runes = Object.values(COTW_MAGIC.grimoires?.retired?.glyphRunes ?? {});
    expect(runes.length).toBeGreaterThan(0);
    for (const itemId of runes) expect(essences.has(itemId), itemId).toBe(true);
  });

  it('names forgings, and has the runestones tell of them, by elements that exist', () => {
    const elements = (COTW_AFFINITY_MATRIX.elements ?? []).map((e) => e.id);
    const titled = Object.keys(COTW_MAGIC.grimoires?.forging?.titles ?? {});
    for (const pair of titled) expect(pair, pair).toBe(pair.split('+').filter((e) => elements.includes(e)).sort().join('+'));
    const told = SKALDIC_RUNESTONE_LORE.flatMap((l) => (l.forgePair ? [[...l.forgePair].sort().join('+')] : []));
    expect(told).toHaveLength(5);
    for (const pair of told) expect(titled, pair).toContain(pair);
  });

  it('carries each retired spell over to a spell that exists, forged with an element that exists', () => {
    const ids = new Set(COTW_SPELLS.map((s) => s.id));
    const elements = (COTW_AFFINITY_MATRIX.elements ?? []).map((e) => e.id);
    for (const [old, target] of Object.entries(COTW_MAGIC.grimoires?.retired?.spells ?? {})) {
      if (target === null) continue;
      expect(ids.has(typeof target === 'string' ? target : target.spellId), old).toBe(true);
      if (typeof target !== 'string') expect(elements, old).toContain(target.addedElement);
    }
  });

  it("lets Loki teach only spells that exist", () => {
    const ids = new Set(COTW_SPELLS.map((s) => s.id));
    const loki = altars.find((a) => a.rite === 'gamble')!;
    for (const id of loki.gamble!.spellPool) expect(ids.has(id), id).toBe(true);
  });
});
