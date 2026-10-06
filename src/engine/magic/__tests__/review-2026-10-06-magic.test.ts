import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { CastSpellAction } from '../../actions/spell-actions';
import { GrimoireMatrixManager } from '../grimoireMatrix';
import { SpellPipeline } from '../spellPipeline';
import { effectiveSpellPower } from '../castNumbers';

/**
 * Whole-codebase review, 2026-10-06, area 3 (magic). Each test reproduces one finding from
 * `.prompts/codebase-review-2026-10-06/areas/03-combat.md` and is marked `it.fails` so the
 * suite stays green until the bug is fixed.
 */

const firebolt = {
  id: 'firebolt',
  name: 'Firebolt',
  school: 'Combat',
  manaCost: 12,
  element: 'fire',
  range: 9,
  basePower: 20,
  areaOfEffect: 0,
  reflects: false,
  targetType: 'ray',
  targetingMode: 'ray',
  description: 'x',
  effects: [{ type: 'damage', amount: 20, element: 'fire' }],
};

const fireball = {
  id: 'fireball',
  name: 'Fireball',
  school: 'Combat',
  manaCost: 12,
  element: 'fire',
  range: 7,
  basePower: 18,
  areaOfEffect: 1,
  reflects: false,
  targetType: 'tile',
  targetingMode: 'area_burst',
  description: 'x',
  visual: { archetype: 'projectile_burst', color: '#ef4444', burstRadius: 1 },
  effects: [{ type: 'damage', amount: 18, element: 'fire' }],
};

function monster(id: string, x: number, y: number, hp = 100): Monster {
  return new Monster({
    id,
    name: id,
    position: { x, y },
    stats: { hp, maxHp: hp, attack: 5, defense: 0 },
    speed: 100,
    definitionId: id,
    aiType: 'melee',
  } as never);
}

describe('R-cmbt-9 · the HUD cost and power (resolveCast) skip the multipliers the cast applies', () => {
  it('with a mana-cost multiplier perk, the shown cost equals the cost paid', () => {
    const map = new GameMap(16, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 3, y: 3 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
      spellsKnown: ['firebolt'],
      mana: 12,
      maxMana: 40,
    } as never);
    map.addEntity(player);
    const engine = new GameEngine({ map, player, manifest: { id: 'probe', name: 'Probe', description: 'x', spells: [firebolt] } as never });
    (player as unknown as { perkModifiers: unknown[] }).perkModifiers.push({
      id: 'perk:woven',
      name: 'Seidr-Woven',
      alignment: 'positive',
      category: 'blessed',
      manaCostMultiplier: 0.8,
      spellDamageMultiplier: 1.1,
    });
    const target = monster('m', 6, 3);
    map.addEntity(target);

    const shown = GrimoireMatrixManager.resolveCast(engine, player, 'firebolt')?.spell;
    new CastSpellAction(player, 'firebolt', 6, 3).perform(engine);
    const paid = 12 - player.mana;

    expect(shown?.manaCost).toBe(paid);
    expect(effectiveSpellPower(engine, player, shown!)).toBe(100 - target.hp); // 20 × 1.1
  });
});

describe('R-cmbt-10 · an area burst has no faction rule: the caster is in their own blast', () => {
  it.fails('a fireball cast at an adjacent monster does not burn the caster', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } });
    map.addEntity(player);
    const engine = new GameEngine({ map, player });
    const target = monster('target', 4, 3);
    map.addEntity(target);

    SpellPipeline.executeSpell(engine, fireball as never, player, { x: 4, y: 3 });

    expect(100 - target.hp).toBeGreaterThan(0); // the target burns (passes today)
    expect(100 - player.hp).toBe(0); // the caster should not
  });
});
