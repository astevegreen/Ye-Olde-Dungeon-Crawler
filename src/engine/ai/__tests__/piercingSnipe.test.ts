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
