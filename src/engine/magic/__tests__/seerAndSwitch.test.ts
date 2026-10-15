import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES, FIXTURE_SPELLS } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { CastSpellAction } from '../../actions/spell-actions';
import { WaitAction } from '../../actions/wait';
import { MovementAction } from '../../actions/movement';
import { applyConsequences } from '../../actions/choiceAction';
import { heroResolvedCast } from '../castNumbers';
import { SPELL_CHANNEL_STATUS } from '../spellChannel';
import { SENSED_STATUS, executeReveal } from '../reveal';
import type { GrimoireState } from '../grimoires';
import type { SpellDefinition } from '../types';
import type { StatusType } from '../../status/types';

/**
 * A seer after Hliðskjálf (4c-1): typeless, channelled over two turns, sensing foes within its
 * reach, and borrowing only what its `lendOverrides` name (sleepers by fire, reach by movement).
 */
const SEER: SpellDefinition = {
  id: 'seer',
  name: 'Seer',
  school: 'Divination',
  manaCost: 1,
  element: 'arcane',
  range: 0,
  basePower: 0,
  areaOfEffect: 6,
  areaStep: 4,
  channel: 2,
  reflects: false,
  targetType: 'self',
  targetingMode: 'self',
  description: 'Foes within reach.',
  effects: [{ type: 'reveal', target: 'actors', duration: 10, withinReach: true }],
  lendOverrides: {
    fire: { effects: [{ type: 'reveal', target: 'sleepers', duration: 10, withinReach: true }] },
    'arcane:Movement': { effects: [], reachBonus: 3 },
  },
};
const manifest = { ...fixtureManifest, spells: [...FIXTURE_SPELLS, SEER] };

type Cell = [grimoireId: string, x: number, y: number, spellId: string];

function setup(cells: Cell[]): { engine: GameEngine; hero: Player } {
  const hero = new Player({ position: { x: 2, y: 5 }, spellsKnown: cells.map((c) => c[3]), grimoireSystem: FIXTURE_GRIMOIRES });
  const state = hero.grimoireState as GrimoireState;
  state.opened = ['row', 'star', 'grid'];
  state.placements = cells.map(([grimoireId, x, y, spellId]) => ({ grimoireId, x, y, spellId }));
  state.statPicks = [];
  hero.restoreMana(hero.maxMana);
  const engine = new GameEngine({ map: new GameMap(30, 12, TILES.FLOOR), player: hero, floor: 1, manifest });
  return { engine, hero };
}

function foe(engine: GameEngine, id: string, x: number, y = 5): Monster {
  const m = new Monster({ id, name: id, position: { x, y }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 0 }, speed: 100 });
  engine.map.addEntity(m);
  return m;
}

const sensed = (m: Monster) => m.statusManager.hasStatus(SENSED_STATUS as StatusType);
const channelling = (hero: Player) => hero.statusManager.hasStatus(SPELL_CHANNEL_STATUS as StatusType);

describe('A channelled seer (Hliðskjálf)', () => {
  it('goes off after a wait, sensing foes within its reach and none past it', () => {
    const { engine, hero } = setup([['row', 0, 0, 'seer']]);
    const near = foe(engine, 'near', 8);
    const far = foe(engine, 'far', 12);
    expect(engine.handlePlayerAction(new CastSpellAction(hero, 'seer', hero.x, hero.y)).success).toBe(true);
    expect(channelling(hero)).toBe(true);
    expect(sensed(near)).toBe(false);
    engine.handlePlayerAction(new WaitAction(hero));
    expect(channelling(hero)).toBe(false);
    expect(sensed(near)).toBe(true);
    expect(sensed(far)).toBe(false);
  });

  it('breaks when the hero does anything but wait, and never goes off', () => {
    const { engine, hero } = setup([['row', 0, 0, 'seer']]);
    const near = foe(engine, 'near', 8);
    engine.handlePlayerAction(new CastSpellAction(hero, 'seer', hero.x, hero.y));
    engine.handlePlayerAction(new MovementAction(hero, 0, 1));
    expect(channelling(hero)).toBe(false);
    engine.handlePlayerAction(new WaitAction(hero));
    expect(sensed(near)).toBe(false);
  });

  it('breaks when the hero is hurt while channelling', () => {
    const { engine, hero } = setup([['row', 0, 0, 'seer']]);
    const near = foe(engine, 'near', 8);
    engine.handlePlayerAction(new CastSpellAction(hero, 'seer', hero.x, hero.y));
    hero.takeDamage(3);
    engine.handlePlayerAction(new WaitAction(hero));
    expect(sensed(near)).toBe(false);
  });

  it('borrows only the flavours its overrides name: a healing neighbour lends it nothing', () => {
    const { engine } = setup([['row', 0, 0, 'seer'], ['row', 1, 0, 'healing_light']]);
    expect(heroResolvedCast(engine, 'seer')?.lends ?? []).toEqual([]);
  });

  it("takes a fire neighbour's layer, which a lone seer lacks", () => {
    const sleeperLine = (engine: GameEngine) => engine.messages.some((m) => m.includes('within reach sleeps') || m.includes('Asleep within reach'));
    for (const [cells, layered] of [[[['row', 0, 0, 'seer'], ['row', 1, 0, 'forge_bolt']], true], [[['row', 0, 0, 'seer']], false]] as const) {
      const { engine, hero } = setup(cells.map((c) => [...c]) as Cell[]);
      engine.handlePlayerAction(new CastSpellAction(hero, 'seer', hero.x, hero.y));
      engine.handlePlayerAction(new WaitAction(hero));
      expect(sleeperLine(engine)).toBe(layered);
    }
  });

  it('names the sleepers within reach, not the waking', () => {
    const { engine, hero } = setup([]);
    foe(engine, 'dozer', 8);
    foe(engine, 'watcher', 7).aiState = 'hunting';
    executeReveal(engine, hero, { type: 'reveal', target: 'sleepers', duration: 5, withinReach: true }, 6);
    expect(engine.messages.at(-1)).toBe('Asleep within reach: dozer.');
  });

  it('reaches further beside a movement spell', () => {
    const { engine, hero } = setup([['row', 0, 0, 'seer'], ['row', 1, 0, 'switch']]);
    expect(heroResolvedCast(engine, 'seer')?.reachBonus).toBe(3);
    const far = foe(engine, 'far', 11);
    engine.handlePlayerAction(new CastSpellAction(hero, 'seer', hero.x, hero.y));
    engine.handlePlayerAction(new WaitAction(hero));
    expect(sensed(far)).toBe(true);
  });
});

describe('A swap (Loki’s Switch)', () => {
  const sensedSwap: SpellDefinition = {
    ...FIXTURE_SPELLS.find((s) => s.id === 'switch')!,
    id: 'far_switch',
    range: 6,
    effects: [{ type: 'swap', sensed: true }],
  };

  function walled(spells: SpellDefinition[] = []): { engine: GameEngine; hero: Player } {
    const hero = new Player({ position: { x: 2, y: 5 } });
    hero.restoreMana(hero.maxMana);
    const map = new GameMap(30, 12, TILES.FLOOR);
    for (let y = 0; y < 12; y++) map.setTile(4, y, TILES.WALL);
    const engine = new GameEngine({ map, player: hero, floor: 1, manifest: { ...manifest, spells: [...manifest.spells, ...spells] } });
    return { engine, hero };
  }

  it('fails past its range', () => {
    const { engine, hero } = setup([]);
    const target = foe(engine, 'target', 12);
    const before = { x: hero.x, y: hero.y };
    new CastSpellAction(hero, 'switch', target.x, target.y, undefined, true).perform(engine);
    expect({ x: hero.x, y: hero.y }).toEqual(before);
  });

  it('reaches a foe sensed through a wall only when the swap allows it', () => {
    const { engine, hero } = walled([sensedSwap]);
    const target = foe(engine, 'target', 6);
    target.statusManager.applyStatus({ type: SENSED_STATUS as StatusType, duration: 10 }, [], target, engine);
    new CastSpellAction(hero, 'switch', target.x, target.y, undefined, true).perform(engine);
    expect(hero.x).toBe(2);
    new CastSpellAction(hero, 'far_switch', target.x, target.y, undefined, true).perform(engine);
    expect({ x: hero.x, y: hero.y }).toEqual({ x: 6, y: 5 });
    expect({ x: target.x, y: target.y }).toEqual({ x: 2, y: 5 });
  });
});

describe('Learning a spell already known (Urðr’s Pool)', () => {
  it('grants the fallback item instead', () => {
    const { engine, hero } = setup([['row', 0, 0, 'seer']]);
    applyConsequences([{ type: 'learnSpell', spellId: 'seer', orGrantItem: 'test_rune' }], engine, hero);
    expect(hero.inventory.primaryPack.getItems().some((i) => i.name === 'test rune')).toBe(true);
    applyConsequences([{ type: 'learnSpell', spellId: 'switch', orGrantItem: 'test_rune' }], engine, hero);
    expect(hero.spellsKnown).toContain('switch');
  });
});
