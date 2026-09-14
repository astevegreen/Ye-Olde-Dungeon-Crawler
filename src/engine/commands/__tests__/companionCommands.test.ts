import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Companion, CompanionRegistry } from '../../entities/companion';
import { EngineCommandBus } from '../commandBus';
import { addCurrencyToPlayer } from '../../economy/currency';
import { ItemFactory } from '../../items/factory';

const TEST_DEF_ID = 'test_companion';

function buildEngine(): GameEngine {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  return new GameEngine({ map, player });
}

describe('Companion commands via EngineCommandBus (ARCHITECTURE.md P-14 Phase 2)', () => {
  beforeEach(() => {
    CompanionRegistry.clear();
    CompanionRegistry.register({
      id: TEST_DEF_ID,
      name: 'Test Companion',
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
      speed: 100,
      packWeightCapacity: 10000,
      packBulkCapacity: 8000,
    });
  });

  describe('trainer_bond_companion / trainer_revive_companion / trainer_switch_archetype / trainer_teach_skill', () => {
    it('bonds, then allows summon, revival, archetype switch, and skill teaching end-to-end', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 500, platinum: 0 });

      const bondResult = bus.dispatch({ type: 'trainer_bond_companion' });
      expect(bondResult.success).toBe(true);

      const companion = engine.summonCompanion(TEST_DEF_ID)!;
      expect(companion).not.toBeNull();

      const archResult = bus.dispatch({ type: 'trainer_switch_archetype', payload: { archetype: 'skirmisher' } });
      expect(archResult.success).toBe(true);
      expect(companion.archetype).toBe('skirmisher');

      const teachResult = bus.dispatch({
        type: 'trainer_teach_skill',
        payload: { skillId: 'rally_howl', skillName: 'Rally Howl' },
      });
      expect(teachResult.success).toBe(true);
      expect(companion.unlockedSkills).toContain('rally_howl');

      companion.hp = 0;
      engine.companion = null;
      engine.deadCompanionRecord = companion;

      const reviveResult = bus.dispatch({ type: 'trainer_revive_companion' });
      expect(reviveResult.success).toBe(true);
      expect(engine.companion).toBe(companion);
      expect(companion.hp).toBe(companion.maxHp);
    });
  });

  describe('use_companion_skill', () => {
    it('refuses when the companion has not learned the skill', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);

      const result = bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } });

      expect(result.success).toBe(false);
    });

    it('heals the companion and hastes the player for rally_howl once learned', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-2', { x: 11, y: 10 })!;
      companion.unlockSkill('rally_howl');
      companion.hp = 1;
      engine.attachCompanion(companion);

      const result = bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } });

      expect(result.success).toBe(true);
      expect(companion.hp).toBeGreaterThan(1);
      expect(engine.player.statusManager.hasStatus('haste')).toBe(true);
    });
  });

  describe('transfer_to_companion / transfer_from_companion', () => {
    it('moves an item from the player backpack into the companion pack and back', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'pack-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);

      const dagger = ItemFactory.createDagger('give-dagger-1');
      engine.player.inventory.primaryPack.addItem(dagger);

      const toResult = bus.dispatch({ type: 'transfer_to_companion', payload: { itemId: dagger.id } });
      expect(toResult.success).toBe(true);
      expect(companion.inventory.primaryPack.getItem(dagger.id)).toBeDefined();
      expect(engine.player.inventory.primaryPack.getItem(dagger.id)).toBeNull();

      const fromResult = bus.dispatch({
        type: 'transfer_from_companion',
        payload: { item: dagger },
      });
      expect(fromResult.success).toBe(true);
      expect(engine.player.inventory.primaryPack.getItem(dagger.id)).toBeDefined();
      expect(companion.inventory.primaryPack.getItem(dagger.id)).toBeNull();
    });

    it('refuses to transfer when there is no active companion', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const dagger = ItemFactory.createDagger('give-dagger-2');
      engine.player.inventory.primaryPack.addItem(dagger);

      const result = bus.dispatch({ type: 'transfer_to_companion', payload: { itemId: dagger.id } });

      expect(result.success).toBe(false);
    });
  });
});
