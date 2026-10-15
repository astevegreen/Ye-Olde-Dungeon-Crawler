import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES, FIXTURE_SPELLS } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { CastSpellAction } from '../../actions/spell-actions';
import { heroResolvedCasts } from '../castNumbers';
import type { GrimoireState } from '../grimoires';
import type { SpellDefinition } from '../types';
import type { StatusType } from '../../status/types';

/** Two typed spells the fixture lacks: ground that a neighbour turns to its material, and a random hop. */
const EXTRA: SpellDefinition[] = [
  {
    id: 'quake',
    name: 'Quake',
    school: 'Combat',
    manaCost: 1,
    element: 'physical',
    range: 8,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    description: 'Ground that takes a neighbour’s material.',
    spellType: 'terrain',
    effects: [],
  },
  {
    id: 'hop',
    name: 'Hop',
    school: 'Movement',
    manaCost: 1,
    element: 'arcane',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'A random hop.',
    spellType: 'movement',
    effects: [{ type: 'teleport', range: 5, random: true }],
  },
];
const manifest = { ...fixtureManifest, spells: [...FIXTURE_SPELLS, ...EXTRA] };

type Cell = [grimoireId: string, x: number, y: number, spellId: string];

function setup(cells: Cell[], extra: (s: GrimoireState) => void = () => {}): { engine: GameEngine; hero: Player } {
  const hero = new Player({ position: { x: 2, y: 5 }, spellsKnown: cells.map((c) => c[3]), grimoireSystem: FIXTURE_GRIMOIRES });
  const state = hero.grimoireState as GrimoireState;
  state.opened = ['row', 'star', 'grid'];
  state.placements = cells.map(([grimoireId, x, y, spellId]) => ({ grimoireId, x, y, spellId }));
  state.statPicks = [];
  extra(state);
  hero.restoreMana(hero.maxMana);
  const engine = new GameEngine({ map: new GameMap(16, 12, TILES.FLOOR), player: hero, floor: 1, manifest });
  return { engine, hero };
}

function foe(engine: GameEngine, id: string, x: number, y = 5): Monster {
  const m = new Monster({ id, name: id, position: { x, y }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 }, speed: 100 });
  engine.map.addEntity(m);
  return m;
}

const has = (m: { statusManager: { hasStatus(t: StatusType): boolean } }, status: string) => m.statusManager.hasStatus(status as StatusType);

/** HP a Forge Bolt from the row's right end takes off a fresh foe. */
function boltDamage(cells: Cell[] = [], extra?: (s: GrimoireState) => void): number {
  const { engine, hero } = setup([['row', 1, 0, 'forge_bolt'], ...cells], extra);
  const target = foe(engine, 'dummy', 6);
  expect(new CastSpellAction(hero, 'forge_bolt', 6, 5).perform(engine).success).toBe(true);
  return target.maxHp - target.hp;
}

describe('casting through the grimoires (P-30)', () => {
  it('the slot’s Power scales the spell’s own hit', () => {
    const plain = boltDamage();
    const powered = boltDamage([], (s) => s.statPicks.push({ grimoireId: 'row', axis: 'x', statId: 'power' }));
    expect(powered).toBe(Math.round(plain * 1.2));
  });

  it('Blood-price: the neighbour hits 25% harder and costs the hero 2 HP a cast', () => {
    const plain = boltDamage();
    expect(boltDamage([['row', 0, 0, 'blood_bolt']])).toBe(Math.round(plain * 1.25));
    const { engine, hero } = setup([['row', 1, 0, 'forge_bolt'], ['row', 0, 0, 'blood_bolt']]);
    foe(engine, 'dummy', 6);
    const before = hero.hp;
    new CastSpellAction(hero, 'forge_bolt', 6, 5).perform(engine);
    expect(before - hero.hp).toBe(2);
  });

  it('a damage spell’s hit carries what its neighbour lends', () => {
    const { engine, hero } = setup([['row', 1, 0, 'forge_bolt'], ['row', 0, 0, 'pass_the_burden']]);
    const target = foe(engine, 'dummy', 6);
    new CastSpellAction(hero, 'forge_bolt', 6, 5).perform(engine);
    expect(has(target, 'paralyzed')).toBe(true);
  });

  it('a healing neighbour cleanses the caster, not the foe it hits', () => {
    const { engine, hero } = setup([['row', 1, 0, 'forge_bolt'], ['row', 0, 0, 'healing_light']]);
    const target = foe(engine, 'dummy', 6);
    hero.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 1 });
    target.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 1 });
    new CastSpellAction(hero, 'forge_bolt', 6, 5).perform(engine);
    expect(has(hero, 'poison')).toBe(false);
    expect(has(target, 'poison')).toBe(true);
  });

  it('a heal bursts its neighbour’s flavour on the foes beside the caster', () => {
    const { engine, hero } = setup([['row', 1, 0, 'healing_light'], ['row', 0, 0, 'pass_the_burden']]);
    const beside = foe(engine, 'beside', 3);
    const far = foe(engine, 'far', 8);
    new CastSpellAction(hero, 'healing_light', hero.x, hero.y).perform(engine);
    expect(has(beside, 'paralyzed')).toBe(true);
    expect(has(far, 'paralyzed')).toBe(false);
  });

  it('a movement spell bursts its neighbour’s flavour among the foes it leaves', () => {
    const { engine, hero } = setup([['row', 1, 0, 'hop'], ['row', 0, 0, 'pass_the_burden']]);
    const left = foe(engine, 'left', 3);
    new CastSpellAction(hero, 'hop', hero.x, hero.y).perform(engine);
    expect(hero.x !== 2 || hero.y !== 5).toBe(true);
    expect(has(left, 'paralyzed')).toBe(true);
  });

  it('terrain takes one neighbour’s material per cast', () => {
    const { engine, hero } = setup([['row', 0, 0, 'quake'], ['row', -1, 0, 'forge_bolt'], ['row', 1, 0, 'pass_the_burden']]);
    const target = foe(engine, 'dummy', 6);
    new CastSpellAction(hero, 'quake', 6, 5).perform(engine);
    expect([has(target, 'burning'), has(target, 'paralyzed')].filter(Boolean)).toHaveLength(1);
  });

  it('Duration lengthens the spell’s own status, even with no spell type', () => {
    const { engine, hero } = setup([['row', 1, 0, 'brand']], (s) => s.statPicks.push({ grimoireId: 'row', axis: 'x', statId: 'duration' }));
    const target = foe(engine, 'dummy', 6);
    new CastSpellAction(hero, 'brand', 6, 5).perform(engine);
    expect(target.statusManager.getStatus('marked' as StatusType)?.duration).toBe(15);
  });

  it('a free cast takes nothing from the grimoires', () => {
    const { engine, hero } = setup([['row', 1, 0, 'forge_bolt'], ['row', 0, 0, 'pass_the_burden']]);
    const target = foe(engine, 'dummy', 6);
    new CastSpellAction(hero, 'forge_bolt', 6, 5, undefined, true).perform(engine);
    expect(has(target, 'paralyzed')).toBe(false);
  });

  it('resolved casts are kept until the grimoires change', () => {
    const { engine, hero } = setup([['row', 1, 0, 'forge_bolt']]);
    const first = heroResolvedCasts(engine);
    expect(heroResolvedCasts(engine)).toBe(first);
    (hero.grimoireState as GrimoireState).placements.push({ grimoireId: 'row', x: 0, y: 0, spellId: 'blood_bolt' });
    const second = heroResolvedCasts(engine);
    expect(second).not.toBe(first);
    expect(second.find((c) => c.spellId === 'forge_bolt')!.lentHpCost).toBe(2);
  });
});
