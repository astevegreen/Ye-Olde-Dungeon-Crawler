import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { MovementAction } from '../../actions/movement';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { listAltarOfferings, isAltarSpent, PerformAltarRiteAction, getAltarDefinition, performAltarRite } from '../altars';
import { COTW_MAGIC } from '../../../content/cotw/magic';
import { COTW_SPELLS } from '../../../content/cotw/spells';
import { COTW_ESSENCE_RUNES } from '../../../content/cotw/items/essences';

describe('Spell altars', () => {
  let engine: GameEngine;
  let player: Player;
  const ALTAR_X = 6;
  const ALTAR_Y = 5;

  const giveEssence = (itemId: string) => {
    const def = COTW_ESSENCE_RUNES.find((d) => d.id === itemId)!;
    player.inventory.primaryPack.addItem(createScaledItem(def, `${itemId}-${Math.random()}`, 1, () => 0.5));
  };
  const altar = (id: string) => getAltarDefinition(engine, id)!;

  beforeEach(() => {
    player = new Player({
      position: { x: 5, y: 5 },
      mana: 50,
      maxMana: 50,
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      spellsKnown: ['magic_arrow', 'firebolt', 'slow'],
      grimoireOpenSlots: [1, 3, 4, 5, 7],
    });
    engine = new GameEngine({
      map: new GameMap(15, 15, TILES.FLOOR),
      player,
      manifest: {
        id: 'test_pack',
        name: 'Test Pack',
        spells: COTW_SPELLS,
        monsters: [],
        items: COTW_ESSENCE_RUNES,
        magic: COTW_MAGIC,
      } as any,
      seed: 7,
    });
  });

  it('offers known spells and carried essences with their counts', () => {
    giveEssence('essence_isa');
    giveEssence('essence_isa');
    const offerings = listAltarOfferings(engine, player);
    expect(offerings.filter((o) => o.kind === 'spell').map((o) => o.id)).toEqual(['magic_arrow', 'firebolt', 'slow']);
    expect(offerings.find((o) => o.id === 'essence_isa')).toMatchObject({ kind: 'essence', element: 'cold', count: 2 });
  });

  it("inscribes an essence's glyph on a slot, consumes it, and spends the altar", () => {
    giveEssence('essence_isa');
    const res = new PerformAltarRiteAction(player, 'galdr_altar_tyr', ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slotIndex: 3,
    }).perform(engine);

    expect(res.success).toBe(true);
    expect(res.cost).toBeGreaterThan(0);
    expect(player.grimoire[3].infusedGlyphs).toEqual([{ glyphId: 'isa', potency: 1, sourceName: 'Isa Essence-Rune' }]);
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(false);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(true);

    giveEssence('essence_isa');
    const again = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slotIndex: 1,
    });
    expect(again.success).toBe(false);
  });

  it('burns a spell offered at an inscribing altar, using its school for the glyph', () => {
    const outcome = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'spell',
      offeringId: 'slow',
      slotIndex: 1,
    });
    expect(outcome.success).toBe(true);
    expect(player.spellsKnown).not.toContain('slow');
    expect(player.grimoire[1].infusedGlyphs![0].glyphId).toBe('binding'); // Enchantment school
  });

  it('refuses to inscribe a sealed slot and burns nothing', () => {
    giveEssence('essence_isa');
    const outcome = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slotIndex: 0,
    });
    expect(outcome.success).toBe(false);
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(true);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(false);
  });

  it('forges a spell with an essence of another element into its hybrid, in place', () => {
    giveEssence('essence_isa');
    const slot = player.grimoire.findIndex((s) => s.spellId === 'firebolt');
    const quick = player.quickSpells.indexOf('firebolt');

    const outcome = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      targetSpellId: 'firebolt',
    });

    expect(outcome.success).toBe(true);
    expect(player.spellsKnown).not.toContain('firebolt');
    expect(player.spellsKnown).toContain('steam_lance');
    expect(player.grimoire[slot].spellId).toBe('steam_lance');
    expect(player.quickSpells[quick]).toBe('steam_lance');
  });

  it('refuses a forge with no recipe and burns nothing', () => {
    giveEssence('essence_kenaz');
    const outcome = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_kenaz',
      targetSpellId: 'firebolt', // fire + fire
    });
    expect(outcome.success).toBe(false);
    expect(player.spellsKnown).toContain('firebolt');
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_kenaz')).toBe(true);
  });

  it('grounds an offering into a sealed corner, opening it, and clears debt', () => {
    giveEssence('essence_kenaz');
    player.voidDebt = 20;
    const outcome = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_kenaz',
      slotIndex: 0,
    });
    expect(outcome.success).toBe(true);
    expect(player.isGrimoireSlotOpen(0)).toBe(true);
    expect(player.grimoireGrounds[0]).toBe('fire');
    expect(player.voidDebt).toBe(0);
  });

  it('gambles an offering away for a spell, a doubled glyph, or debt', () => {
    giveEssence('essence_ansuz');
    const knownBefore = player.spellsKnown.length;
    const outcome = performAltarRite(engine, player, altar('galdr_altar_loki'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_ansuz',
    });
    expect(outcome.success).toBe(true);
    const learned = player.spellsKnown.length > knownBefore;
    const doubled = player.grimoire.some((s) => s.infusedGlyphs?.some((g) => g.potency === 2));
    expect(learned || doubled || player.voidDebt > 0).toBe(true);
  });

  it('announces an unspent altar when the player steps onto it, and names a spent one', () => {
    const tile = { ...TILES.FLOOR, type: 'galdr_altar_tyr', interactionHandlerId: 'galdr_altar_tyr' };
    engine.map.setTile(ALTAR_X, ALTAR_Y, tile as any);
    const capture = engine.beginEventCapture();

    new MovementAction(player, 1, 0).perform(engine);
    expect(capture.some((e) => e.type === 'altar_reached' && e.data?.altarId === 'galdr_altar_tyr')).toBe(true);

    engine.setWorldFlag(`altar_spent:${engine.currentFloor}:${ALTAR_X}:${ALTAR_Y}`, true);
    new MovementAction(player, -1, 0).perform(engine);
    const later = engine.beginEventCapture();
    new MovementAction(player, 1, 0).perform(engine);
    expect(later.some((e) => e.type === 'altar_reached')).toBe(false);
  });
});
