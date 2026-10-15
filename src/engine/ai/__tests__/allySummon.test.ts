import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterRegistry, type MonsterDefinition } from '../../bestiary/monsterDefinitions';
import { SpellPipeline } from '../../magic/spellPipeline';
import { MeleeAttackAction } from '../../actions/combat';
import { Companion } from '../../entities/companion';
import { selectAttackTarget } from '../targetSelection';

const WOLF = { id: 'test_wolf', name: 'Wolf', stats: { hp: 30, maxHp: 30, attack: 6, defense: 0 }, speed: 100, aiType: 'melee', xpValue: 1 } as MonsterDefinition;

function setup(): { engine: GameEngine; hero: Player; wolf: Monster } {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const hero = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  const engine = new GameEngine({ map, player: hero });
  engine.registries.monsters.register(WOLF);
  SpellPipeline.executeSummonEffect(engine, hero, { type: 'summon', monsterId: 'test_wolf', duration: 50, friendly: true });
  const wolf = engine.map.getAllEntities().find((e) => e.name === 'Wolf') as Monster;
  return { engine, hero, wolf };
}

function addRat(engine: GameEngine, x: number, y: number): Monster {
  const rat = new Monster({ id: 'rat', name: 'Rat', position: { x, y }, stats: { hp: 200, maxHp: 200, attack: 1, defense: 0 }, aiType: 'melee', aiState: 'sleeping' });
  engine.addEntity(rat);
  return rat;
}

describe('a friendly summon fights foes and never its own side (3a)', () => {
  beforeEach(() => MonsterRegistry.clear());
  afterEach(() => MonsterRegistry.clear());

  it('a summoned wolf goes for the rat, not the hero', () => {
    const { engine, hero, wolf } = setup();
    const rat = addRat(engine, 10, 5);
    const heroHp = hero.hp;

    for (let i = 0; i < 15; i++) wolf.takeTurn(engine);

    expect(rat.hp).toBeLessThan(rat.maxHp);
    expect(hero.hp).toBe(heroHp);
  });

  it('with no foe about, the wolf keeps near the hero and never strikes them', () => {
    const { engine, hero, wolf } = setup();
    engine.map.moveEntity(wolf, 11, 11);
    const heroHp = hero.hp;

    for (let i = 0; i < 15; i++) wolf.takeTurn(engine);

    expect(hero.hp).toBe(heroHp);
    expect(Math.max(Math.abs(wolf.x - hero.x), Math.abs(wolf.y - hero.y))).toBeLessThanOrEqual(2);
  });

  it('a melee blow between two of the hero\'s side is refused and costs nothing', () => {
    const { engine, hero, wolf } = setup();
    const heroHp = hero.hp;

    const result = new MeleeAttackAction(wolf, hero).perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(hero.hp).toBe(heroHp);
  });
});

describe('monsters go for the nearest of the hero\'s side they see, and a decoy first (3a)', () => {
  beforeEach(() => MonsterRegistry.clear());
  afterEach(() => MonsterRegistry.clear());

  function scene(): { engine: GameEngine; hero: Player; rat: Monster } {
    const map = new GameMap(16, 9, TILES.FLOOR);
    const hero = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 4 } });
    const engine = new GameEngine({ map, player: hero });
    engine.registries.monsters.register(WOLF);
    const rat = addRat(engine, 8, 4);
    return { engine, hero, rat };
  }

  function friend(engine: GameEngine, x: number, y: number, decoy = false): Monster {
    SpellPipeline.executeSummonEffect(engine, engine.player, { type: 'summon', monsterId: 'test_wolf', duration: 50, friendly: true, decoy });
    const wolf = engine.map.getAllEntities().filter((e) => e.name === 'Wolf').at(-1) as Monster;
    engine.map.moveEntity(wolf, x, y);
    return wolf;
  }

  it('the hero, when no ally is about', () => {
    const { engine, hero, rat } = scene();
    expect(selectAttackTarget(engine, rat)).toBe(hero);
  });

  it('a summoned wolf nearer than the hero', () => {
    const { engine, rat } = scene();
    const wolf = friend(engine, 10, 4);
    expect(selectAttackTarget(engine, rat)).toBe(wolf);
  });

  it('the companion nearer than the hero', () => {
    const { engine, rat } = scene();
    const companion = new Companion({ id: 'comp', name: 'Hound', position: { x: 9, y: 5 }, stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 }, speed: 100, companionDefinitionId: 'hound', packWeightCapacity: 1, packBulkCapacity: 1 });
    engine.addEntity(companion);
    expect(selectAttackTarget(engine, rat)).toBe(companion);
  });

  it('not an ally it cannot see', () => {
    const { engine, hero, rat } = scene();
    for (let y = 0; y < 9; y++) engine.map.setTile(10, y, TILES.WALL);
    friend(engine, 12, 4);
    expect(selectAttackTarget(engine, rat)).toBe(hero);
  });

  it('a decoy before a nearer hero', () => {
    const { engine, hero, rat } = scene();
    engine.map.moveEntity(hero, 7, 4);
    const decoy = friend(engine, 13, 4, true);
    expect(decoy.statusManager.getStatus('decoy')?.duration).toBe(50);
    expect(selectAttackTarget(engine, rat)).toBe(decoy);
  });

  it('and the rat strikes the wolf beside it, not the hero', () => {
    const { engine, hero, rat } = scene();
    const wolf = friend(engine, 9, 4);
    rat.aiState = 'hunting';
    const heroHp = hero.hp;
    for (let i = 0; i < 10; i++) rat.takeTurn(engine);
    expect(wolf.hp).toBeLessThan(wolf.maxHp);
    expect(hero.hp).toBe(heroHp);
  });
});
