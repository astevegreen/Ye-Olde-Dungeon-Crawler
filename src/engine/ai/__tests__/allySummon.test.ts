import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterRegistry, type MonsterDefinition } from '../../bestiary/monsterDefinitions';
import { SpellPipeline } from '../../magic/spellPipeline';
import { MeleeAttackAction } from '../../actions/combat';

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
