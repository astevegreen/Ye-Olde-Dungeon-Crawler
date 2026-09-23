import { describe, it, expect, beforeEach } from 'vitest';
import { StatusHandlerRegistry, StatusEffectRegistry, type StatusHandler } from '../statusHandlers';
import { Player } from '../../entities/player';
import { createTestGoblin, createTestKobold } from '../../__fixtures__/testHelpers';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { warcraftManifest } from '../../../content/warcraft';
import { SpellPipeline } from '../../magic/spellPipeline';
import type { SpellDefinition } from '../../magic/types';

describe('Status Effect Registry & Manifest Integration (Phase 2)', () => {
  beforeEach(() => {
    StatusHandlerRegistry.resetToDefaults();
  });

  function setupEngine(manifest = warcraftManifest) {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
    });
    const engine = new GameEngine({ map, player, manifest });
    return { engine, player, map };
  }

  it('exposes StatusEffectRegistry as an alias for StatusHandlerRegistry', () => {
    expect(StatusEffectRegistry).toBe(StatusHandlerRegistry);
    expect(StatusEffectRegistry.has('poison')).toBe(true);
    expect(StatusEffectRegistry.has('paralysis')).toBe(true);
    expect(StatusEffectRegistry.has('slow')).toBe(true);
    expect(StatusEffectRegistry.has('haste')).toBe(true);
    expect(StatusEffectRegistry.has('blindness')).toBe(true);
  });

  it('allows registering and dispatching custom status handlers dynamically', () => {
    let tickCount = 0;
    let applied = false;
    let expired = false;

    const bleedHandler: StatusHandler = {
      onApply(entity) {
        applied = true;
        return `${entity.name} begins bleeding profusely!`;
      },
      onTick(entity, effect) {
        tickCount++;
        const dmg = effect.potency ?? 5;
        const res = entity.takeDamage(dmg);
        return {
          damageTaken: res.damageDealt,
          killed: res.killed,
          message: `${entity.name} bleeds for ${res.damageDealt} damage!`,
        };
      },
      onExpire(entity) {
        expired = true;
        return `${entity.name}'s wounds have clotted.`;
      },
    };

    StatusHandlerRegistry.register('bleed', bleedHandler);
    expect(StatusHandlerRegistry.has('bleed')).toBe(true);

    const { engine, player } = setupEngine();

    // 1. Apply status
    const appliedSuccess = player.statusManager.applyStatus(
      { type: 'bleed', duration: 2, potency: 6 },
      player.statusImmunities,
      player,
      engine
    );
    expect(appliedSuccess).toBe(true);
    expect(applied).toBe(true);
    expect(engine.messages[engine.messages.length - 1]).toContain('begins bleeding profusely');

    // 2. Tick 1
    const res1 = player.statusManager.tick(player, engine);
    expect(res1.damageTaken).toBe(6);
    expect(player.hp).toBe(44);
    expect(tickCount).toBe(1);
    expect(engine.messages[engine.messages.length - 1]).toContain('bleeds for 6 damage');

    // 3. Tick 2 (expires)
    const res2 = player.statusManager.tick(player, engine);
    expect(res2.damageTaken).toBe(6);
    expect(player.hp).toBe(38);
    expect(tickCount).toBe(2);
    expect(expired).toBe(true);
    expect(res2.expired).toContain('bleed');
    expect(player.statusManager.hasStatus('bleed')).toBe(false);
  });

  it('auto-registers manifest statusHandlers upon GameEngine initialization', () => {
    expect(StatusHandlerRegistry.has('burning')).toBe(false);

    // Initializing engine with warcraftManifest registers 'burning'
    const { engine } = setupEngine(warcraftManifest);
    expect(StatusHandlerRegistry.has('burning')).toBe(true);

    const target = createTestGoblin('gob-target', { x: 5, y: 4 });
    engine.addEntity(target);

    // Apply custom burning status
    target.statusManager.applyStatus(
      { type: 'burning', duration: 2, potency: 4 },
      target.statusImmunities,
      target,
      engine
    );
    expect(engine.messages[engine.messages.length - 1]).toContain('bursts into demonic fel flames');

    // Tick burning
    const tickRes = target.statusManager.tick(target, engine);
    expect(tickRes.damageTaken).toBe(4);
    expect(engine.messages[engine.messages.length - 1]).toContain('scorched by fel fire');
  });

  it('seamlessly integrates with SpellPipeline to apply custom manifest statuses', () => {
    const { engine, player } = setupEngine(warcraftManifest);

    const target = createTestKobold('target-orc', { x: 5, y: 6 });
    engine.addEntity(target);

    const customSpell: SpellDefinition = {
      id: 'ignite',
      name: 'Ignite',
      school: 'Combat',
      manaCost: 5,
      element: 'fire',
      range: 4,
      basePower: 10,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'ray',
      targetingMode: 'ray',
      description: 'Ignites the target in persistent fel flames.',
      effects: [
        { type: 'damage', amount: 5, element: 'fire' },
        { type: 'applyStatus', statusId: 'burning', duration: 3, potency: 3 },
      ],
    };

    const execResult = SpellPipeline.executeSpell(engine, customSpell, player, { x: 5, y: 6 });
    expect(execResult.success).toBe(true);
    expect(target.statusManager.hasStatus('burning')).toBe(true);

    // Ticking the target processes the custom burning handler
    const tickOutput = target.statusManager.tick(target, engine);
    expect(tickOutput.damageTaken).toBe(3);
    expect(engine.messages[engine.messages.length - 1]).toContain('scorched by fel fire');
  });
});
