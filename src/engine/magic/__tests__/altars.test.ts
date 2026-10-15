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
import { forgedElements, forgedTitle, isSlotDoubled, readGrimoireState, serializeGrimoireState, slotOfSpell } from '../grimoires';
import { applyConsequences } from '../../actions/choiceAction';
import { ClaimForgeOfferAction } from '../../actions/spell-actions';
import { describeAction } from '../../debug/actionTrail';
import { rebuildAction } from '../../debug/replay';

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

  it('forges an essence’s element onto a known spell, which keeps its slot and is titled by the pair', () => {
    giveEssence('essence_isa');
    const slot = slotOfSpell(player.grimoireState!, 'firebolt');

    const outcome = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      targetSpellId: 'firebolt',
    });

    expect(outcome.success).toBe(true);
    expect(outcome.message).toContain('Firebolt, steam-forged');
    expect(player.spellsKnown).toContain('firebolt');
    expect(slotOfSpell(player.grimoireState!, 'firebolt')).toEqual(slot);
    expect(forgedElements(player.grimoireState!, 'firebolt')).toEqual(['cold']);
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(false);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(true);
  });

  it('burns a known spell as the element it brings, and a re-forge swaps the added element', () => {
    player.forgeSpell('firebolt', 'cold');
    const outcome = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'spell',
      offeringId: 'magic_arrow',
      targetSpellId: 'firebolt',
    });
    expect(outcome.success).toBe(true);
    expect(player.spellsKnown).not.toContain('magic_arrow');
    expect(forgedElements(player.grimoireState!, 'firebolt')).toEqual(['arcane']);
    expect(outcome.message).toContain('Firebolt, rune-forged');
  });

  it('keeps an element fate gave through a re-forge', () => {
    player.forgeSpell('firebolt', 'healing', 'of Renewal');
    giveEssence('essence_isa');
    performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      targetSpellId: 'firebolt',
    });
    expect(forgedElements(player.grimoireState!, 'firebolt')).toEqual(['healing', 'cold']);
    expect(forgedTitle(COTW_GRIMOIRES, player.grimoireState!, { id: 'firebolt', name: 'Firebolt', element: 'fire' })).toBe('Firebolt, of Renewal, steam-forged');
  });

  it('refuses an element the spell already carries, and a spell forged with itself, burning nothing', () => {
    giveEssence('essence_kenaz');
    const same = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_kenaz',
      targetSpellId: 'firebolt', // fire + fire
    });
    const self = performAltarRite(engine, player, altar('galdr_altar_odin'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'spell',
      offeringId: 'firebolt',
      targetSpellId: 'firebolt',
    });
    expect(same.success).toBe(false);
    expect(self.success).toBe(false);
    expect(player.spellsKnown).toContain('firebolt');
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_kenaz')).toBe(true);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(false);
  });

  describe('free forge offers', () => {
    it('a choice’s free forge waits, saves, and forges any essence element onto the spell picked', () => {
      applyConsequences([{ type: 'offerForge', source: 'Ivalda’s forge' }], engine, player);
      expect(player.pendingForgeOffers).toEqual([{ source: 'Ivalda’s forge' }]);
      expect(readGrimoireState(JSON.parse(JSON.stringify(serializeGrimoireState(player.grimoireState!))))?.forgeOffers).toEqual([{ source: 'Ivalda’s forge' }]);

      const claim = new ClaimForgeOfferAction(player, 0, 'firebolt', 'cold');
      expect(rebuildAction(engine, { seq: 0, turn: 0, floor: 1, ...describeAction(claim) })).toMatchObject({ offerIndex: 0, spellId: 'firebolt', element: 'cold' });
      const res = claim.perform(engine);
      expect(res).toMatchObject({ success: true, cost: 0 });
      expect(forgedElements(player.grimoireState!, 'firebolt')).toEqual(['cold']);
      expect(player.pendingForgeOffers).toEqual([]);
      expect(engine.messages.some((m) => m.includes('Firebolt, steam-forged'))).toBe(true);
    });

    it('a fated forge adds only its element, refuses a spell that carries it, and titles by fate', () => {
      player.offerForge({ source: 'Skuld’s mirror', element: 'healing', fated: 'of Renewal' });
      expect(new ClaimForgeOfferAction(player, 0, 'firebolt', 'cold').perform(engine).success).toBe(false);
      player.forgeSpell('firebolt', 'healing');
      expect(new ClaimForgeOfferAction(player, 0, 'firebolt', 'healing').perform(engine).success).toBe(false);
      expect(new ClaimForgeOfferAction(player, 1, 'slow', 'healing').perform(engine).success).toBe(false);
      expect(player.pendingForgeOffers).toHaveLength(1);

      expect(new ClaimForgeOfferAction(player, 0, 'magic_arrow', 'healing').perform(engine).success).toBe(true);
      expect(forgedTitle(COTW_GRIMOIRES, player.grimoireState!, { id: 'magic_arrow', name: 'Magic Arrow', element: 'arcane' })).toBe('Magic Arrow, of Renewal');
      expect(player.pendingForgeOffers).toEqual([]);
    });

    it('a hero without grimoires is offered nothing', () => {
      const plain = new Player({ position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
      expect(plain.offerForge({ source: 'Ivalda’s forge' })).toBe(false);
      expect(plain.pendingForgeOffers).toEqual([]);
    });
  });

  describe("Hel's Grave-Altar", () => {
    beforeEach(() => {
      player.assignGrimoireStat('mani', 'x', 'power');
    });

    it('re-picks one grimoire\'s stats on 7 and 19, free, and clears the debt', () => {
      engine.currentFloor = 7;
      player.voidDebt = 20;
      expect(altar('galdr_altar_hel').rite).toBe('restat');
      const mani = player.grimoireState!.statPicks.find((p) => p.grimoireId === 'mani');
      expect(mani?.statId).toBe('power');
      const res = new PerformAltarRiteAction(player, 'galdr_altar_hel', ALTAR_X, ALTAR_Y, {
        restat: { grimoireId: 'mani', stats: { x: 'swift' } },
      }).perform(engine);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Máni');
      expect(player.grimoireState!.statPicks).toEqual([{ grimoireId: 'mani', axis: 'x', statId: 'swift' }]);
      expect(player.voidDebt).toBe(0);
      expect(player.spellsKnown).toEqual(['magic_arrow', 'firebolt', 'slow']);
      expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(true);
    });

    it('a re-pick and an added slot record for replay, and rebuild', () => {
      const rebuild = (action: PerformAltarRiteAction) => rebuildAction(engine, { seq: 0, turn: 0, floor: 7, ...describeAction(action) });
      const restat = new PerformAltarRiteAction(player, 'galdr_altar_hel', ALTAR_X, ALTAR_Y, { restat: { grimoireId: 'mani', stats: { x: 'range' } } });
      expect(rebuild(restat)).toMatchObject({ altarId: 'galdr_altar_hel', restat: { grimoireId: 'mani', x: 'range' } });
      const add = new PerformAltarRiteAction(player, 'galdr_altar_hel', ALTAR_X, ALTAR_Y, { slot: { grimoireId: 'mani', x: 0, y: 1 } });
      expect(rebuild(add)).toMatchObject({ slot: { grimoireId: 'mani', x: 0, y: 1 }, offeringKind: undefined });
    });

    it('refuses a re-pick that leaves an axis bare or takes a stat twice, and stays unspent', () => {
      engine.currentFloor = 19;
      player.voidDebt = 20;
      const bare = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X, ALTAR_Y, { restat: { grimoireId: 'mani', stats: {} } });
      expect(bare.success).toBe(false);
      const wrongAxis = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X, ALTAR_Y, {
        restat: { grimoireId: 'mani', stats: { x: 'range', y: 'area' } },
      });
      expect(wrongAxis.success).toBe(false);
      expect(player.grimoireState!.statPicks[0].statId).toBe('power');
      expect(player.voidDebt).toBe(20);
      expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(false);
    });

    it('adds a slot on 31 and 43, beyond the outline too, and clears the debt', () => {
      engine.currentFloor = 31;
      player.voidDebt = 5;
      expect(altar('galdr_altar_hel').rite).toBe('addSlot');
      const outcome = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X, ALTAR_Y, { slot: { grimoireId: 'mani', x: 2, y: 0 } });
      expect(outcome.success).toBe(true);
      expect(player.grimoireState!.extraSlots).toEqual([{ grimoireId: 'mani', x: 2, y: 0 }]);
      expect(player.voidDebt).toBe(0);

      engine.currentFloor = 43;
      const apart = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X + 1, ALTAR_Y, { slot: { grimoireId: 'mani', x: 0, y: 2 } });
      expect(apart.success).toBe(false);
      const below = performAltarRite(engine, player, altar('galdr_altar_hel'), ALTAR_X + 1, ALTAR_Y, { slot: { grimoireId: 'mani', x: 0, y: 1 } });
      expect(below.success).toBe(true);
      expect(player.grimoireState!.extraSlots).toHaveLength(2);
    });
  });

  it('Týr waits while no two spells touch: it says so, opens nothing and stays unspent', () => {
    for (const id of ['firebolt', 'slow']) player.forgetSpell(id);
    giveEssence('essence_isa');
    const tile = { ...TILES.FLOOR, type: 'galdr_altar_tyr', interactionHandlerId: 'galdr_altar_tyr' };
    engine.map.setTile(ALTAR_X, ALTAR_Y, tile as any);
    const capture = engine.beginEventCapture();
    new MovementAction(player, 1, 0).perform(engine);
    expect(capture.some((e) => e.type === 'altar_reached')).toBe(false);

    const outcome = performAltarRite(engine, player, altar('galdr_altar_tyr'), ALTAR_X, ALTAR_Y, {
      offeringKind: 'essence',
      offeringId: 'essence_isa',
      slot: slotOfSpell(player.grimoireState!, 'magic_arrow')!,
    });
    expect(outcome.success).toBe(false);
    expect(outcome.message).toContain('waits');
    expect(listAltarOfferings(engine, player).some((o) => o.id === 'essence_isa')).toBe(true);
    expect(isAltarSpent(engine, ALTAR_X, ALTAR_Y)).toBe(false);
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
