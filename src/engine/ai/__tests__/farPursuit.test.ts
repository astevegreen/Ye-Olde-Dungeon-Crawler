import { describe, expect, it } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { createTestKobold, createTestKoboldShaman } from '../../__fixtures__/testHelpers';
import type { Monster } from '../../entities/monster';

/** A 40x9 hall with a wall across it, open only at the top, so a beeline doesn't work. */
function hall(monster: Monster) {
  const map = new GameMap(40, 9, TILES.WALL);
  for (let y = 1; y < 8; y++) for (let x = 1; x < 39; x++) map.setTile(x, y, TILES.FLOOR);
  for (let y = 2; y < 8; y++) map.setTile(20, y, TILES.WALL);
  const player = new Player({ position: { x: 36, y: 6 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  map.addEntity(player);
  map.addEntity(monster);
  monster.aiState = 'hunting';
  return { engine: new GameEngine({ map, player }), player };
}

describe('awake monsters far from the hero', () => {
  it('a melee monster more than 10 tiles away comes for the hero, around walls', () => {
    const kobold = createTestKobold('far-kobold', { x: 3, y: 6 });
    const { engine, player } = hall(kobold);
    const start = Math.hypot(kobold.x - player.x, kobold.y - player.y);
    expect(start).toBeGreaterThan(10);

    for (let t = 0; t < 12; t++) kobold.takeTurn(engine);

    expect(Math.hypot(kobold.x - player.x, kobold.y - player.y)).toBeLessThan(start - 5);
  });

  it('a caster more than 10 tiles away closes in too', () => {
    const shaman = createTestKoboldShaman('far-shaman', { x: 3, y: 6 });
    const { engine, player } = hall(shaman);
    const start = Math.hypot(shaman.x - player.x, shaman.y - player.y);

    for (let t = 0; t < 12; t++) shaman.takeTurn(engine);

    expect(Math.hypot(shaman.x - player.x, shaman.y - player.y)).toBeLessThan(start - 5);
  });
});
