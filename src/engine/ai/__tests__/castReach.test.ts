import { describe, it, expect, afterAll } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterAI } from '../behaviorTree';
import { SpellRegistry } from '../../magic/spellRegistry';
import { activateRegistries } from '../../registries';
import { CastSpellAction } from '../../actions/spell-actions';
import { traceProjectile } from '../../magic/targeting';
import { hasLineOfSight } from '../perception';

/**
 * P-36 soak: a Troll-Wife Warlock and the hero traded 1,358 shots on floor 18, every one into a
 * wall. The sight line (a Bresenham line) steps diagonally past a pillar's corner, while the
 * bolt flies centre to centre and clips it: a monster casts only when its flight would reach.
 */

const bolt = {
  id: 'reach_bolt',
  name: 'Bolt',
  school: 'Combat',
  manaCost: 5,
  element: 'physical',
  range: 7,
  basePower: 8,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'ray',
  targetingMode: 'ray',
  description: '',
  effects: [{ type: 'damage', amount: 8, element: 'physical' }],
};

const CASTER = { x: 5, y: 5 };
const HERO = { x: 8, y: 7 };
const PILLAR = { x: 7, y: 7 };

afterAll(() => {
  activateRegistries(null);
  SpellRegistry.clear();
});

function setup(aiType: string) {
  SpellRegistry.register(bolt as never);
  const map = new GameMap(16, 14, TILES.FLOOR);
  map.setTile(PILLAR.x, PILLAR.y, TILES.WALL);
  const player = new Player({ id: 'hero', name: 'Hero', position: HERO, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  const caster = new Monster({
    id: 'warlock',
    name: 'Warlock',
    position: CASTER,
    stats: { hp: 40, maxHp: 40, attack: 4, defense: 3 },
    aiType,
    aiRoutineId: aiType,
    aiState: 'hunting',
    spells: ['reach_bolt'],
    xpValue: 1,
    lootTable: [],
  } as never);
  engine.addEntity(caster);
  return { engine, map, caster };
}

describe('a monster casts only when its flight would reach the hero', () => {
  it('the corner: the sight line is clear and the bolt hits the pillar', () => {
    const { engine, map } = setup('caster');
    expect(hasLineOfSight(engine, CASTER, HERO)).toBe(true);
    const ray = traceProjectile(map, CASTER.x, CASTER.y, HERO.x, HERO.y, bolt.range, false, 'warlock');
    expect(ray.wallTile).toEqual(PILLAR);
  });

  for (const aiType of ['caster', 'kiting_ranged', 'immobile_turret']) {
    it(`${aiType}: holds the cast past the corner, and casts with the pillar gone`, () => {
      const { engine, map, caster } = setup(aiType);

      expect(MonsterAI.decideAction(caster, engine)).not.toBeInstanceOf(CastSpellAction);

      map.setTile(PILLAR.x, PILLAR.y, TILES.FLOOR);
      caster.setPosition(CASTER.x, CASTER.y);
      caster.spellCooldown = 0;
      expect(MonsterAI.decideAction(caster, engine)).toBeInstanceOf(CastSpellAction);
    });
  }
});
