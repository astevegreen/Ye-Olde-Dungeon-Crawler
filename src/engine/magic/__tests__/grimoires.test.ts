import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES } from '../../../../tests/fixtures/fixture-pack';
import { cotwManifest } from '../../../content/cotw';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Monster } from '../../entities/monster';
import { AcceptSpellOfferAction, ForgetSpellAction, PickGrimoireStatAction, PlaceGrimoireSpellAction } from '../../actions/spell-actions';
import { describeAction } from '../../debug/actionTrail';
import { rebuildAction } from '../../debug/replay';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import {
  grimoireAxes,
  pendingStatPicks,
  readGrimoireState,
  resolveSlotStats,
  slotNeighbours,
  slotOfSpell,
  slotStatSteps,
  validateGrimoireSystem,
  type GrimoireSlotRef,
  type GrimoireState,
} from '../grimoires';
import type { SpellDefinition } from '../types';

const rebuild = (engine: GameEngine, entry: ReturnType<typeof describeAction>) => rebuildAction(engine, { seq: 0, turn: 0, floor: 0, ...entry });

const SPELLS = Array.from({ length: 20 }, (_, i) => `spell_${i + 1}`);

function hero(spellsKnown: string[] = SPELLS.slice(0, 2)): Player {
  return new Player({ position: { x: 2, y: 2 }, spellsKnown, grimoireSystem: FIXTURE_GRIMOIRES });
}

const state = (p: Player): GrimoireState => p.grimoireState as GrimoireState;
const slot = (grimoireId: string, x: number, y: number): GrimoireSlotRef => ({ grimoireId, x, y });
const sortSlots = (slots: GrimoireSlotRef[]) => [...slots].sort((a, b) => a.x - b.x || a.y - b.y);

function pickAll(p: Player, picks: Array<[string, 'x' | 'y', string]>): void {
  for (const [g, axis, stat] of picks) expect(p.assignGrimoireStat(g, axis, stat)).toBe('ok');
}

describe('three grimoires (P-29)', () => {
  it("the fixture pack's declaration is sound", () => {
    expect(validateGrimoireSystem(FIXTURE_GRIMOIRES)).toEqual([]);
    expect(fixtureManifest.magic?.grimoires).toBe(FIXTURE_GRIMOIRES);
  });

  it('rejects an unsound declaration', () => {
    const problems = validateGrimoireSystem({
      layouts: [
        { id: 'a', name: 'A', cells: [{ x: 1, y: 0 }, { x: 2, y: 2 }] },
        { id: 'a', name: 'A', cells: [{ x: 0, y: 0 }], suggestedStats: { x: 'nope' } },
      ],
      stats: [{ id: 's', name: 'S', description: '', kind: 'swift' }],
    });
    expect(problems).toEqual([
      'grimoire a has no centre (0, 0)',
      'grimoire a cell (1, 0) touches no other cell',
      'grimoire a cell (2, 2) is outside the 3×3 grid',
      'grimoire a cell (2, 2) touches no other cell',
      'grimoire a is declared twice',
      'grimoire a suggests unknown stat nope for x',
      'stat s is swift with no castTimeByStep',
    ]);
  });

  describe('neighbours and axes per slot, on each shape', () => {
    const p = hero(SPELLS.slice(0, 9));
    pickAll(p, [
      ['row', 'x', 'power'],
      ['star', 'x', 'duration'],
      ['star', 'y', 'thrift'],
      ['grid', 'x', 'range'],
      ['grid', 'y', 'area'],
    ]);
    const s = state(p);
    const statsAt = (ref: GrimoireSlotRef) =>
      Object.fromEntries(slotStatSteps(FIXTURE_GRIMOIRES, s, ref).map(({ stat, steps }) => [stat.id, steps]));

    it('the row: the centre has none, each end one step of its one axis', () => {
      expect(grimoireAxes(FIXTURE_GRIMOIRES, s, 'row')).toEqual(['x']);
      expect(statsAt(slot('row', 0, 0))).toEqual({});
      expect(statsAt(slot('row', -1, 0))).toEqual({ power: 1 });
      expect(statsAt(slot('row', 1, 0))).toEqual({ power: 1 });
      expect(sortSlots(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('row', 0, 0)))).toEqual([slot('row', -1, 0), slot('row', 1, 0)]);
      expect(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('row', 1, 0))).toEqual([slot('row', 0, 0)]);
    });

    it('the plus: left and right arms take one stat, top and bottom the other, and touch only the centre', () => {
      expect(statsAt(slot('star', -1, 0))).toEqual({ duration: 1 });
      expect(statsAt(slot('star', 0, 1))).toEqual({ thrift: 1 });
      expect(statsAt(slot('star', 0, 0))).toEqual({});
      expect(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('star', 0, 0))).toHaveLength(4);
      expect(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('star', 0, -1))).toEqual([slot('star', 0, 0)]);
    });

    it('the square: edges one stat, corners both, at most four neighbours', () => {
      expect(statsAt(slot('grid', 0, -1))).toEqual({ area: 1 });
      expect(statsAt(slot('grid', 1, 0))).toEqual({ range: 1 });
      expect(statsAt(slot('grid', -1, 1))).toEqual({ range: 1, area: 1 });
      expect(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('grid', 0, 0))).toHaveLength(4);
      expect(sortSlots(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('grid', 1, 1)))).toEqual([slot('grid', 0, 1), slot('grid', 1, 0)]);
    });

    it('a slot added k steps out takes k steps of one axis and touches the slot it was added beside', () => {
      expect(p.addGrimoireSlot(slot('star', 2, 0))).toBe(true);
      expect(statsAt(slot('star', 2, 0))).toEqual({ duration: 2 });
      expect(slotNeighbours(FIXTURE_GRIMOIRES, s, slot('star', 2, 0))).toEqual([slot('star', 1, 0)]);
      expect(p.addGrimoireSlot(slot('star', 2, 0))).toBe(false);
      expect(p.addGrimoireSlot(slot('star', 3, 3))).toBe(false);
    });

    it("a slot added above the row gives it a second axis, which waits for a pick", () => {
      expect(pendingStatPicks(FIXTURE_GRIMOIRES, s)).toEqual([]);
      expect(p.addGrimoireSlot(slot('row', 0, 1))).toBe(true);
      expect(grimoireAxes(FIXTURE_GRIMOIRES, s, 'row')).toEqual(['x', 'y']);
      expect(pendingStatPicks(FIXTURE_GRIMOIRES, s)).toEqual([{ grimoireId: 'row', axis: 'y' }]);
      expect(p.assignGrimoireStat('row', 'y', 'swift')).toBe('ok');
      expect(statsAt(slot('row', 0, 1))).toEqual({ swift: 1 });
    });
  });

  describe('stat picks', () => {
    it('the row starts with one axis, and its other is refused', () => {
      const p = hero();
      expect(pendingStatPicks(FIXTURE_GRIMOIRES, state(p))).toEqual([{ grimoireId: 'row', axis: 'x' }]);
      expect(p.assignGrimoireStat('row', 'y', 'power')).toBe('no-axis');
      expect(p.assignGrimoireStat('row', 'x', 'power')).toBe('ok');
      expect(pendingStatPicks(FIXTURE_GRIMOIRES, state(p))).toEqual([]);
    });

    it('refuses a stat already on any axis, a closed grimoire, unknown ids, and a second pick without replace', () => {
      const p = hero(SPELLS.slice(0, 4));
      expect(p.assignGrimoireStat('row', 'x', 'power')).toBe('ok');
      expect(p.assignGrimoireStat('star', 'x', 'power')).toBe('stat-in-use');
      expect(p.assignGrimoireStat('star', 'x', 'thrift')).toBe('ok');
      expect(p.assignGrimoireStat('star', 'y', 'thrift')).toBe('stat-in-use');
      expect(p.assignGrimoireStat('grid', 'x', 'range')).toBe('closed');
      expect(p.assignGrimoireStat('nowhere', 'x', 'range')).toBe('unknown-grimoire');
      expect(p.assignGrimoireStat('star', 'y', 'luck')).toBe('unknown-stat');
      expect(p.assignGrimoireStat('row', 'x', 'range')).toBe('already-picked');
    });

    it('a re-pick replaces an axis, and may take back the stat it held', () => {
      const p = hero(SPELLS.slice(0, 4));
      pickAll(p, [['row', 'x', 'power'], ['star', 'x', 'thrift']]);
      expect(p.assignGrimoireStat('row', 'x', 'swift', true)).toBe('ok');
      expect(p.assignGrimoireStat('row', 'x', 'power', true)).toBe('ok');
      expect(p.assignGrimoireStat('row', 'x', 'thrift', true)).toBe('stat-in-use');
      expect(state(p).statPicks).toEqual([
        { grimoireId: 'row', axis: 'x', statId: 'power' },
        { grimoireId: 'star', axis: 'x', statId: 'thrift' },
      ]);
    });

    it('a hero without the model has nothing to pick', () => {
      const p = new Player({ position: { x: 0, y: 0 }, spellsKnown: ['a'] });
      expect(p.grimoireState).toBeUndefined();
      expect(p.assignGrimoireStat('row', 'x', 'power')).toBe('unknown-grimoire');
    });
  });

  describe('step math', () => {
    const stat = (id: string) => FIXTURE_GRIMOIRES.stats.find((def) => def.id === id)!;
    const bolt = { effects: [{ type: 'damage', amount: 8 }] } as unknown as SpellDefinition;
    const sight = { effects: [{ type: 'reveal' }] } as unknown as SpellDefinition;

    it('gives each stat its size per step', () => {
      const one = resolveSlotStats(['power', 'thrift', 'range', 'area', 'duration', 'swift'].map((id) => ({ stat: stat(id), steps: 1 })));
      expect(one).toEqual({ powerMultiplier: 1.2, costMultiplier: 0.8, rangeBonus: 2, areaBonus: 1, durationMultiplier: 1.5, castTimeFraction: 0.75 });
      const two = resolveSlotStats([{ stat: stat('power'), steps: 2 }, { stat: stat('thrift'), steps: 2 }, { stat: stat('duration'), steps: 2 }]);
      expect(two.powerMultiplier).toBeCloseTo(1.4);
      expect(two.costMultiplier).toBeCloseTo(0.64);
      expect(two.durationMultiplier).toBeCloseTo(2);
      expect(resolveSlotStats([])).toEqual({ powerMultiplier: 1, costMultiplier: 1, rangeBonus: 0, areaBonus: 0, durationMultiplier: 1, castTimeFraction: 1 });
    });

    it('swift goes ¾, ⅔, ½ and never below', () => {
      const swift = (steps: number) => resolveSlotStats([{ stat: stat('swift'), steps }]).castTimeFraction;
      expect([1, 2, 3, 4].map(swift)).toEqual([3 / 4, 2 / 3, 1 / 2, 1 / 2]);
    });

    it('caps area at 2 steps on a damage spell only', () => {
      const area3 = [{ stat: stat('area'), steps: 3 }];
      expect(resolveSlotStats(area3, bolt).areaBonus).toBe(2);
      expect(resolveSlotStats(area3, sight).areaBonus).toBe(3);
      expect(resolveSlotStats(area3).areaBonus).toBe(3);
    });
  });

  describe('opening on need, and every known spell in a slot', () => {
    it('a new hero has the row open, its spells slotted in order', () => {
      const p = hero();
      expect(state(p).opened).toEqual(['row']);
      expect(state(p).placements).toEqual([
        { grimoireId: 'row', x: -1, y: 0, spellId: 'spell_1' },
        { grimoireId: 'row', x: 0, y: 0, spellId: 'spell_2' },
      ]);
    });

    it('the 4th known spell opens the star and the 9th the square', () => {
      const p = hero([]);
      const opened: string[][] = [];
      for (const id of SPELLS.slice(0, 9)) {
        const result = p.learnSpellResult(id);
        expect(result.outcome).toBe('learned');
        opened.push(result.opened);
      }
      expect(opened).toEqual([[], [], [], ['star'], [], [], [], [], ['grid']]);
      expect(slotOfSpell(state(p), 'spell_4')).toEqual(slot('star', 0, 0));
      expect(slotOfSpell(state(p), 'spell_9')?.grimoireId).toBe('grid');
      expect(state(p).placements).toHaveLength(9);
    });

    it('opens by spells known, not slots filled: forgetting never closes one', () => {
      const p = hero(SPELLS.slice(0, 4));
      p.forgetSpell('spell_1');
      p.forgetSpell('spell_2');
      expect(state(p).opened).toEqual(['row', 'star']);
      expect(p.learnSpellResult('spell_5').slot).toEqual(slot('row', -1, 0));
    });

    it('with every slot full, a spell is not learned and the outcome says full', () => {
      const p = hero(SPELLS.slice(0, 17));
      expect(state(p).placements).toHaveLength(17);
      const before = JSON.stringify({ ...state(p), offers: [] });
      expect(p.learnSpellResult('spell_18')).toEqual({ outcome: 'full', opened: [] });
      expect(p.learnSpell('spell_18')).toBe(false);
      expect(p.spellsKnown).not.toContain('spell_18');
      expect(JSON.stringify({ ...state(p), offers: [] })).toBe(before);
      // The spell waits as an offer, once, for the placement card.
      expect(p.pendingSpellOffers).toEqual(['spell_18']);
      expect(p.addGrimoireSlot(slot('grid', 2, 0))).toBe(true);
      expect(p.learnSpellResult('spell_18').slot).toEqual(slot('grid', 2, 0));
    });

    it('a known spell is not learned again', () => {
      expect(hero().learnSpellResult('spell_1').outcome).toBe('known');
    });
  });

  describe('place, move and forget', () => {
    it('places a spell in an empty slot, moving it', () => {
      const p = hero();
      expect(p.placeGrimoireSpell('spell_1', slot('row', 1, 0))).toBe(true);
      expect(slotOfSpell(state(p), 'spell_1')).toEqual(slot('row', 1, 0));
      expect(state(p).placements).toHaveLength(2);
    });

    it('swaps with a spell already in the slot, so both keep one', () => {
      const p = hero();
      expect(p.placeGrimoireSpell('spell_1', slot('row', 0, 0))).toBe(true);
      expect(slotOfSpell(state(p), 'spell_1')).toEqual(slot('row', 0, 0));
      expect(slotOfSpell(state(p), 'spell_2')).toEqual(slot('row', -1, 0));
    });

    it('moves a spell to another open grimoire', () => {
      const p = hero(SPELLS.slice(0, 4));
      expect(p.placeGrimoireSpell('spell_1', slot('star', 0, -1))).toBe(true);
      expect(slotOfSpell(state(p), 'spell_1')).toEqual(slot('star', 0, -1));
    });

    it('refuses an unknown spell, a closed grimoire and a cell that is no slot', () => {
      const p = hero();
      expect(p.placeGrimoireSpell('spell_9', slot('row', 1, 0))).toBe(false);
      expect(p.placeGrimoireSpell('spell_1', slot('star', 0, 0))).toBe(false);
      expect(p.placeGrimoireSpell('spell_1', slot('row', 0, 1))).toBe(false);
    });

    it('forgetting frees the slot, and the spell is gone for the run', () => {
      const p = hero();
      p.forgetSpell('spell_1');
      expect(p.spellsKnown).toEqual(['spell_2']);
      expect(slotOfSpell(state(p), 'spell_1')).toBeUndefined();
      expect(p.learnSpellResult('spell_1')).toEqual({ outcome: 'forgotten', opened: [] });
      expect(p.learnSpellResult('spell_3').slot).toEqual(slot('row', -1, 0));
    });

    it('doubles a slot lend once', () => {
      const p = hero();
      expect(p.doubleGrimoireSlotLend(slot('row', 0, 0))).toBe(true);
      expect(p.doubleGrimoireSlotLend(slot('row', 0, 0))).toBe(false);
      expect(p.doubleGrimoireSlotLend(slot('star', 0, 0))).toBe(false);
    });
  });

  describe('the actions', () => {
    function engineWith(p: Player, floor = 0): GameEngine {
      return new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: p, floor, manifest: fixtureManifest });
    }

    it('place and forget are free with no foe in view, record for replay, and rebuild', () => {
      const p = hero();
      const engine = engineWith(p);
      const place = new PlaceGrimoireSpellAction(p, 'spell_1', 'row', 1, 0);
      expect(engine.handlePlayerAction(place)).toMatchObject({ success: true, cost: 0 });
      const rebuilt = rebuild(engine, describeAction(place));
      expect(rebuilt).toBeInstanceOf(PlaceGrimoireSpellAction);
      expect(rebuilt).toMatchObject({ spellId: 'spell_1', grimoireId: 'row', x: 1, y: 0 });

      const forget = new ForgetSpellAction(p, 'spell_2');
      expect(engine.handlePlayerAction(forget)).toMatchObject({ success: true, cost: 0 });
      expect(p.spellsKnown).toEqual(['spell_1']);
      expect(rebuild(engine, describeAction(forget))).toMatchObject({ spellId: 'spell_2' });
      expect(engine.handlePlayerAction(new ForgetSpellAction(p, 'spell_2')).success).toBe(false);
    });

    it('an offer made while full waits, then is learned once the hero forgets one', () => {
      const p = hero(SPELLS.slice(0, 17));
      const engine = engineWith(p);
      expect(p.learnSpellResult('spell_18').outcome).toBe('full');
      const accept = new AcceptSpellOfferAction(p, 'spell_18');
      expect(engine.handlePlayerAction(accept)).toMatchObject({ success: false, cost: 0 });
      expect(p.pendingSpellOffers).toEqual(['spell_18']);

      expect(engine.handlePlayerAction(new ForgetSpellAction(p, 'spell_1')).success).toBe(true);
      expect(engine.handlePlayerAction(accept)).toMatchObject({ success: true, cost: 0 });
      expect(p.spellsKnown).toContain('spell_18');
      expect(p.pendingSpellOffers).toEqual([]);
      expect(rebuild(engine, describeAction(accept))).toMatchObject({ spellId: 'spell_18' });
      expect(engine.handlePlayerAction(accept).success).toBe(false);
    });

    it('placing with a foe in view takes a turn', () => {
      const p = hero();
      const engine = engineWith(p, 3);
      const foe = new Monster({ id: 'foe', name: 'Raider', position: { x: 4, y: 2 }, stats: { hp: 20, maxHp: 20, attack: 1, defense: 0 }, speed: 100 });
      engine.map.addEntity(foe);
      engine.updateFov();
      const result = engine.handlePlayerAction(new PlaceGrimoireSpellAction(p, 'spell_1', 'row', 1, 0));
      expect(result.success).toBe(true);
      expect(result.cost).toBeGreaterThan(0);
    });

    it('a stat pick fills an empty axis only, and rebuilds', () => {
      const p = hero();
      const engine = engineWith(p);
      const pick = new PickGrimoireStatAction(p, 'row', 'x', 'power');
      expect(engine.handlePlayerAction(pick)).toMatchObject({ success: true, cost: 0 });
      expect(engine.handlePlayerAction(new PickGrimoireStatAction(p, 'row', 'x', 'thrift'))).toMatchObject({
        success: false,
        message: 'That axis already has its stat.',
      });
      expect(rebuild(engine, describeAction(pick))).toMatchObject({ grimoireId: 'row', axis: 'x', statId: 'power' });
    });
  });

  describe('saving', () => {
    function roundTrip(p: Player, manifest = fixtureManifest) {
      const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: p, floor: 2, manifest });
      const save = serializeGame(engine);
      return { save, loaded: deserializeGame(JSON.parse(JSON.stringify(save)), manifest).engine.player };
    }

    it('an offer waiting for room survives a save', () => {
      const p = hero(SPELLS.slice(0, 17));
      p.learnSpellResult('spell_18');
      const { loaded } = roundTrip(p);
      expect(loaded.pendingSpellOffers).toEqual(['spell_18']);
    });

    it('carries every field over', () => {
      const p = hero(SPELLS.slice(0, 4));
      pickAll(p, [['row', 'x', 'power'], ['star', 'x', 'swift']]);
      p.addGrimoireSlot(slot('star', 2, 0));
      p.placeGrimoireSpell('spell_1', slot('star', 2, 0));
      p.doubleGrimoireSlotLend(slot('row', 0, 0));
      p.forgetSpell('spell_3');
      const { loaded } = roundTrip(p);
      expect(loaded.grimoireState).toEqual(p.grimoireState);
      expect(loaded.spellsKnown).toEqual(p.spellsKnown);
    });

    it('writes the fields only when set', () => {
      const plain = roundTrip(hero()).save.player.grimoires;
      expect(plain).toEqual({
        opened: ['row'],
        placements: [
          { grimoireId: 'row', x: -1, y: 0, spellId: 'spell_1' },
          { grimoireId: 'row', x: 0, y: 0, spellId: 'spell_2' },
        ],
      });
      const p = new Player({ position: { x: 2, y: 2 }, spellsKnown: ['magic_arrow'] });
      expect(roundTrip(p, cotwManifest).save.player.grimoires).toBeUndefined();
    });

    it('drops what no longer fits the pack or the known spells, and slots the rest', () => {
      const raw = {
        opened: ['row', 'gone', 'row'],
        placements: [
          { grimoireId: 'row', x: 0, y: 0, spellId: 'spell_2' },
          { grimoireId: 'row', x: 0, y: 0, spellId: 'spell_1' },
          { grimoireId: 'gone', x: 0, y: 0, spellId: 'spell_1' },
          { grimoireId: 'row', x: 1, y: 0, spellId: 'unknown_spell' },
          { grimoireId: 'row', x: 'left', y: 0, spellId: 'spell_1' },
        ],
        statPicks: [{ grimoireId: 'row', axis: 'y', statId: 'power' }, { grimoireId: 'row', axis: 'x', statId: 'luck' }],
        doubledSlots: [{ grimoireId: 'row', x: 5, y: 5 }],
        forgotten: ['spell_9', 7],
        forged: [{ spellId: 'spell_1', element: 'fire' }, { spellId: 'spell_1', element: 'fire' }, { spellId: 'spell_9', element: 'cold' }, { spellId: 'spell_2' }],
      };
      const p = new Player({ position: { x: 0, y: 0 }, spellsKnown: ['spell_1', 'spell_2'], grimoireSystem: FIXTURE_GRIMOIRES, grimoireState: readGrimoireState(raw) });
      expect(state(p)).toEqual({
        opened: ['row'],
        placements: [
          { grimoireId: 'row', x: 0, y: 0, spellId: 'spell_2' },
          { grimoireId: 'row', x: -1, y: 0, spellId: 'spell_1' },
        ],
        statPicks: [],
        extraSlots: [],
        doubledSlots: [],
        forgotten: ['spell_9'],
        forged: [{ spellId: 'spell_1', element: 'fire' }],
        offers: [],
      });
      expect(readGrimoireState('junk')).toBeUndefined();
    });

    it('keeps the state, inert, when the pack stops declaring the model', () => {
      const p = hero();
      const { loaded } = roundTrip(p, { ...fixtureManifest, magic: {} });
      expect(loaded.grimoireState).toEqual(p.grimoireState);
      expect(loaded.assignGrimoireStat('row', 'x', 'power')).toBe('unknown-grimoire');
      expect(loaded.learnSpellResult('spell_3').slot).toBeUndefined();
    });

    it('cotw does not declare the model, so its heroes keep the old grimoire alone', () => {
      expect(cotwManifest.magic?.grimoires).toBeUndefined();
    });
  });
});
