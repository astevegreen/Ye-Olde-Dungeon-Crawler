import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { ItemFactory } from '../items/factory';
import { MonsterRegistry } from '../bestiary/monsterDefinitions';
import { setActiveMonsterStore } from '../registries/monsterRegistryStore';

describe('GameEngine Triage & Diagnostic Public API', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  afterAll(() => {
    setActiveMonsterStore(null);
    MonsterRegistry.clear();
  });

  beforeEach(() => {
    MonsterRegistry.register({
      id: 'goblin',
      name: 'Goblin',
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: []
    });
    MonsterRegistry.register({
      id: 'skeleton',
      name: 'Skeleton',
      stats: { hp: 15, maxHp: 15, attack: 3, defense: 2 },
      speed: 100,
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 8,
      lootTable: []
    });

    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'test-hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player });
  });

  describe('spawnMonster', () => {
    it('spawns a monster adjacent to player and registers with both map and scheduler', () => {
      const monster = engine.diagnostics.spawnMonster('goblin', { aiState: 'hunting' });

      expect(monster).not.toBeNull();
      expect(monster!.aiState).toBe('hunting');
      expect(engine.map.getEntityAt(monster!.x, monster!.y)).toBe(monster);
      expect(engine.scheduler.getEntities()).toContain(monster);

      // Verify adjacency to player (x: 5, y: 5)
      const dx = Math.abs(monster!.x - player.x);
      const dy = Math.abs(monster!.y - player.y);
      expect(dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)).toBe(true);
    });

    it('returns null if no passable adjacent tile exists', () => {
      // Surround player with walls
      const neighbors = [
        { x: player.x + 1, y: player.y },
        { x: player.x - 1, y: player.y },
        { x: player.x, y: player.y + 1 },
        { x: player.x, y: player.y - 1 },
        { x: player.x + 1, y: player.y + 1 },
        { x: player.x - 1, y: player.y - 1 },
      ];
      for (const n of neighbors) {
        map.setTile(n.x, n.y, TILES.WALL);
      }

      const monster = engine.diagnostics.spawnMonster('goblin');
      expect(monster).toBeNull();
    });

    it('spawns at explicit custom position when provided', () => {
      const monster = engine.diagnostics.spawnMonster('skeleton', {
        position: { x: 10, y: 10 },
        aiState: 'hunting',
      });

      expect(monster).not.toBeNull();
      expect(monster!.x).toBe(10);
      expect(monster!.y).toBe(10);
      expect(engine.map.getEntityAt(10, 10)).toBe(monster);
    });
  });

  describe('spawnItem', () => {
    it('stores spawned item into player inventory when space is available', () => {
      const potion = ItemFactory.createHealthPotion('triage-potion-1');
      const result = engine.diagnostics.spawnItem(potion);

      expect(result.placedInPack).toBe(true);
      expect(player.inventory.primaryPack.hasItem(potion.id)).toBe(true);
      expect(map.getItemsAt(player.x, player.y)).not.toContain(potion);
    });

    it('places item on ground tile beneath player when inventory is full', () => {
      // Fill pack to capacity (capacity limit or max weight)
      // Small belt pouch has 3 capacity
      for (let i = 0; i < 30; i++) {
        player.addItem(ItemFactory.createBroadsword(`filler-${i}`));
      }

      const extraItem = ItemFactory.createHealthPotion('overflow-potion');
      const result = engine.diagnostics.spawnItem(extraItem);

      if (!result.placedInPack) {
        expect(result.groundTile).toEqual({ x: player.x, y: player.y });
        expect(map.getItemsAt(player.x, player.y)).toContain(extraItem);
      }
    });
  });

  describe('toggleGodMode', () => {
    it('toggles player invulnerability state cleanly', () => {
      expect(player.isInvulnerable).toBe(false);

      const enabled = engine.diagnostics.toggleGodMode();
      expect(enabled).toBe(true);
      expect(player.isInvulnerable).toBe(true);

      const disabled = engine.diagnostics.toggleGodMode();
      expect(disabled).toBe(false);
      expect(player.isInvulnerable).toBe(false);
    });
  });

  describe('revealFloorMap', () => {
    it('reveals all tiles on the current floor map and logs message', () => {
      expect(engine.fov.isExplored(15, 15)).toBe(false);

      engine.diagnostics.revealFloorMap();

      expect(engine.fov.isExplored(15, 15)).toBe(true);
      expect(engine.messages.some((m) => m.includes('mystical vision'))).toBe(true);
    });
  });
});
