import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine, GameMap, Item, Player, getAltarDefinition } from '../../engine';
import { COTW_ESSENCE_RUNES } from '../../content/cotw/items/essences';
import { COTW_MAGIC } from '../../content/cotw/magic';
import { COTW_GRIMOIRES } from '../../content/cotw/grimoires';
import { COTW_SPELLS } from '../../content/cotw/spells';
import { AltarModal } from '../altarModal';

// Node tests: the modal draws into a stand-in scrim whose innerHTML is its markup.
class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  appendChild(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
}

describe('AltarModal', () => {
  let originalDocument: unknown;
  let scrim: MockElement;
  let engine: GameEngine;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    scrim = new MockElement();
    (globalThis as any).document = {
      getElementById: (id: string) => (id === 'altar-modal-overlay' ? scrim : null),
      createElement: () => scrim,
    };
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      spellsKnown: ['magic_arrow', 'firebolt'],
      grimoireSystem: COTW_GRIMOIRES,
    });
    engine = new GameEngine({
      map: new GameMap(15, 15),
      player,
      manifest: { id: 'test_pack', name: 'Test Pack', spells: COTW_SPELLS, monsters: [], items: COTW_ESSENCE_RUNES, magic: COTW_MAGIC } as any,
    });
    const def = COTW_ESSENCE_RUNES.find((d) => d.id === 'essence_kenaz')!;
    for (let i = 0; i < 3; i++) {
      player.inventory.primaryPack.addItem(
        new Item({ id: `kenaz-${i}`, name: def.name, category: 'quest', definitionId: def.id, weight: def.weight, bulk: def.bulk, quality: 'normal', identified: true, value: 0 })
      );
    }
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  const open = (altarId: string) => {
    const modal = new AltarModal();
    modal.open(engine, getAltarDefinition(engine, altarId)!, () => {}, () => {});
    return modal;
  };

  it('lists each placed spell as a slot to double, with its grimoire and place', () => {
    open('galdr_altar_tyr');
    expect(scrim.innerHTML.match(/data-slot="mani\|/g)).toHaveLength(2);
    expect(scrim.innerHTML).toContain('Firebolt');
    expect(scrim.innerHTML).toContain('Slot whose lend is doubled');
  });

  it('says up front what burning costs, and names a rune by its own name', () => {
    open('galdr_altar_tyr');
    expect(scrim.innerHTML).toContain('you forget it for good');
    expect(scrim.innerHTML).toContain('that one is used up');
    expect(scrim.innerHTML).toContain('Kenaz Essence-Rune');
    expect(scrim.innerHTML).toContain('essence · fire ×3');
    expect(scrim.innerHTML).toContain('spell · ');
  });

  it("asks Hel no offering, and re-picks a grimoire's stats on the upper floors", () => {
    engine.currentFloor = 7;
    engine.player.assignGrimoireStat('mani', 'x', 'power');
    const modal = open('galdr_altar_hel') as any;
    expect(scrim.innerHTML).not.toContain('Offering to burn');
    expect(scrim.innerHTML).toContain('data-restat-grimoire="mani"');
    expect(modal.request()).toBeUndefined();
    modal.restat = { grimoireId: 'mani', stats: { x: 'power' } };
    expect(modal.preview().text).toContain('keeps the stats it has');
    modal.restat = { grimoireId: 'mani', stats: { x: 'range' } };
    modal.render();
    expect(scrim.innerHTML).toContain('across <b>Range</b>');
    expect(modal.request()).toEqual({ restat: { grimoireId: 'mani', stats: { x: 'range' } } });
  });

  it("offers Hel's deeper altars a place for a new slot, beyond the outline too", () => {
    engine.currentFloor = 31;
    const modal = open('galdr_altar_hel') as any;
    expect(scrim.innerHTML).toContain('Where the new slot goes');
    expect(scrim.innerHTML).toContain('Máni · Right, 2 out');
    expect(scrim.innerHTML).toContain('beside Firebolt');
    modal.slot = { grimoireId: 'mani', x: 0, y: 1 };
    expect(modal.preview().text).toContain('first to reach down');
    expect(modal.request()).toEqual({ slot: { grimoireId: 'mani', x: 0, y: 1 } });
  });

  it("names both kinds of offering in each of the pack's altar descriptions that takes one", () => {
    for (const altar of COTW_MAGIC.altars!.filter((a) => !a.free)) {
      expect(altar.description, altar.id).toContain('a spell you know or an Essence-Rune');
    }
  });
});
