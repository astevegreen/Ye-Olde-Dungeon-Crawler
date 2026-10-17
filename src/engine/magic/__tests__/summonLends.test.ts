import { describe, it, expect } from 'vitest';
import { fixtureManifest, FIXTURE_GRIMOIRES, FIXTURE_SPELLS } from '../../../../tests/fixtures/fixture-pack';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { CastSpellAction } from '../../actions/spell-actions';
import { MeleeAttackAction } from '../../actions/combat';
import { deserializeMapObject, serializeMapObject } from '../../storage/serializer';
import type { GrimoireState } from '../grimoires';
import type { SpellDefinition } from '../types';
import type { StatusType } from '../../status/types';

/** A summon spell the fixture lacks: a friendly raider beside the caster. */
const CALL: SpellDefinition = {
  id: 'call_raider',
  name: 'Call Raider',
  school: 'Conjuration',
  manaCost: 1,
  element: 'physical',
  range: 0,
  basePower: 0,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'self',
  targetingMode: 'self',
  description: 'A raider fights beside you.',
  spellType: 'summon',
  effects: [{ type: 'summon', monsterId: 'raider', friendly: true, duration: 30, range: 1 }],
};
const manifest = { ...fixtureManifest, spells: [...FIXTURE_SPELLS, CALL] };

/** The hero casts Call Raider from the row's left end, `beside` on its centre when given. */
function summon(beside?: string): { engine: GameEngine; raider: Monster } {
  const spells = beside ? ['call_raider', beside] : ['call_raider'];
  const hero = new Player({ position: { x: 2, y: 5 }, spellsKnown: spells, grimoireSystem: FIXTURE_GRIMOIRES });
  const state = hero.grimoireState as GrimoireState;
  state.opened = ['row', 'star', 'grid'];
  state.placements = spells.map((spellId, i) => ({ grimoireId: 'row', x: i - 1, y: 0, spellId }));
  state.statPicks = [];
  hero.restoreMana(hero.maxMana);
  const engine = new GameEngine({ map: new GameMap(16, 12, TILES.FLOOR), player: hero, floor: 1, manifest });
  expect(new CastSpellAction(hero, 'call_raider', hero.x, hero.y).perform(engine).success).toBe(true);
  const raider = engine.map.getAllEntities().find((e) => e instanceof Monster && e.faction === 'player') as Monster;
  return { engine, raider };
}

/** A sturdy foe beside the raider, away from the hero, struck until one blow lands. */
function struckFoe(engine: GameEngine, raider: Monster): Monster {
  engine.map.moveEntity(raider, 10, 8);
  const foe = new Monster({ id: 'dummy', name: 'Dummy', position: { x: 11, y: 8 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 }, speed: 100 });
  engine.map.addEntity(foe);
  for (let i = 0; i < 30 && foe.hp === foe.maxHp; i++) new MeleeAttackAction(raider, foe).perform(engine);
  expect(foe.hp).toBeLessThan(foe.maxHp);
  return foe;
}

const has = (m: Monster, status: string) => m.statusManager.hasStatus(status as StatusType);

describe("a summon's hits carry what its cast borrowed", () => {
  it('a fire neighbour sets each blow burning', () => {
    const { engine, raider } = summon('forge_bolt');
    expect(raider.lentHits?.spellId).toBe('call_raider');
    expect(has(struckFoe(engine, raider), 'burning')).toBe(true);
  });

  it('with no neighbour it carries nothing', () => {
    const { engine, raider } = summon();
    expect(raider.lentHits).toBeUndefined();
    expect(has(struckFoe(engine, raider), 'burning')).toBe(false);
  });

  it('what it carries saves and loads with it', () => {
    const { engine, raider } = summon('forge_bolt');
    const loaded = deserializeMapObject(JSON.parse(JSON.stringify(serializeMapObject(engine.map))));
    const again = loaded.getAllEntities().find((e) => e.id === raider.id) as Monster;
    expect(again.lentHits).toEqual(raider.lentHits);
  });
});
