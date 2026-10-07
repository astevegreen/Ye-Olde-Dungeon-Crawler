import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { KitingRangedStrategy } from '../aiRegistry';
import { WindUpDeclareAction } from '../../actions/combat';

/**
 * Piercing Snipe, the kiting archers' telegraphed shot. At 2.8x attack it took about a
 * third of a level-6 hero's HP per hit (Gálmr the Frost-Warden, floor 5, killed 36% of
 * the floor 1-10 playtest's heroes); the owner asked for it softened, to 1.8x.
 */
describe('Piercing Snipe', () => {
  it('telegraphs a 1.8x shot along the line to a hero 3-7 tiles off', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 5, y: 5 }, stats: { hp: 80, maxHp: 80, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 7 });
    const archer = new Monster({
      id: 'archer-1',
      name: 'Archer',
      position: { x: 9, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 12, defense: 0 },
      aiType: 'ranged',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });
    engine.addEntity(archer);
    engine.updateFov();

    const action = new KitingRangedStrategy().decideAction(archer, engine);

    expect(action).toBeInstanceOf(WindUpDeclareAction);
    const snipe = action as WindUpDeclareAction;
    expect(snipe.abilityName).toBe('Piercing Snipe');
    expect(snipe.options?.multiplier).toBe(1.8);
  });
});

describe('Piercing Snipe is an archer\'s shot', () => {
  it('a caster whose spells are on cooldown does not draw a bowstring', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 5, y: 5 }, stats: { hp: 80, maxHp: 80, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 7 });
    const howler = new Monster({
      id: 'howler-1',
      name: 'Howler',
      position: { x: 9, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 12, defense: 0 },
      aiType: 'caster',
      aiState: 'hunting',
      spells: ['slow'],
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });
    howler.spellCooldown = 2;
    engine.addEntity(howler);
    engine.updateFov();

    const action = new KitingRangedStrategy().decideAction(howler, engine);

    expect(action instanceof WindUpDeclareAction && action.abilityName === 'Piercing Snipe').toBe(false);
  });
});

/**
 * R-ai-13: a spell-less archer one step from the hero backed off to distance 2, where it
 * could not snipe (3+) and so closed in to 1 again: 1, 2, 1, 2 forever, never shooting.
 */
describe('R-ai-13 · an archer at distance 2 backs off or shoots, never dances', () => {
  function archerAt(x: number, map: GameMap) {
    const player = new Player({ id: 'hero', position: { x: 5, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 7 });
    const archer = new Monster({
      id: 'archer-1',
      name: 'Archer',
      position: { x, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 12, defense: 0 },
      aiType: 'ranged',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });
    engine.addEntity(archer);
    engine.updateFov();
    return { engine, archer, player };
  }

  it('with room behind it, it steps away rather than closing in', () => {
    const { engine, archer, player } = archerAt(7, new GameMap(20, 20, TILES.FLOOR));
    const action = new KitingRangedStrategy().decideAction(archer, engine);
    const dx = (action as unknown as { dx: number }).dx;
    expect(action.constructor.name).toBe('MovementAction');
    expect(Math.abs(archer.x + dx - player.x)).toBeGreaterThan(2);
  });

  it('with its back to the wall, it shoots from 2', () => {
    // A corridor: the hero at x=5, the archer at x=7 against the wall at x=8.
    const map = new GameMap(20, 20, TILES.WALL);
    for (let x = 1; x <= 7; x++) map.setTile(x, 5, TILES.FLOOR);
    const { engine, archer } = archerAt(7, map);
    const action = new KitingRangedStrategy().decideAction(archer, engine);
    expect(action).toBeInstanceOf(WindUpDeclareAction);
  });
});
