import { describe, it, expect, beforeEach } from 'vitest';
import { SpellPipeline } from '../spellPipeline';
import { EffectPrimitiveRegistry } from '../effectRegistry';
import { registerReciprocalPrimitives, executeReciprocalAction } from '../../combat/reciprocalPipeline';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import type { SpellDefinition } from '../types';

// A syntactically valid effect primitive whose `type` matches no registered handler:
// simulates a typo'd effect type in a spell/ability content definition.
const UNKNOWN_EFFECT = { type: 'no_such_effect_primitive' } as any;

function makeSpell(overrides: Partial<SpellDefinition> = {}): SpellDefinition {
  return {
    id: 'test-spell',
    name: 'Test Spell',
    school: 'Evocation' as any,
    manaCost: 0,
    element: 'arcane' as any,
    range: 5,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'entity' as any,
    description: 'Test spell.',
    ...overrides,
  };
}

describe('EffectPrimitiveRegistry.dispatch fails loudly on an unknown effect type (ARCHITECTURE.md registry-contract audit)', () => {
  let map: GameMap;
  let player: Player;
  let monster: Entity;
  let engine: GameEngine;

  beforeEach(() => {
    map = new GameMap(12, 12, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    monster = new Entity({
      id: 'foe',
      name: 'Foe',
      type: 'monster',
      faction: 'hostile',
      position: { x: 6, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 4, defense: 1 },
    });
    map.addEntity(player);
    map.addEntity(monster);
    engine = new GameEngine({ map, player });
    SpellPipeline.ensureBuiltinEffects();
  });

  it('EffectPrimitiveRegistry.dispatch itself throws instead of returning false', () => {
    const ctx = {
      engine,
      spell: makeSpell(),
      caster: player,
      targets: [monster],
      effects: [],
      color: '#ffffff',
    };
    expect(() => EffectPrimitiveRegistry.dispatch(UNKNOWN_EFFECT, ctx)).toThrow('no_such_effect_primitive');
  });

  it('SpellPipeline.applyEffectToTarget (self-cast path) surfaces the unknown effect instead of silently no-oping', () => {
    expect(() =>
      SpellPipeline.applyEffectToTarget(engine, makeSpell(), player, monster, UNKNOWN_EFFECT)
    ).toThrow('no_such_effect_primitive');
  });

  it('SpellPipeline.executeSpell (self-target mode) throws instead of reporting a successful cast', () => {
    const spell = makeSpell({ targetType: 'self' as any, effects: [UNKNOWN_EFFECT] });
    expect(() =>
      SpellPipeline.executeSpell(engine, spell, player, { x: player.x, y: player.y })
    ).toThrow('no_such_effect_primitive');
  });

  it('SpellPipeline.executeSpell (targeted tile mode) throws instead of reporting a successful cast', () => {
    const spell = makeSpell({
      targetType: 'tile' as any,
      targetingMode: 'tile' as any,
      effects: [UNKNOWN_EFFECT],
    });
    expect(() =>
      SpellPipeline.executeSpell(engine, spell, player, { x: monster.x, y: monster.y })
    ).toThrow('no_such_effect_primitive');
  });

  it('reciprocalPipeline.executeReciprocalAction throws instead of silently skipping the effect', () => {
    registerReciprocalPrimitives();
    expect(() => executeReciprocalAction(player, monster, [UNKNOWN_EFFECT], engine)).toThrow(
      'no_such_effect_primitive'
    );
  });

  it('a real registered effect type (damage) still dispatches normally', () => {
    const spell = makeSpell({
      targetType: 'self' as any,
      effects: [{ type: 'damage', amount: 5, element: 'arcane' } as any],
    });
    expect(() => SpellPipeline.executeSpell(engine, spell, player, { x: player.x, y: player.y })).not.toThrow();
  });
});
