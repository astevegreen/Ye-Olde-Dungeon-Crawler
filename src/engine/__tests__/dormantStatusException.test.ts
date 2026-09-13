import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { WaitAction } from '../actions/wait';
import * as pathfinding from '../ai/pathfinding';

describe('Dormant Actor Scheduling', () => {
  it('dormant sleeping monster ticks status effect on schedule without executing AI pathfinding or combat', () => {
    // 1. Setup isolated map with player at (2, 2) and sleeping monster at (20, 20)
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      id: 'player-hero',
      name: 'Hero',
      position: { x: 2, y: 2 },
      speed: 100,
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });

    const sleepingMonster = new Monster({
      id: 'dormant-troll',
      name: 'Sleeping Cave Troll',
      position: { x: 20, y: 20 },
      speed: 100,
      aiState: 'sleeping',
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 4 },
    });

    const engine = new GameEngine({ map, player });
    engine.addEntity(sleepingMonster);

    // 2. Apply poison status effect to the sleeping monster (duration: 5, potency: 3)
    sleepingMonster.statusManager.applyStatus(
      {
        type: 'poison',
        duration: 5,
        potency: 3,
        sourceEntityId: 'trap-1',
      },
      [],
      sleepingMonster,
      engine
    );

    expect(sleepingMonster.hp).toBe(50);
    expect(sleepingMonster.statusManager.hasStatus('poison')).toBe(true);
    expect(sleepingMonster.statusManager.getStatus('poison')?.duration).toBe(5);

    // 3. Spy on findPath to confirm A* pathfinding is NEVER invoked for dormant entity
    const findPathSpy = vi.spyOn(pathfinding, 'findPath');

    const initialPlayerHp = player.hp;

    // 4. Advance 3 turns with player waiting
    for (let t = 1; t <= 3; t++) {
      const wait = new WaitAction(player);
      const res = engine.handlePlayerAction(wait);
      expect(res.success).toBe(true);
    }

    // 5. Assert: Status effect still ticked down and dealt damage on schedule
    expect(sleepingMonster.statusManager.getStatus('poison')?.duration).toBe(2);
    // 3 ticks of poison dealing 3 potency damage each = 9 damage
    expect(sleepingMonster.hp).toBe(41);

    // 6. Assert: Monster remained dormant, never ran AI pathfinding or combat
    expect(sleepingMonster.aiState).toBe('sleeping');
    expect(sleepingMonster.x).toBe(20);
    expect(sleepingMonster.y).toBe(20);
    expect(findPathSpy).not.toHaveBeenCalled();
    expect(player.hp).toBe(initialPlayerHp);

    findPathSpy.mockRestore();
  });
});
