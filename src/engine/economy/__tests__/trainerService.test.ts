import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Companion, CompanionRegistry } from '../../entities/companion';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { TrainerService } from '../services';

const TEST_DEF_ID = 'test_companion';

function buildEngine(): GameEngine {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  return new GameEngine({ map, player });
}

describe('TrainerService (docs/architecture/content-companions.md Phase 2)', () => {
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

  describe('bondCompanion', () => {
    it('sets the bonded flag and deducts the bonding cost when funded', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.bondCompanion(engine);

      expect(result.success).toBe(true);
      expect(engine.getWorldFlag(GameEngine.COMPANION_BONDED_FLAG)).toBe(true);
      expect(getPlayerTotalCp(engine.player)).toBe(0);
    });

    it('refuses when the player cannot afford the cost', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 10, platinum: 0 });

      const result = TrainerService.bondCompanion(engine);

      expect(result.success).toBe(false);
      expect(engine.getWorldFlag(GameEngine.COMPANION_BONDED_FLAG)).toBeFalsy();
    });

    it('refuses to bond twice', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 300, platinum: 0 });
      TrainerService.bondCompanion(engine);
      const fundsAfterFirstBond = getPlayerTotalCp(engine.player);

      const second = TrainerService.bondCompanion(engine);

      expect(second.success).toBe(false);
      expect(getPlayerTotalCp(engine.player)).toBe(fundsAfterFirstBond);
    });

    it('unlocks summonCompanion once bonded', () => {
      const engine = buildEngine();
      expect(engine.summonCompanion(TEST_DEF_ID)).toBeNull();

      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });
      TrainerService.bondCompanion(engine);

      expect(engine.summonCompanion(TEST_DEF_ID)).not.toBeNull();
    });
  });

  describe('reviveCompanion', () => {
    it('refuses when there is no fallen companion on record', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200, platinum: 0 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no fallen companion');
    });

    it('refuses when a live companion is already active', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'live-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      engine.deadCompanionRecord = Companion.fromDefinition(TEST_DEF_ID, 'other-dead', { x: 0, y: 0 })!;
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200, platinum: 0 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
    });

    it('heals and reattaches the same dead companion instance, clearing the record', () => {
      const engine = buildEngine();
      const dead = Companion.fromDefinition(TEST_DEF_ID, 'dead-comp', { x: 5, y: 5 })!;
      dead.hp = 0;
      engine.deadCompanionRecord = dead;
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200, platinum: 0 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(true);
      expect(engine.deadCompanionRecord).toBeNull();
      expect(engine.companion).toBe(dead);
      expect(dead.hp).toBe(dead.maxHp);
      expect(engine.map.getAllEntities()).toContain(dead);
    });

    it('refuses when the player cannot afford the revival cost', () => {
      const engine = buildEngine();
      const dead = Companion.fromDefinition(TEST_DEF_ID, 'dead-comp-2', { x: 5, y: 5 })!;
      engine.deadCompanionRecord = dead;
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 1, platinum: 0 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
      expect(engine.deadCompanionRecord).toBe(dead);
      expect(engine.companion).toBeNull();
    });
  });

  describe('switchArchetype', () => {
    it('refuses when there is no active companion', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.switchArchetype(engine, 'bodyguard');

      expect(result.success).toBe(false);
    });

    it('changes the companion archetype and AI routine when funded', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'arch-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.switchArchetype(engine, 'bodyguard');

      expect(result.success).toBe(true);
      expect(companion.archetype).toBe('bodyguard');
      expect(companion.aiRoutineId).toBe('companion_bodyguard');
    });

    it('refuses to retrain into the same archetype the companion already has', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'arch-comp-2', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.switchArchetype(engine, 'balanced');

      expect(result.success).toBe(false);
    });
  });

  describe('teachSkill', () => {
    it('refuses when there is no active companion', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.teachSkill(engine, 'rally_howl');

      expect(result.success).toBe(false);
    });

    it('unlocks a new skill on the companion when funded', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.teachSkill(engine, 'rally_howl', 'Rally Howl');

      expect(result.success).toBe(true);
      expect(companion.unlockedSkills).toContain('rally_howl');
    });

    it('refuses to re-teach a skill the companion already knows', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-2', { x: 11, y: 10 })!;
      companion.unlockSkill('rally_howl');
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.teachSkill(engine, 'rally_howl');

      expect(result.success).toBe(false);
    });
  });
});
