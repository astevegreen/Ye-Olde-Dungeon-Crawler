import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import {
  createTestSkeleton,
  createTestKobold,
  createTestKoboldShaman,
} from '../../__fixtures__/testHelpers';
import { GameEngine } from '../../engine';
import { findPath } from '../pathfinding';
import { MonsterAI } from '../behaviorTree';
import { CastSpellAction } from '../../actions/spell-actions';
import { MovementAction } from '../../actions/movement';
import { OpenDoorAction } from '../../actions/door';
import { WindUpDeclareAction } from '../../actions/combat';

describe('Monster AI Behaviors & Pathfinding', () => {
  it('navigates around solid walls using BFS pathfinding', () => {
    // 7x7 grid with a wall obstacle in the center
    const map = new GameMap(7, 7, TILES.FLOOR);
    for (let y = 1; y <= 5; y++) {
      map.setTile(3, y, TILES.WALL); // Vertical wall at x=3
    }
    // Leave a gap at (3, 0)
    map.setTile(3, 0, TILES.FLOOR);

    const start = { x: 1, y: 3 };
    const goal = { x: 5, y: 3 };

    const path = findPath(map, start, goal);
    expect(path.length).toBeGreaterThan(0);
    // Path must navigate up through the corridor gap at y=0
    expect(path.some((p) => p.x === 3 && p.y === 0)).toBe(true);
    // Path ends at the goal
    expect(path[path.length - 1]).toEqual(goal);
  });

  it('recognizes closed doors and selects OpenDoorAction', () => {
    const map = new GameMap(7, 3, TILES.FLOOR);
    map.setTile(3, 1, TILES.DOOR_CLOSED);

    const player = new Player({ position: { x: 5, y: 1 } });
    const skeleton = createTestSkeleton('skel-1', { x: 2, y: 1 });
    skeleton.aiState = 'combat';

    const engine = new GameEngine({ map, player });
    engine.addEntity(skeleton);

    const action = MonsterAI.decideAction(skeleton, engine);
    expect(action).toBeInstanceOf(OpenDoorAction);
    const doorAction = action as OpenDoorAction;
    expect(doorAction.x).toBe(3);
    expect(doorAction.y).toBe(1);
  });

  it('transitions from sleeping to combat upon sighting or damage', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({ position: { x: 2, y: 2 } });
    const kobold = createTestKobold('kob-1', { x: 5, y: 2 });
    expect(kobold.aiState).toBe('sleeping');

    const engine = new GameEngine({ map, player });
    engine.addEntity(kobold);

    // With clear line of sight, decideAction awakens kobold
    MonsterAI.decideAction(kobold, engine);
    expect(['hunting', 'combat']).toContain(kobold.aiState);

    // Damage also immediately awakens sleeping monster
    const sleeper = createTestKobold('sleeper-1', { x: 10, y: 10 });
    expect(sleeper.aiState).toBe('sleeping');
    sleeper.takeDamage(2);
    expect(['hunting', 'combat']).toContain(sleeper.aiState);
  });

  it('tactical caster (Kobold Shaman) fires ranged spells when line of sight is clear', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({ position: { x: 2, y: 2 } });
    const shaman = createTestKoboldShaman('shaman-1', { x: 5, y: 2 });
    shaman.aiState = 'combat';

    const engine = new GameEngine({ map, player });
    engine.addEntity(shaman);

    // Distance is 3 tiles along x, clear line of fire -> should cast spell or declare Incinerate wind-up
    const action = MonsterAI.decideAction(shaman, engine);
    if (action instanceof WindUpDeclareAction) {
      expect(['Incinerate', 'Hellfire Surge']).toContain(action.abilityName);
      expect(action.targetTile).toEqual({ x: player.x, y: player.y });
    } else {
      expect(action).toBeInstanceOf(CastSpellAction);
      const spellAction = action as CastSpellAction;
      expect(['firebolt', 'slow']).toContain(spellAction.spellId);
      expect(spellAction.targetX).toBe(player.x);
      expect(spellAction.targetY).toBe(player.y);
    }
  });

  it('monsters with flee threshold step away when low on health', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ position: { x: 4, y: 4 } });
    const kobold = createTestKobold('kob-flee', { x: 5, y: 4 });
    kobold.aiState = 'combat';

    const engine = new GameEngine({ map, player });
    engine.addEntity(kobold);

    // Kobold has 10 max HP and fleeHealthPercent 0.25 (flees at <= 2 HP)
    kobold.hp = 2;

    const action = MonsterAI.decideAction(kobold, engine);
    expect(action).toBeInstanceOf(MovementAction);
    const moveAction = action as MovementAction;

    // Movement must increase distance from player (player is at x=4, so kobold moves to x=6)
    expect(moveAction.dx).toBe(1);
    expect(kobold.aiState).toBe('fleeing');
  });
});
