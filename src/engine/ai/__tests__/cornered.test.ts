import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterAI } from '../behaviorTree';
import { MovementAction } from '../../actions/movement';
import type { AiBehaviorType } from '../../bestiary/monsterDefinitions';

/** A walled room; the monster, wounded below its flee line, in the top-left corner. */
function cornered(aiType: AiBehaviorType) {
  const map = new GameMap(10, 10, TILES.WALL);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 4, y: 4 }, stats: { hp: 100, maxHp: 100, attack: 1, defense: 0 } });
  const engine = new GameEngine({ map, player });
  const monster = new Monster({
    id: 'runner',
    name: 'Runner',
    position: { x: 1, y: 1 },
    stats: { hp: 2, maxHp: 20, attack: 6, defense: 0 },
    aiType,
    aiState: 'hunting',
    fleeHealthPercent: 0.5,
    xpValue: 1,
    lootTable: [],
  });
  engine.addEntity(monster);
  return { engine, player, monster };
}

describe('cornered fleeing monsters', () => {
  it('a cornered melee monster stands at bay instead of stepping toward the hero and back', () => {
    const { engine, monster } = cornered('melee');

    for (let t = 0; t < 4; t++) {
      expect(MonsterAI.decideAction(monster, engine)).not.toBeInstanceOf(MovementAction);
    }
  });

  it('a cornered coward does not hit the hero from three tiles away', () => {
    const { engine, player, monster } = cornered('coward');

    for (let t = 0; t < 6; t++) monster.takeTurn(engine);

    expect(player.hp).toBe(100);
  });
});
