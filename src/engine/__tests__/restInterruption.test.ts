import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { AutoRestManager } from '../actions/autoRest';
import { Monster } from '../entities/monster';

describe('resting under fire', () => {
  it('a hit during the monsters\' turns stops the rest, even from an attacker out of sight', () => {
    const map = new GameMap(20, 9, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 3, y: 4 }, stats: { hp: 40, maxHp: 400, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, seed: 3 });
    // Blind: the hero sees one tile, so the archer four tiles off is never "in sight".
    player.statusManager.applyStatus({ type: 'blindness', duration: 200 });
    // An archer: a kiting monster with no spells, so it looses Piercing Snipes from range.
    const archer = new Monster({
      id: 'archer',
      name: 'Archer',
      position: { x: 7, y: 4 },
      stats: { hp: 30, maxHp: 30, attack: 8, defense: 0 },
      aiType: 'caster',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(archer);
    engine.updateFov();
    expect(engine.fov.isVisible(archer.x, archer.y)).toBe(false);

    const result = AutoRestManager.executeFullRest(engine, 100);

    expect(result.interrupted).toBe(true);
    expect(result.reason).toContain('damage');
    expect(result.turn).toBeLessThan(10);
  });
});
