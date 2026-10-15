import { describe, it, expect, vi } from 'vitest';
import { flightRecorder } from '../../debug/flightRecorder';
import { fixtureManifest, FIXTURE_GRIMOIRES, FIXTURE_LENDING } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { DEFAULT_AFFINITY_MATRIX } from '../elements';
import { createGrimoireState, type GrimoireSlotRef, type GrimoireState } from '../grimoires';
import { pickMaterial, resolveAllCasts, resolveCast, resolveSpellCast, validateNeighbourLending, type ResolvedCast } from '../neighbourLending';
import type { SpellType } from '../magicConfig';
import type { SpellDefinition } from '../types';

/** A spell with only what lending reads. */
function spell(id: string, element: string, spellType?: SpellType, extra: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id,
    name: id,
    school: 'Combat',
    manaCost: 5,
    element,
    range: 6,
    basePower: 10,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    description: id,
    effects: spellType === 'damage' ? [{ type: 'damage', amount: 10, element }] : [],
    spellType,
    ...extra,
  };
}

const SPELLS: SpellDefinition[] = [
  spell('bolt', 'fire', 'damage'),
  spell('frost', 'cold', 'damage'),
  spell('spark', 'lightning', 'damage'),
  spell('rock', 'physical', 'damage'),
  spell('ember', 'fire', 'damage'),
  spell('mend', 'healing', 'heal'),
  spell('hold', 'cold', 'control'),
  spell('call', 'physical', 'summon'),
  spell('hop', 'arcane', 'movement', { school: 'Movement' }),
  spell('ground', 'physical', 'terrain'),
  spell('bind', 'arcane', 'control', { school: 'Enchantment' }),
  spell('arrow', 'arcane', 'damage', { school: 'Combat' }),
  spell('reap', 'shadow', 'damage', { lends: ['blood-price'] }),
  spell('grace', 'shadow', 'heal', { lends: ['healing'] }),
  spell('untyped', 'fire'),
];
const spellOf = (id: string) => SPELLS.find((s) => s.id === id);
const oppositeOf = (e: string) => DEFAULT_AFFINITY_MATRIX.getOpposite(e);

/** A state with every grimoire open and `cells` placed in the 3×3 `grid`, as `[x, y, spellId]`. */
function grid(cells: Array<[number, number, string]>, extra: (s: GrimoireState) => void = () => {}): GrimoireState {
  const state = createGrimoireState();
  state.opened = ['row', 'star', 'grid'];
  state.placements = cells.map(([x, y, spellId]) => ({ grimoireId: 'grid', x, y, spellId }));
  extra(state);
  return state;
}
const at = (x: number, y: number): GrimoireSlotRef => ({ grimoireId: 'grid', x, y });
const cast = (state: GrimoireState, x = 0, y = 0): ResolvedCast => resolveCast(FIXTURE_GRIMOIRES, state, at(x, y), spellOf, oppositeOf)!;
const lendIds = (c: ResolvedCast) => c.lends.map((l) => l.flavourId).sort();

describe('neighbour lending: where each spell type delivers', () => {
  it.each([
    ['bolt', 'hit'],
    ['hold', 'target'],
    ['mend', 'adjacentFoes'],
    ['call', 'summonHits'],
    ['hop', 'departure'],
    ['ground', 'material'],
  ])('%s receives a physical neighbour’s knockback, delivered as %s', (spellId, delivery) => {
    const c = cast(grid([[0, 0, spellId], [1, 0, 'rock']]));
    expect(c.delivery).toBe(delivery);
    expect(c.lends.map((l) => [l.flavourId, l.doubled])).toEqual([['physical', spellId === 'call' || spellId === 'ground']]);
  });

  it.each([
    ['bolt', 'fire'],
    ['frost', 'cold'],
    ['spark', 'lightning'],
    ['rock', 'physical'],
    ['mend', 'healing'],
    ['bind', 'arcane:Enchantment'],
    ['hop', 'arcane:Movement'],
  ])('%s lends the %s flavour', (spellId, flavour) => {
    const c = cast(grid([[0, 0, 'call'], [0, -1, spellId]]));
    expect(lendIds(c)).toEqual([flavour]);
  });

  it('a spell with no type borrows nothing but still lends', () => {
    const state = grid([[0, 0, 'untyped'], [1, 0, 'rock']]);
    expect(cast(state).lends).toEqual([]);
    expect(cast(state).delivery).toBeUndefined();
    expect(lendIds(cast(state, 1, 0))).toEqual(['fire']);
  });

  it('every touching pair lends both ways; a diagonal lends nothing', () => {
    const state = grid([[0, 0, 'rock'], [1, 0, 'spark'], [1, 1, 'frost']]);
    expect(lendIds(cast(state))).toEqual(['lightning']);
    expect(lendIds(cast(state, 1, 0))).toEqual(['cold', 'physical']);
    expect(lendIds(cast(state, 1, 1))).toEqual(['lightning']);
  });
});

describe('neighbour lending: the rules', () => {
  it('the same flavour from two neighbours counts once, from both slots', () => {
    const c = cast(grid([[0, 0, 'call'], [1, 0, 'rock'], [-1, 0, 'ground']]));
    expect(c.lends).toHaveLength(1);
    expect(c.lends[0].from).toEqual([at(-1, 0), at(1, 0)]);
  });

  it('a hub takes four flavours at once, with no cap', () => {
    const c = cast(grid([[0, 0, 'call'], [1, 0, 'bolt'], [-1, 0, 'spark'], [0, -1, 'mend'], [0, 1, 'bind']]));
    expect(lendIds(c)).toEqual(['arcane:Enchantment', 'fire', 'healing', 'lightning']);
  });

  it('a neighbour of the spell’s own element lends the doubled, recoloured form', () => {
    const c = cast(grid([[0, 0, 'bolt'], [1, 0, 'ember']]));
    expect(c.lends[0]).toMatchObject({ flavourId: 'fire', doubled: true, name: 'Blue fire', color: '#60a5fa' });
    expect(c.lends[0].effects).toEqual(FIXTURE_LENDING.flavours.find((f) => f.id === 'fire')!.doubled!.effects);
  });

  it('cold doubled changes kind: it freezes', () => {
    const c = cast(grid([[0, 0, 'frost'], [1, 0, 'hold']]));
    expect(c.lends[0]).toMatchObject({ name: 'Black rime', effects: [{ type: 'applyStatus', statusId: 'paralyzed', duration: 1 }] });
  });

  it('arcane beside arcane doubles by school, keyed to the lender’s school', () => {
    const c = cast(grid([[0, 0, 'arrow'], [1, 0, 'bind']]));
    expect(c.lends[0]).toMatchObject({ flavourId: 'arcane:Enchantment', doubled: true });
  });

  it('a flavour without a doubled form lends its plain form when doubled', () => {
    const c = cast(grid([[0, 0, 'spark'], [1, 0, 'spark2']]), 0, 0);
    expect(c.lends).toEqual([]); // spark2 is no spell: an empty or unknown slot lends nothing
    const twin = resolveCast(
      FIXTURE_GRIMOIRES,
      grid([[0, 0, 'spark'], [1, 0, 'bolt']], (s) => s.forged.push({ spellId: 'bolt', element: 'lightning' })),
      at(0, 0),
      spellOf,
      oppositeOf
    )!;
    expect(twin.lends.find((l) => l.flavourId === 'lightning')).toMatchObject({ doubled: true, name: 'Leaping' });
  });

  it('opposites add the bonus to the spell’s own power, once however many', () => {
    expect(cast(grid([[0, 0, 'bolt'], [1, 0, 'frost']])).lentPowerMultiplier).toBeCloseTo(1.25);
    expect(cast(grid([[0, 0, 'bolt'], [1, 0, 'frost'], [-1, 0, 'hold']])).lentPowerMultiplier).toBeCloseTo(1.25);
    expect(cast(grid([[0, 0, 'bolt'], [1, 0, 'rock']])).lentPowerMultiplier).toBe(1);
  });

  it('a spell forged with its own opposite takes the bonus alone', () => {
    const state = grid([[0, 0, 'bolt']], (s) => s.forged.push({ spellId: 'bolt', element: 'cold' }));
    expect(cast(state).elements).toEqual(['fire', 'cold']);
    expect(cast(state).lentPowerMultiplier).toBeCloseTo(1.25);
  });

  it('a forged spell lends both elements, and counts as both for doubling', () => {
    const state = grid([[0, 0, 'call'], [1, 0, 'bolt']], (s) => s.forged.push({ spellId: 'bolt', element: 'physical' }));
    expect(lendIds(cast(state))).toEqual(['fire', 'physical']);
    expect(cast(state, 1, 0).gives).toEqual(['fire', 'physical']);
    const rockBeside = grid([[0, 0, 'rock'], [1, 0, 'bolt']], (s) => s.forged.push({ spellId: 'bolt', element: 'physical' }));
    const lends = cast(rockBeside).lends;
    expect(lends.find((l) => l.flavourId === 'physical')!.doubled).toBe(true);
    expect(lends.find((l) => l.flavourId === 'fire')!.doubled).toBe(false);
  });

  it('a forged arcane element lends plain arcane (Magic Arrow’s pierce), not a school', () => {
    const state = grid([[0, 0, 'call'], [1, 0, 'bolt']], (s) => s.forged.push({ spellId: 'bolt', element: 'arcane' }));
    expect(lendIds(cast(state))).toEqual(['arcane', 'fire']);
  });

  it('a doubled slot (Týr, Loki) lends its doubled form; doubling happens once', () => {
    const doubled = grid([[0, 0, 'call'], [1, 0, 'bolt']], (s) => s.doubledSlots.push(at(1, 0)));
    expect(cast(doubled).lends[0]).toMatchObject({ doubled: true, name: 'Blue fire' });
    const twice = grid([[0, 0, 'ember'], [1, 0, 'bolt']], (s) => s.doubledSlots.push(at(1, 0)));
    expect(cast(twice).lends[0]).toMatchObject({ doubled: true, name: 'Blue fire' });
    expect(cast(doubled, 1, 0).lends[0].doubled).toBe(false); // the doubled slot's own borrowing is untouched
  });

  it('axis stats scale the spell’s own effect and never the borrowed one', () => {
    const state = grid([[1, 0, 'bolt'], [0, 0, 'frost']], (s) => s.statPicks.push({ grimoireId: 'grid', axis: 'x', statId: 'duration' }));
    const c = cast(state, 1, 0);
    expect(c.stats.durationMultiplier).toBeCloseTo(1.5);
    expect(c.lends[0].effects).toEqual([{ type: 'applyStatus', statusId: 'slow', duration: 2 }]);
  });

  it('Blood-price: the borrower hits 25% harder and pays 2 HP a cast, stacking with an opposite', () => {
    const c = cast(grid([[0, 0, 'bolt'], [1, 0, 'reap']]));
    expect(lendIds(c)).toEqual(['blood-price']);
    expect(c.lentPowerMultiplier).toBeCloseTo(1.25);
    expect(c.lentHpCost).toBe(2);
    const both = cast(grid([[0, 0, 'bolt'], [1, 0, 'reap'], [-1, 0, 'frost']]));
    expect(both.lentPowerMultiplier).toBeCloseTo(1.5);
    expect(cast(grid([[0, 0, 'bolt'], [1, 0, 'reap'], [-1, 0, 'reap2']])).lentHpCost).toBe(2);
  });

  it('a frith spell lends healing whatever its element', () => {
    expect(lendIds(cast(grid([[0, 0, 'bolt'], [1, 0, 'grace']])))).toEqual(['healing']);
  });

  it('terrain picks one borrowed flavour per cast by the roll', () => {
    const c = cast(grid([[0, 0, 'ground'], [1, 0, 'bolt'], [-1, 0, 'frost']]));
    expect(pickMaterial(c, 0)!.flavourId).toBe(c.lends[0].flavourId);
    expect(pickMaterial(c, 0.99)!.flavourId).toBe(c.lends[1].flavourId);
    expect(pickMaterial(cast(grid([[0, 0, 'ground']])), 0.5)).toBeUndefined();
  });

  it('without lending tables a slot borrows and gives nothing', () => {
    const config = { ...FIXTURE_GRIMOIRES, lending: undefined };
    const c = resolveCast(config, grid([[0, 0, 'bolt'], [1, 0, 'rock']]), at(0, 0), spellOf, oppositeOf)!;
    expect(c.lends).toEqual([]);
    expect(c.gives).toEqual([]);
  });

  it('resolves every placed spell, and a spell by id', () => {
    const state = grid([[0, 0, 'bolt'], [1, 0, 'rock']]);
    expect(resolveAllCasts(FIXTURE_GRIMOIRES, state, spellOf, oppositeOf).map((c) => c.spellId).sort()).toEqual(['bolt', 'rock']);
    expect(resolveSpellCast(FIXTURE_GRIMOIRES, state, 'rock', spellOf, oppositeOf)!.slot).toEqual(at(1, 0));
    expect(resolveSpellCast(FIXTURE_GRIMOIRES, state, 'frost', spellOf, oppositeOf)).toBeUndefined();
  });
});

describe('neighbour lending: validation and the report', () => {
  it('names duplicate flavours and spells lending unknown ones', () => {
    const lending = { flavours: [...FIXTURE_LENDING.flavours, { id: 'fire', name: 'again', effects: [] }] };
    expect(validateNeighbourLending(lending, [spell('x', 'fire', 'damage', { lends: ['nope'] })])).toEqual([
      'lend flavour fire is declared twice',
      'spell x lends unknown flavour nope',
    ]);
    expect(validateNeighbourLending(FIXTURE_LENDING, fixtureManifest.spells!)).toEqual([]);
  });

  it('engine.diagnostics.resolvedCasts reports the hero’s slots without a checkpoint', () => {
    const hero = new Player({ position: { x: 2, y: 5 }, spellsKnown: ['forge_bolt', 'blood_bolt'], grimoireSystem: FIXTURE_GRIMOIRES });
    const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: hero, floor: 1, manifest: fixtureManifest });
    const checkpoint = vi.spyOn(flightRecorder, 'requestCheckpoint');
    const report = engine.diagnostics.resolvedCasts();
    expect(checkpoint).not.toHaveBeenCalled();
    checkpoint.mockRestore();
    const bolt = report.find((c) => c.spellId === 'forge_bolt')!;
    expect(report.map((c) => c.spellId).sort()).toEqual(['blood_bolt', 'forge_bolt']);
    expect(bolt.lends.map((l) => l.flavourId)).toEqual(['blood-price']);
    expect(bolt.lentHpCost).toBe(2);
  });

  it('is empty for a hero without the model', () => {
    const hero = new Player({ position: { x: 2, y: 5 }, spellsKnown: ['forge_bolt'] });
    const engine = new GameEngine({ map: new GameMap(12, 12, TILES.FLOOR), player: hero, floor: 1, manifest: fixtureManifest });
    expect(engine.diagnostics.resolvedCasts()).toEqual([]);
  });
});
