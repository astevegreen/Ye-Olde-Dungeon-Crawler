import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { createTestGoblin, createTestGiantRat } from '../../__fixtures__/testHelpers';
import { GameEngine } from '../../engine';
import { RestAction } from '../../actions/rest';

describe('Resting Engine and FOV Interruption', () => {
  it('rests peacefully until HP and Mana are fully restored when safe', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'hero',
      position: { x: 5, y: 5 },
      stats: { hp: 10, maxHp: 30, attack: 5, defense: 2 },
      mana: 5,
      maxMana: 25,
    });
    const engine = new GameEngine({ map, player });

    const restAction = new RestAction(player, 50);
    const result = restAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.hp).toBe(30);
    expect(player.mana).toBe(25);
    expect(result.message).toContain('fully restored');
  });

  it('refuses to start resting if a hostile monster is already visible in FOV', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      id: 'hero',
      position: { x: 2, y: 2 },
      stats: { hp: 15, maxHp: 30, attack: 5, defense: 2 },
      mana: 10,
      maxMana: 30,
    });
    const goblin = createTestGoblin('goblin-1', { x: 4, y: 2 });
    const engine = new GameEngine({ map, player });
    engine.addEntity(goblin);

    expect(engine.fov.isVisible(goblin.x, goblin.y)).toBe(true);

    const restAction = new RestAction(player);
    const result = restAction.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cannot rest');
  });

  it('halts resting immediately when a monster enters the player line of sight', () => {
    // Corridor setup: player at (1, 1), fovRadius = 4
    // Monster at (7, 1) which is at distance 6 (outside FOV radius 4)
    const map = new GameMap(12, 3, TILES.FLOOR);
    const player = new Player({
      id: 'hero',
      position: { x: 1, y: 1 },
      stats: { hp: 5, maxHp: 30, attack: 5, defense: 2 },
      mana: 5,
      maxMana: 30,
    });
    const engine = new GameEngine({ map, player, fovRadius: 4 });

    const rat = createTestGiantRat('rat-1', { x: 7, y: 1 });
    engine.addEntity(rat);

    // Initial check: rat at x=7 is outside fovRadius=4
    expect(engine.fov.isVisible(rat.x, rat.y)).toBe(false);

    // When resting begins, rat moves closer: (7, 1) -> (6, 1) -> (5, 1)
    // At x=5, distance is 4, which enters player's FOV!
    const restAction = new RestAction(player, 100);
    const result = restAction.perform(engine);

    expect(result.success).toBe(true);
    // Because monster enters FOV after ~2-3 turns, rest terminates before full recovery
    expect(player.hp).toBeLessThan(30);
    expect(result.message).toContain('Rest interrupted');
  });
});
