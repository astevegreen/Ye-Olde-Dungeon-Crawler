import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MeleeAttackAction } from '../../actions/combat';
import { MonsterAI } from '../behaviorTree';

function caster(x: number, y: number): Monster {
  return new Monster({
    id: 'caster',
    name: 'Caster',
    position: { x, y },
    stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'caster',
    aiState: 'hunting',
    spells: ['firebolt'],
    spellCooldown: 2,
    xpValue: 1,
    lootTable: [],
  });
}

function brute(x: number, y: number): Monster {
  return new Monster({
    id: 'escort',
    name: 'Escort',
    position: { x, y },
    stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'melee',
    aiState: 'hunting',
    xpValue: 1,
    lootTable: [],
  });
}

/** An open hall, the hero on its west side. */
function hall() {
  const map = new GameMap(24, 12, TILES.WALL);
  for (let y = 1; y < 11; y++) for (let x = 1; x < 23; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 4, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  return { engine: new GameEngine({ map, player }), player };
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('casters with melee allies in front', () => {
  it('keep their distance between casts instead of closing in', () => {
    const { engine, player } = hall();
    engine.addEntity(brute(5, 5));
    const mage = caster(8, 5);
    engine.addEntity(mage);

    let closest = chebyshev(mage, player);
    for (let t = 0; t < 6; t++) {
      mage.takeTurn(engine);
      closest = Math.min(closest, chebyshev(mage, player));
    }

    expect(closest).toBeGreaterThanOrEqual(3);
  });

  it('step back out of reach rather than trade blows', () => {
    const { engine, player } = hall();
    engine.addEntity(brute(4, 4));
    const mage = caster(5, 5);
    engine.addEntity(mage);

    expect(MonsterAI.decideAction(mage, engine)).not.toBeInstanceOf(MeleeAttackAction);
    mage.takeTurn(engine);
    expect(chebyshev(mage, player)).toBeGreaterThan(1);
  });

  it('still close in to fight between casts when alone', () => {
    const { engine, player } = hall();
    const mage = caster(8, 5);
    engine.addEntity(mage);

    for (let t = 0; t < 4; t++) mage.takeTurn(engine);

    expect(chebyshev(mage, player)).toBeLessThan(4);
  });
});
