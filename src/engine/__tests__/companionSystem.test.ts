import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Companion, CompanionRegistry } from '../entities/companion';
import { serializeGame, deserializeGame } from '../storage/serializer';
import { DeathResolver } from '../combat/deathResolver';

const TEST_DEF_ID = 'test_companion';

function buildEngine(): { engine: GameEngine; player: Player } {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  const engine = new GameEngine({ map, player });
  // Phase 2's acquisition gate (ARCHITECTURE.md P-14) requires bonding before
  // summonCompanion succeeds. The gate itself is covered by trainerService.test.ts;
  // these tests are about summon/follow/persistence mechanics, so pre-bond here.
  engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true);
  return { engine, player };
}

describe('Companion engine integration (ARCHITECTURE.md P-14, Phase 1 MVP)', () => {
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

  describe('summonCompanion / dismissCompanion', () => {
    it('summons a companion near the player, registered on the map and scheduler', () => {
      const { engine, player } = buildEngine();

      const companion = engine.summonCompanion(TEST_DEF_ID);

      expect(companion).not.toBeNull();
      expect(engine.companion).toBe(companion);
      expect(engine.map.getAllEntities()).toContain(companion);
      expect(engine.scheduler.getEntities()).toContain(companion);
      const dist = Math.max(Math.abs(companion!.x - player.x), Math.abs(companion!.y - player.y));
      expect(dist).toBeLessThanOrEqual(5);
    });

    it('refuses to summon a second companion while one is already active', () => {
      const { engine } = buildEngine();
      engine.summonCompanion(TEST_DEF_ID);
      const second = engine.summonCompanion(TEST_DEF_ID);
      expect(second).toBeNull();
    });

    it('returns null for an unknown definition ID', () => {
      const { engine } = buildEngine();
      expect(engine.summonCompanion('does_not_exist')).toBeNull();
    });

    it('dismisses the companion, removing it from map and scheduler', () => {
      const { engine } = buildEngine();
      const companion = engine.summonCompanion(TEST_DEF_ID)!;

      engine.dismissCompanion();

      expect(engine.companion).toBeNull();
      expect(engine.map.getAllEntities()).not.toContain(companion);
      expect(engine.scheduler.getEntities()).not.toContain(companion);
    });

    it('dismissCompanion is a safe no-op when no companion is active', () => {
      const { engine } = buildEngine();
      const entitiesBefore = engine.map.getAllEntities().length;
      const messagesBefore = engine.messages.length;

      expect(() => engine.dismissCompanion()).not.toThrow();

      expect(engine.companion).toBeNull();
      expect(engine.map.getAllEntities().length).toBe(entitiesBefore);
      expect(engine.messages.length).toBe(messagesBefore);
    });
  });

  describe('companion_follow AI', () => {
    it('moves toward the player when farther than the follow distance', () => {
      const { engine, player } = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'far-companion', { x: 2, y: 10 })!;
      engine.attachCompanion(companion);
      const startDist = Math.abs(companion.x - player.x);

      companion.takeTurn(engine);

      const endDist = Math.abs(companion.x - player.x);
      expect(endDist).toBeLessThan(startDist);
    });

    it('attacks an adjacent hostile instead of moving', () => {
      const { engine, player } = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'guard-companion', {
        x: player.x + 1,
        y: player.y,
      })!;
      engine.attachCompanion(companion);

      const hostile = new Monster({
        id: 'target-wolf',
        name: 'Wolf',
        position: { x: companion.x + 1, y: companion.y },
        stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
        speed: 100,
        definitionId: 'wolf',
        aiType: 'melee',
        fleeHealthPercent: 0,
        xpValue: 1,
        lootTable: [],
      });
      engine.map.addEntity(hostile);
      const hpBefore = hostile.hp;

      companion.takeTurn(engine);

      // Either the attack landed (hp dropped) or missed, but the companion must not
      // have moved away from its guard position while a hostile is adjacent.
      expect(companion.x).toBe(player.x + 1);
      expect(companion.y).toBe(player.y);
      expect(hostile.hp).toBeLessThanOrEqual(hpBefore);
    });

    it('waits when within follow distance and no hostile is adjacent', () => {
      const { engine, player } = buildEngine();
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'idle-companion', {
        x: player.x + 1,
        y: player.y,
      })!;
      engine.attachCompanion(companion);

      const result = companion.takeTurn(engine);

      expect(companion.x).toBe(player.x + 1);
      expect(companion.y).toBe(player.y);
      expect(result.success).toBe(true);
    });
  });

  describe('floor transitions', () => {
    it('carries the companion to the target floor alongside the player', () => {
      const { engine } = buildEngine();
      const companion = engine.summonCompanion(TEST_DEF_ID)!;

      const secondMap = new GameMap(15, 15, TILES.FLOOR);
      engine.storedFloors.set(2, secondMap);
      engine.changeFloor(2);

      expect(engine.map).toBe(secondMap);
      expect(engine.companion).toBe(companion);
      expect(engine.map.getAllEntities()).toContain(companion);
      expect(engine.scheduler.getEntities()).toContain(companion);
      // Companion must not have been left behind on the old floor.
      const oldFloor = engine.storedFloors.get(1)!;
      expect(oldFloor.getAllEntities()).not.toContain(companion);
    });

    it('does nothing to a null companion across a floor change', () => {
      const { engine } = buildEngine();
      const secondMap = new GameMap(15, 15, TILES.FLOOR);
      engine.storedFloors.set(2, secondMap);
      expect(() => engine.changeFloor(2)).not.toThrow();
      expect(engine.companion).toBeNull();
    });
  });

  describe('persistence round-trip', () => {
    it('serializes and restores the active companion, including its pack inventory', () => {
      const { engine } = buildEngine();
      const companion = engine.summonCompanion(TEST_DEF_ID)!;
      companion.hp = 12; // simulate battle damage
      const saveData = serializeGame(engine);

      expect(saveData.companion).toBeDefined();
      expect(saveData.companion!.companionDefinitionId).toBe(TEST_DEF_ID);
      expect(saveData.companion!.hp).toBe(12);

      // Companions are top-level, not part of the floor's monster list.
      expect(saveData.map.monsters.find((m) => m.id === companion.id)).toBeUndefined();

      const restored = deserializeGame(saveData);
      expect(restored.engine.companion).not.toBeNull();
      expect(restored.engine.companion!.hp).toBe(12);
      expect(restored.engine.companion!.companionDefinitionId).toBe(TEST_DEF_ID);
      expect(restored.engine.map.getAllEntities()).toContain(restored.engine.companion);
    });

    it('omits the companion field when none is active', () => {
      const { engine } = buildEngine();
      const saveData = serializeGame(engine);
      expect(saveData.companion).toBeUndefined();
    });
  });

  describe('death and revival (ARCHITECTURE.md P-14 Phase 2)', () => {
    it('routes a dying companion to deadCompanionRecord instead of the generic Monster death pipeline', () => {
      const { engine } = buildEngine();
      const companion = engine.summonCompanion(TEST_DEF_ID)!;
      const xpBefore = engine.player.xp;

      DeathResolver.resolveDeath(engine, undefined, companion);

      expect(engine.companion).toBeNull();
      expect(engine.deadCompanionRecord).toBe(companion);
      expect(engine.map.getAllEntities()).not.toContain(companion);
      // No generic Monster death rewards (XP, corpse) apply to a fallen companion.
      expect(engine.player.xp).toBe(xpBefore);
    });

    it('does not block floor-clear: a living companion is excluded from the remaining-hostiles count', () => {
      const { engine } = buildEngine();
      engine.summonCompanion(TEST_DEF_ID);
      engine.map.isCleared = false;

      const hostile = new Monster({
        id: 'last-wolf',
        name: 'Wolf',
        position: { x: 3, y: 3 },
        stats: { hp: 1, maxHp: 10, attack: 2, defense: 0 },
        speed: 100,
        definitionId: 'wolf',
        aiType: 'melee',
        fleeHealthPercent: 0,
        xpValue: 1,
        lootTable: [],
      });
      engine.map.addEntity(hostile);

      DeathResolver.resolveDeath(engine, engine.player, hostile);

      // The companion is still alive and on the map, but must not have prevented
      // the floor from being marked clear (the bug this fix addresses).
      expect(engine.companion).not.toBeNull();
      expect(engine.companion!.isAlive()).toBe(true);
      expect(engine.map.isCleared).toBe(true);
    });

    it('revives the same dead companion instance via TrainerService, healed and reattached', async () => {
      const { engine } = buildEngine();
      const companion = engine.summonCompanion(TEST_DEF_ID)!;
      DeathResolver.resolveDeath(engine, undefined, companion);
      expect(engine.deadCompanionRecord).toBe(companion);

      const { addCurrencyToPlayer } = await import('../economy/currency');
      const { TrainerService } = await import('../economy/services');
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 100, platinum: 0 });

      const result = TrainerService.reviveCompanion(engine);

      expect(result.success).toBe(true);
      expect(engine.deadCompanionRecord).toBeNull();
      expect(engine.companion).toBe(companion);
      expect(companion.hp).toBe(companion.maxHp);
      expect(engine.map.getAllEntities()).toContain(companion);
    });
  });
});
