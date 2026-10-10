import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Companion } from '../../entities/companion';
import { addCurrencyToPlayer } from '../currency';
import { TrainerService } from '../services';
import { TEST_COMPANION_ID as TEST_DEF_ID, useTestCompanion } from '../../__fixtures__/testHelpers';

function buildEngine(): GameEngine {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  return new GameEngine({ map, player });
}

describe('TrainerService (docs/architecture/content-companions.md Phase 2)', () => {
  useTestCompanion();

  describe('reviveCompanion', () => {
    it('refuses when there is no fallen companion on record', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
      expect(result.message).toContain('no fallen companion');
    });

    it('refuses when a live companion is already active', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'live-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      engine.deadCompanionRecord = Companion.fromDefinition(TEST_DEF_ID, 'other-dead', { x: 0, y: 0 })!;
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
    });

    it('heals and reattaches the same dead companion instance, clearing the record', () => {
      const engine = buildEngine();
      const dead = Companion.fromDefinition(TEST_DEF_ID, 'dead-comp', { x: 5, y: 5 })!;
      dead.hp = 0;
      engine.deadCompanionRecord = dead;
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 200 });

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
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 1 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(false);
      expect(engine.deadCompanionRecord).toBe(dead);
      expect(engine.companion).toBeNull();
    });
  });

  describe('teachSkill', () => {
    it('refuses when there is no active companion', () => {
      const engine = buildEngine();
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100 });

      const result = TrainerService.teachSkill(engine, 'rally_howl');

      expect(result.success).toBe(false);
    });

    it('unlocks a new skill on the companion when funded', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100 });

      const result = TrainerService.teachSkill(engine, 'rally_howl', 'Rally Howl');

      expect(result.success).toBe(true);
      expect(companion.unlockedSkills).toContain('rally_howl');
    });

    it('refuses to re-teach a skill the companion already knows', () => {
      const engine = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-2', { x: 11, y: 10 })!;
      companion.unlockSkill('rally_howl');
      engine.attachCompanion(companion);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100 });

      const result = TrainerService.teachSkill(engine, 'rally_howl');

      expect(result.success).toBe(false);
    });
  });
});
