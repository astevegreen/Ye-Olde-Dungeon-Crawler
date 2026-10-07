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
import { castGeometry } from '../castTrace';

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

describe('R-cmbt-10 · a burst hurts its caster (owner Q1, classic CotW); a hero it kills is slain by the spell', () => {
  it('a fireball cast at an adjacent monster burns the caster as well as the target', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } });
    map.addEntity(player);
    const engine = new GameEngine({ map, player });
    const target = monster('target', 4, 3);
    map.addEntity(target);

    SpellPipeline.executeSpell(engine, fireball as never, player, { x: 4, y: 3 });

    expect(100 - target.hp).toBeGreaterThan(0);
    expect(100 - player.hp).toBeGreaterThan(0);
  });

  it('a hero killed by their own fireball is "Slain by their own Fireball", not by their own name', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ name: 'Sigrun', position: { x: 3, y: 3 }, stats: { hp: 5, maxHp: 100, attack: 10, defense: 0 } });
    map.addEntity(player);
    const engine = new GameEngine({ map, player });
    map.addEntity(monster('target', 4, 3));

    SpellPipeline.executeSpell(engine, fireball as never, player, { x: 4, y: 3 });

    expect(player.isAlive()).toBe(false);
    expect(engine.gameState.runStatus).toBe('fallen');
    expect(engine.gameState.killerName).toBe('their own Fireball');
    expect(engine.gameState.causeOfDeath).toMatch(/^Slain by their own Fireball on Floor/);
  });
});

describe('R-rend-4 · the aim preview and the cast share one geometry (castGeometry)', () => {
  it('a Fireball aimed at an empty tile three away bursts there, not at the end of its range', () => {
    const map = new GameMap(20, 9, TILES.FLOOR);
    const player = new Player({ position: { x: 3, y: 4 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } });
    map.addEntity(player);
    const engine = new GameEngine({ map, player });

    const geo = castGeometry(engine, fireball as never, player, { x: 6, y: 4 });

    expect(geo.burst?.epicenter).toEqual({ x: 6, y: 4 });
    const cast = SpellPipeline.executeSpell(engine, fireball as never, player, { x: 6, y: 4 });
    const burst = cast.effects?.find((e) => e.type === 'burst') as { epicenter: { x: number; y: number } } | undefined;
    expect(burst?.epicenter).toEqual(geo.burst?.epicenter);
  });

  it('a ray of an element that reflects bounces in the preview as in the cast', async () => {
    const { cotwManifest } = await import('../../../content/cotw');
    const map = new GameMap(12, 7, TILES.WALL);
    for (let y = 1; y < 6; y++) for (let x = 1; x < 11; x++) map.setTile(x, y, TILES.FLOOR);
    const player = new Player({ position: { x: 2, y: 3 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 } });
    map.addEntity(player);
    const engine = new GameEngine({ map, player, manifest: cotwManifest });
    const spark = { ...firebolt, id: 'spark', element: 'lightning', reflects: false, range: 20, effects: [{ type: 'damage', amount: 5, element: 'lightning' }] };

    const geo = castGeometry(engine, spark as never, player, { x: 6, y: 1 });

    expect(geo.reflects).toBe(true);
    expect(geo.ray?.reflectionsCount).toBeGreaterThan(0);
  }, 30_000);
});
