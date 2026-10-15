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
import { COTW_GRIMOIRES } from '../../../content/cotw/grimoires';
import { isSlotDoubled, slotOfSpell } from '../grimoires';

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
      grimoireSystem: COTW_GRIMOIRES,
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

  it("doubles one slot's lend for an essence, consumes it, and spends the altar", () => {
    giveEssence('essence_isa');
    const slot = slotOfSpell(player.grimoireState!, 'firebolt')!;
    const res = new PerformAltarRiteAction(player, 'galdr_altar_tyr', ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slot,
    }).perform(engine);

    expect(res.success).toBe(true);
    expect(res.cost).toBeGreaterThan(0);
    expect(res.message).toContain('Firebolt');
    expect(isSlotDoubled(player.grimoireState!, slot)).toBe(true);
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(false);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(true);

    giveEssence('essence_isa');
    const again = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slot: slotOfSpell(player.grimoireState!, 'slow')!,
    });
    expect(again.success).toBe(false);
  });

  it('burns a spell offered to double another slot', () => {
    const slot = slotOfSpell(player.grimoireState!, 'magic_arrow')!;
    const outcome = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'spell',
      offeringId: 'slow',
      slot,
    });
    expect(outcome.success).toBe(true);
    expect(player.spellsKnown).not.toContain('slow');
    expect(isSlotDoubled(player.grimoireState!, slot)).toBe(true);
  });

  it("refuses an empty slot, or the offered spell's own, and burns nothing", () => {
    giveEssence('essence_isa');
    const empty = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slot: { grimoireId: 'sol', x: 0, y: 0 },
    });
    expect(empty.success).toBe(false);
    const own = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'spell',
      offeringId: 'slow',
      slot: slotOfSpell(player.grimoireState!, 'slow')!,
    });
    expect(own.success).toBe(false);
    expect(player.spellsKnown).toContain('slow');
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(true);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(false);
  });

  it('forges a spell with an essence of another element into its hybrid, in place', () => {
    giveEssence('essence_isa');
    const slot = slotOfSpell(player.grimoireState!, 'firebolt');
    const quick = player.quickSpells.indexOf('firebolt');

    const outcome = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      targetSpellId: 'firebolt',
    });

    expect(outcome.success).toBe(true);
    expect(player.spellsKnown).not.toContain('firebolt');
    expect(player.spellsKnown).toContain('steam_lance');
    expect(slotOfSpell(player.grimoireState!, 'steam_lance')).toEqual(slot);
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

  it("clears the hero's debt at Hel's altar", () => {
    giveEssence('essence_kenaz');
    player.voidDebt = 20;
    const outcome = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_kenaz',
    });
    expect(outcome.success).toBe(true);
    expect(player.voidDebt).toBe(0);
  });

  it('gambles an offering away for a spell, a doubled lend, or debt', () => {
    giveEssence('essence_ansuz');
    const knownBefore = player.spellsKnown.length;
    const outcome = performAltarRite(engine, player, altar('galdr_altar_loki'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_ansuz',
    });
    expect(outcome.success).toBe(true);
    const learned = player.spellsKnown.length > knownBefore;
    const doubled = player.grimoireState!.doubledSlots.length > 0;
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
