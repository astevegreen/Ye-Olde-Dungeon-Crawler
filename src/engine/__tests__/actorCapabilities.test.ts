import { describe, it, expect, beforeEach } from 'vitest';
import { Actor, DEFAULT_ACTOR_CAPABILITIES } from '../entities/actor';
import { Player } from '../entities/player';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { MeleeAttackAction } from '../actions/combat';

describe('Unified Actor & Capabilities Model', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(15, 15);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 2 },
    });
    engine = new GameEngine({ map, player, floor: 1 });
  });

  describe('Actor Capabilities Configuration', () => {
    it('initializes default actor capabilities properly', () => {
      const actor = new Actor({
        id: 'generic-actor',
        name: 'Generic Actor',
        type: 'monster',
        faction: 'hostile',
        position: { x: 1, y: 1 },
        stats: { hp: 20, maxHp: 20, attack: 4, defense: 2 },
      });

      expect(actor.capabilities).toEqual(DEFAULT_ACTOR_CAPABILITIES);
      expect(actor.canMove()).toBe(true);
      expect(actor.capabilities.canAct).toBe(true);
      actor.gainEnergy(100);
      expect(actor.canAct()).toBe(true);
    });

    it('honors partial capability overrides in constructor', () => {
      const immobileTotem = new Actor({
        id: 'totem-1',
        name: 'Totem',
        type: 'monster',
        faction: 'hostile',
        position: { x: 2, y: 2 },
        stats: { hp: 30, maxHp: 30, attack: 0, defense: 5 },
        capabilities: {
          canMove: false,
          canAct: false,
        },
      });

      expect(immobileTotem.canMove()).toBe(false);
      immobileTotem.gainEnergy(100);
      expect(immobileTotem.canAct()).toBe(false);
      expect(immobileTotem.capabilities.canBlockPath).toBe(true);
      expect(immobileTotem.capabilities.isDestructible).toBe(true);
    });
  });

  describe('Destructible Object Factory', () => {
    it('creates destructible objects with correct defaults', () => {
      let destroyed = false;
      const barrel = Actor.createDestructibleObject({
        id: 'barrel-1',
        name: 'Explosive Barrel',
        position: { x: 5, y: 6 },
        hp: 10,
        defense: 1,
        onDestroyed: () => {
          destroyed = true;
        },
      });

      expect(barrel.canMove()).toBe(false);
      expect(barrel.canAct()).toBe(false);
      expect(barrel.capabilities.canBlockPath).toBe(true);
      expect(barrel.capabilities.isDestructible).toBe(true);
      expect(barrel.hp).toBe(10);
      expect(barrel.defense).toBe(1);

      barrel.onDestroyed?.(engine, player);
      expect(destroyed).toBe(true);
    });

    it('blocks line of sight if blocksLos is configured', () => {
      const stoneWallPillar = Actor.createDestructibleObject({
        id: 'pillar-1',
        name: 'Stone Pillar',
        position: { x: 5, y: 4 },
        hp: 100,
        blocksLos: true,
      });

      engine.addEntity(stoneWallPillar);
      expect(engine.map.isTransparent(5, 4)).toBe(false);

      // Without blocksLos
      const woodCrate = Actor.createDestructibleObject({
        id: 'crate-1',
        name: 'Wooden Crate',
        position: { x: 5, y: 3 },
        hp: 10,
        blocksLos: false,
      });
      engine.addEntity(woodCrate);
      expect(engine.map.isTransparent(5, 3)).toBe(true);
    });
  });

  describe('Combat & Destruction Hook Execution', () => {
    it('allows player to attack and destroy destructible objects', () => {
      let destroyedCalled = false;
      let recordedKiller: any = null;

      const barrel = Actor.createDestructibleObject({
        id: 'barrel-2',
        name: 'Powder Keg',
        position: { x: 5, y: 6 },
        hp: 10,
        defense: 0,
        onDestroyed: (eng, killer) => {
          destroyedCalled = true;
          recordedKiller = killer;
          eng.log('BOOM! The keg explodes into splinters!');
        },
      });

      engine.addEntity(barrel);

      // Player attacks barrel adjacent at (5, 6)
      const attack = new MeleeAttackAction(player, barrel);
      const res = attack.perform(engine);

      expect(res.success).toBe(true);
      // Player attack is 15 vs 0 defense -> lethal
      expect(barrel.hp).toBeLessThanOrEqual(0);
      expect(destroyedCalled).toBe(true);
      expect(recordedKiller).toBe(player);
      expect(engine.messages.some((m) => m.includes('BOOM!'))).toBe(true);
      expect(engine.map.getAllEntities().some((m) => m.id === 'barrel-2')).toBe(false);
    });
  });

  describe('Scheduler Zero-Tick Invariance for Immobile Objects', () => {
    it('skips energy distribution for entities with canAct === false', () => {
      const totem = Actor.createDestructibleObject({
        id: 'ward-totem',
        name: 'Ward Totem',
        position: { x: 1, y: 1 },
        hp: 30,
      });

      engine.addEntity(totem);
      expect(totem.energy).toBe(0);

      // Advance engine turns
      player.energy = 0;
      engine.scheduler.advanceToNextActor();

      // Totem should not have gained any energy
      expect(totem.energy).toBe(0);
      expect(totem.canAct()).toBe(false);
    });
  });
});
