import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { AutoRestManager } from '../actions/autoRest';
import { createTestKoboldShaman } from '../__fixtures__/testHelpers';

describe('resting under fire', () => {
  it('a hit during the monsters\' turns stops the rest, even from an attacker out of sight', () => {
    const map = new GameMap(20, 9, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 3, y: 4 }, stats: { hp: 40, maxHp: 400, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 3 });
    // Blind: the hero sees one tile, so the shaman four tiles off is never "in sight".
    player.statusManager.applyStatus({ type: 'blindness', duration: 200 });
    const shaman = createTestKoboldShaman('shaman', { x: 7, y: 4 });
    shaman.aiState = 'hunting';
    engine.addEntity(shaman);
    engine.updateFov();
    expect(engine.fov.isVisible(shaman.x, shaman.y)).toBe(false);

    const result = AutoRestManager.executeFullRest(engine, 100);

    expect(result.interrupted).toBe(true);
    expect(result.reason).toContain('damage');
    expect(result.turn).toBeLessThan(10);
  });
});
