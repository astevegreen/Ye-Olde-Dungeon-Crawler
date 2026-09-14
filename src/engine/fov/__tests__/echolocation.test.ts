import { describe, it, expect } from 'vitest';
import {
  isAudibleEntity,
  isAudibleTile,
  getAudibleEntitiesInRadius,
  getAudibleTilesInRadius,
} from '../echolocation';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';

function buildEngine(): { engine: GameEngine; player: Player } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  const engine = new GameEngine({ map, player });
  return { engine, player };
}

function buildMonster(id: string, x: number, y: number, aiState: 'sleeping' | 'hunting' = 'hunting'): Monster {
  return new Monster({
    id,
    name: id,
    position: { x, y },
    stats: { hp: 15, maxHp: 15, attack: 4, defense: 1 },
    speed: 100,
    definitionId: 'test-monster',
    aiType: 'melee',
    aiState,
    fleeHealthPercent: 0,
    xpValue: 1,
    lootTable: [],
  });
}

describe('Sensory Masking & Echolocation (P-26)', () => {
  describe('isAudibleEntity', () => {
    it('is false for sleeping (dormant) monsters and true for awake ones', () => {
      expect(isAudibleEntity(buildMonster('a', 1, 1, 'sleeping'))).toBe(false);
      expect(isAudibleEntity(buildMonster('b', 1, 1, 'hunting'))).toBe(true);
    });

    it('is false for dead entities', () => {
      const m = buildMonster('c', 1, 1, 'hunting');
      m.hp = 0;
      expect(isAudibleEntity(m)).toBe(false);
    });
  });

  describe('isAudibleTile', () => {
    it('is true for inherently noisy tile types and false for plain floor', () => {
      const { engine } = buildEngine();
      engine.map.setTile(5, 5, TILES.SHALLOW_WATER);
      expect(isAudibleTile(engine, 5, 5)).toBe(true);
      expect(isAudibleTile(engine, 6, 6)).toBe(false); // plain floor
    });

    it('is true when a tile carries an active surface', () => {
      const { engine } = buildEngine();
      engine.map.surfaces.setSurface(7, 7, 'fire', 5);
      expect(isAudibleTile(engine, 7, 7)).toBe(true);
    });
  });

  describe('getAudibleEntitiesInRadius / getAudibleTilesInRadius', () => {
    it('finds awake monsters in radius, excludes sleeping ones and the center itself', () => {
      const { engine, player } = buildEngine();
      const awake = buildMonster('awake', 11, 10, 'hunting');
      const asleep = buildMonster('asleep', 10, 11, 'sleeping');
      engine.map.addEntity(awake);
      engine.map.addEntity(asleep);

      const matches = getAudibleEntitiesInRadius(engine, { x: player.x, y: player.y }, 4);

      expect(matches.map((e) => e.id)).toEqual(['awake']);
    });

    it('finds audible tiles within the given radius', () => {
      const { engine, player } = buildEngine();
      engine.map.setTile(player.x + 2, player.y, TILES.CHASM);
      engine.map.setTile(player.x + 8, player.y, TILES.CHASM); // out of radius

      const tiles = getAudibleTilesInRadius(engine, { x: player.x, y: player.y }, 4);

      expect(tiles).toContainEqual({ x: player.x + 2, y: player.y });
      expect(tiles).not.toContainEqual({ x: player.x + 8, y: player.y });
    });
  });

  describe('updateFov perception-radius generalization', () => {
    it('preserves existing blindness behavior: FOV radius forced to 1', () => {
      const { engine, player } = buildEngine();
      player.statusManager.applyStatus({ type: 'blindness', duration: 3 });
      engine.updateFov();

      expect(engine.fov.isVisible(player.x + 1, player.y)).toBe(true);
      expect(engine.fov.isVisible(player.x + 2, player.y)).toBe(false);
    });

    it('also forces FOV radius to 1 under sensory_masked', () => {
      const { engine, player } = buildEngine();
      player.statusManager.applyStatus({ type: 'sensory_masked', duration: 10 });
      engine.updateFov();

      expect(engine.fov.isVisible(player.x + 1, player.y)).toBe(true);
      expect(engine.fov.isVisible(player.x + 2, player.y)).toBe(false);
    });

    it('restores the normal radius once the status expires', () => {
      const { engine, player } = buildEngine();
      player.statusManager.applyStatus({ type: 'sensory_masked', duration: 10 });
      engine.updateFov();
      player.statusManager.removeStatus('sensory_masked');
      engine.updateFov();

      expect(engine.fov.isVisible(player.x + 2, player.y)).toBe(true);
    });
  });
});
