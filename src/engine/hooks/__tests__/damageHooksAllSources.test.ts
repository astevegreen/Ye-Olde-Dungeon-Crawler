import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../../magic/spellPipeline';
import { WindUpExecuteAction } from '../../actions/combat';
import type { SpellDefinition } from '../../magic/types';
import type { HookDescriptor } from '../hookDispatcher';

/**
 * R-pipe-23 (owner, 2026-10-07: "fire for all damage"): onHit and onDamageTaken fired only
 * from melee, so a Bellows-Plate's soot never answered a firebolt and a monster's on-hit
 * venom never rode its breath. Spell and wind-up damage dispatch them too; onBlock stays
 * melee's, the only blow with a block.
 */

const blindTheAttacker: HookDescriptor = {
  event: 'onDamageTaken',
  chance: 1,
  action: { type: 'applyStatus', status: 'blindness', duration: 2 },
  description: 'Soot!',
} as HookDescriptor;

const poisonTheTarget: HookDescriptor = {
  event: 'onHit',
  chance: 1,
  action: { type: 'applyStatus', status: 'poisoned', duration: 3 },
  description: 'Venom!',
} as HookDescriptor;

function setup(hooks: HookDescriptor[]) {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, stats: { hp: 200, maxHp: 200, attack: 5, defense: 0 } });
  const monster = new Monster({
    id: 'bellows',
    name: 'Bellows',
    position: { x: 4, y: 3 },
    stats: { hp: 500, maxHp: 500, attack: 10, defense: 0 },
    hooks,
  });
  monster.faction = 'hostile';
  map.addEntity(monster);
  const engine = new GameEngine({ map, player, floor: 1 });
  return { engine, player, monster };
}

const firebolt = {
  id: 'firebolt',
  name: 'Firebolt',
  school: 'Evocation',
  manaCost: 0,
  element: 'fire',
  range: 5,
  basePower: 0,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'entity',
  description: 'A bolt.',
  effects: [{ type: 'damage', amount: 5, element: 'fire' }],
} as unknown as SpellDefinition;

describe('R-pipe-23 · damage hooks fire for spells and wind-ups, not only melee', () => {
  it('a spell that wounds a monster fires its onDamageTaken', () => {
    const { engine, player, monster } = setup([blindTheAttacker]);
    SpellPipeline.applyDamageEffect(engine, firebolt, player, monster, { type: 'damage', amount: 5, element: 'fire' });
    expect(monster.hp).toBeLessThan(500);
    expect(player.statusManager.hasStatus('blindness')).toBe(true);
  });

  it('a wind-up that lands fires the monster\'s onHit', () => {
    const { engine, player, monster } = setup([poisonTheTarget]);
    monster.energy = 100;
    new WindUpExecuteAction(monster, { x: player.x, y: player.y }, 'Breath', 1.5).perform(engine);
    expect(player.hp).toBeLessThan(200);
    expect(player.statusManager.hasStatus('poisoned')).toBe(true);
  });

  it('a spell the target is immune to fires nothing', () => {
    const { engine, player, monster } = setup([blindTheAttacker]);
    monster.elementalResistances = { fire: 'immune' };
    SpellPipeline.applyDamageEffect(engine, firebolt, player, monster, { type: 'damage', amount: 5, element: 'fire' });
    expect(player.statusManager.hasStatus('blindness')).toBe(false);
  });
});
