import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';

function monster(id: string, x: number, y: number, hp: number, aiState: 'hunting' | 'sleeping'): Monster {
  return new Monster({
    id,
    name: id === 'coward' ? 'Coward' : 'Friend',
    position: { x, y },
    stats: { hp, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'melee',
    aiState,
    fleeHealthPercent: 0.5,
    xpValue: 1,
    lootTable: [],
  });
}

/** An open 24×14 hall; the hero on its west side, a wounded monster east of the hero. */
function hall() {
  const map = new GameMap(24, 14, TILES.WALL);
  for (let y = 1; y < 13; y++) for (let x = 1; x < 23; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 4, y: 4 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  const coward = monster('coward', 8, 4, 5, 'hunting');
  engine.addEntity(coward);
  return { engine, player, coward };
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('a monster that breaks and runs', () => {
  it('calls for help: a sleeping ally nearby wakes and knows where the hero is', () => {
    const { engine, coward } = hall();
    const friend = monster('friend', 10, 11, 40, 'sleeping');
    engine.addEntity(friend);

    coward.takeTurn(engine);

    expect(friend.aiState).toBe('hunting');
    expect(engine.messages.some((m) => m.includes('Coward') && m.includes('help'))).toBe(true);
  });

  it('calls only once while it runs', () => {
    const { engine, coward } = hall();
    engine.addEntity(monster('friend', 10, 11, 40, 'sleeping'));

    for (let t = 0; t < 4; t++) coward.takeTurn(engine);

    expect(engine.messages.filter((m) => m.includes('help')).length).toBe(1);
  });

  it('runs to an ally on its side rather than straight away from the hero', () => {
    const { engine, coward } = hall();
    const friend = monster('friend', 8, 11, 40, 'hunting');
    engine.addEntity(friend);

    for (let t = 0; t < 6; t++) coward.takeTurn(engine);

    expect(chebyshev(coward, friend)).toBeLessThanOrEqual(1);
  });

  it('does not run past the hero to reach an ally behind the hero', () => {
    const { engine, player, coward } = hall();
    engine.addEntity(monster('friend', 1, 4, 40, 'hunting'));

    for (let t = 0; t < 4; t++) coward.takeTurn(engine);

    expect(chebyshev(coward, player)).toBeGreaterThan(4);
  });
});
