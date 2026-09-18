import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Item } from '../items/item';
import { IdentificationManager } from '../items/identification';
import { IdentifyAction, RemoveCurseAction } from '../actions/identificationActions';
import { SearchAction } from '../actions/search';
import { DisarmTrapAction } from '../actions/disarm';
import { OpenDoorAction } from '../actions/door';
import { WaitAction } from '../actions/wait';
import { AutoRestManager } from '../actions/autoRest';
import { DetectMonstersAction, DetectObjectsAction, ClairvoyanceAction } from '../magic/esp';
import { findAStarPath } from '../pathfinding/astar';
import { TrapInstance } from '../dungeon/traps';
import { Visibility } from '../fov/types';
import { cotwManifest } from '../../content/cotw';

describe('Dungeon Exploration & Tactical Crawler Subsystems', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    map = new GameMap(30, 30);
    // Fill with floor
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 10, y: 10 },
      stats: { hp: 50, maxHp: 100, attack: 10, defense: 5 },
      mana: 20,
      maxMana: 50,
      strength: 14,
      dexterity: 14,
      constitution: 14,
      intelligence: 14,
    });
    engine = new GameEngine({ manifest: cotwManifest, map, player });
  });

  describe('1. Item Identification & Curse Binding', () => {
    it('generates consistent per-run aliases and conceals true properties when unidentified', () => {
      const idMgr = new IdentificationManager(cotwManifest, 42);
      const wandDef = {
        id: 'wand_fire',
        name: 'Wand of Fireballs',
        category: 'wand' as const,
        weight: 200,
        bulk: 100,
      };

      const alias = idMgr.getAlias('wand_fire', wandDef);
      expect(alias).toBeDefined();
      expect(alias!.length).toBeGreaterThan(0);
      expect(idMgr.isIdentified('wand_fire')).toBe(false);

      // Create unidentified wand
      const wand = new Item({
        id: 'wand-instance-1',
        definitionId: 'wand_fire',
        name: 'Wand of Fireballs',
        unidentifiedName: alias,
        category: 'wand',
        weight: 200,
        bulk: 100,
        identified: false,
        stats: { attackBonus: 5 },
        quality: 'cursed',
      });

      // Display name is obfuscated alias
      expect(wand.displayName).toBe(alias);
      expect(wand.identified).toBe(false);

      // Add to inventory and identify via IdentifyAction
      player.inventory.primaryPack.addItem(wand);
      const identifyAction = new IdentifyAction(player, wand.id);
      const res = identifyAction.perform(engine);

      expect(res.success).toBe(true);
      expect(wand.identified).toBe(true);
      expect(wand.displayName).toContain('Wand of Fireballs');
      expect(engine.identification.isIdentified('wand_fire')).toBe(true);
    });

    it('binds cursed items to equipment slot and prevents removal until cleansed', () => {
      const cursedSword = new Item({
        id: 'cursed-blade-1',
        name: 'Black Blade of Strife',
        category: 'weapon',
        slot: 'mainHand',
        weight: 1500,
        bulk: 500,
        quality: 'cursed',
        identified: true,
      });

      // Equip into main hand
      player.inventory.paperdoll.equip(cursedSword, 'mainHand');
      expect(player.inventory.paperdoll.getItem('mainHand')?.id).toBe('cursed-blade-1');

      // Attempt to unequip cursed item
      const unequipCheck = player.inventory.paperdoll.canUnequip('mainHand');
      expect(unequipCheck.allowed).toBe(false);
      expect(unequipCheck.reason).toContain('cursed');

      // Attempt unequipToPack action
      const unequipRes = player.inventory.unequipToPack('mainHand');
      expect(unequipRes.success).toBe(false);

      // Perform RemoveCurseAction
      const removeCurseAction = new RemoveCurseAction(player, cursedSword);
      const cleanseRes = removeCurseAction.perform(engine);
      expect(cleanseRes.success).toBe(true);
      expect(cursedSword.isCursed()).toBe(false);

      // Now unequip succeeds
      const postCleanseCheck = player.inventory.paperdoll.canUnequip('mainHand');
      expect(postCleanseCheck.allowed).toBe(true);
      const postUnequipRes = player.inventory.unequipToPack('mainHand');
      expect(postUnequipRes.success).toBe(true);
      expect(player.inventory.paperdoll.getItem('mainHand')).toBeNull();
    });
  });

  describe('2. Hidden Fixtures: Secret Doors, Traps, & Active Searching', () => {
    it('reveals secret doors and traps with active 5x5 SearchAction', () => {
      // Place a secret door at (12, 10) - 2 tiles away, within 5x5 box
      map.setTile(12, 10, {
        ...TILES.WALL,
        hidden: true,
      });

      // Place a hidden trap at (11, 11) - 1 tile diagonal away
      map.addTrap(
        new TrapInstance({
          id: 'trap-1',
          x: 11,
          y: 11,
          type: 'arrow',
          damage: 8,
          concealment: 10,
          disarmDifficulty: 10,
          revealed: false,
          disarmed: false,
        })
      );

      expect(map.getTile(12, 10)?.type).toBe('wall');
      expect(map.getTrapAt(11, 11)?.revealed).toBe(false);

      // Search action with guaranteed success roll (fn returning 0.99)
      const searchAction = new SearchAction(player, () => 0.99, 2);
      const result = searchAction.perform(engine);

      expect(result.success).toBe(true);
      // Secret door converted to door_closed
      expect(map.getTile(12, 10)?.type).toBe('door_closed');
      expect(map.getTile(12, 10)?.hidden).toBe(false);

      // Trap revealed
      expect(map.getTrapAt(11, 11)?.revealed).toBe(true);
    });

    it('allows disarming a revealed trap with DisarmTrapAction', () => {
      map.addTrap(
        new TrapInstance({
          id: 'trap-pit-1',
          x: 10,
          y: 11, // adjacent to player at (10, 10)
          type: 'pit',
          damage: 10,
          concealment: 10,
          disarmDifficulty: 5,
          revealed: true,
          disarmed: false,
        })
      );

      // Disarm adjacent trap
      const disarmAction = new DisarmTrapAction(player);
      const res = disarmAction.perform(engine);

      expect(res.success).toBe(true);
      const trap = map.getTrapAt(10, 11);
      expect(trap?.disarmed).toBe(true);
    });

    it('requires a key or lockpicking roll to open locked doors', () => {
      // Place locked door at (10, 11)
      map.setTile(10, 11, {
        ...TILES.DOOR_CLOSED,
        locked: true,
        lockDifficulty: 12,
      });

      // Without key or high roll:
      const origNextInt = engine.prng.nextInt.bind(engine.prng);
      engine.prng.nextInt = () => 1; // roll = 1 + floor(14/4) = 4 < 12 DC
      const openWithoutKey = new OpenDoorAction(player, 10, 11);
      const failRes = openWithoutKey.perform(engine);
      expect(failRes.success).toBe(false);
      expect(map.getTile(10, 11)?.type).toBe('door_closed');
      engine.prng.nextInt = origNextInt;

      // Add iron key
      const key = new Item({
        id: 'iron_key',
        name: 'Iron Skeleton Key',
        category: 'quest',
        weight: 50,
        bulk: 20,
      });
      player.inventory.primaryPack.addItem(key);

      // Try again with key
      const openWithKey = new OpenDoorAction(player, 10, 11);
      const keyRes = openWithKey.perform(engine);
      expect(keyRes.success).toBe(true);
      expect(map.getTile(10, 11)?.type).toBe('door_open');
    });
  });

  describe('3. Interruptible Auto-Rest ("Rest Until Disturbed")', () => {
    it('recovers HP and Mana over time until full', () => {
      player.hp = 80;
      player.maxHp = 100;
      player.mana = 30;
      player.maxMana = 50;

      const restResult = AutoRestManager.executeFullRest(engine, 50);
      expect(restResult.finished).toBe(true);
      expect(restResult.reason).toContain('Fully rested');
      expect(player.hp).toBe(100);
      expect(player.mana).toBe(50);
      expect(restResult.turn).toBeGreaterThan(0);
    });

    it('interrupts auto-rest when a hostile monster enters FOV', () => {
      player.hp = 50;
      player.maxHp = 100;

      // Spawn hostile monster outside FOV initially, then step into FOV
      const orc = new Monster({
        id: 'orc-sentry',
        name: 'Orc Sentry',
        position: { x: 12, y: 10 }, // within FOV
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
        speed: 100,
        aiType: 'melee',
        xpValue: 25,
      });
      engine.map.addEntity(orc);
      engine.updateFov();

      const stepResult = AutoRestManager.stepRestTurn(engine, 50, 20, 0, 100);
      expect(stepResult.finished).toBe(true);
      expect(stepResult.interrupted).toBe(true);
      expect(stepResult.reason).toContain('Orc Sentry');
    });

    it('interrupts auto-rest if player takes unexpected damage', () => {
      player.hp = 50;
      player.maxHp = 100;
      player.statusManager.applyStatus('poison', 5, 4);

      const stepResult = AutoRestManager.stepRestTurn(engine, player.hp, 20, 0, 100);
      expect(stepResult.finished).toBe(true);
      expect(stepResult.interrupted).toBe(true);
      expect(stepResult.reason).toContain('damage');
    });
  });

  describe('4. Sensory Detection Magic / ESP Overrides', () => {
    it('activates and decrements Detect Monsters and Detect Objects timers', () => {
      expect(engine.detectMonstersTurns).toBe(0);
      expect(engine.detectObjectsTurns).toBe(0);

      // Cast detect monsters (duration 30)
      const detectMonsters = new DetectMonstersAction(player, 30);
      detectMonsters.perform(engine);
      expect(engine.detectMonstersTurns).toBe(30);

      // Cast detect objects (duration 25)
      const detectObjects = new DetectObjectsAction(player, 25);
      detectObjects.perform(engine);
      expect(engine.detectObjectsTurns).toBe(25);

      // Perform a turn action (wait)
      player.energy = 100;
      engine.handlePlayerAction(new WaitAction(player));
      expect(engine.detectMonstersTurns).toBe(29);
      expect(engine.detectObjectsTurns).toBe(24);
    });

    it('reveals entire floor map topology as Explored via Clairvoyance without exposing unseen entities', () => {
      expect(engine.fov.isExplored(25, 25)).toBe(false);

      const clairvoyance = new ClairvoyanceAction(player);
      const res = clairvoyance.perform(engine);
      expect(res.success).toBe(true);

      // Entire map is now marked Explored
      expect(engine.fov.isExplored(25, 25)).toBe(true);
      expect(engine.fov.isExplored(0, 0)).toBe(true);

      // But distant tile is NOT currently in direct line-of-sight (Visible)
      expect(engine.fov.isVisible(25, 25)).toBe(false);
    });
  });

  describe('5. A* Pathfinding & Click-to-Move Navigation', () => {
    it('finds optimal path between two points avoiding obstacles', () => {
      // Mark tiles between (10, 10) and (14, 10) as explored
      for (let x = 9; x <= 15; x++) {
        for (let y = 9; y <= 15; y++) {
          engine.fov.setVisibility(x, y, Visibility.Explored);
        }
      }

      // Place a wall obstacle at (12, 10)
      map.setTile(12, 10, TILES.WALL);

      const start = { x: 10, y: 10 };
      const goal = { x: 14, y: 10 };

      const path = findAStarPath(map, engine.fov, start, goal);
      expect(path.length).toBeGreaterThan(0);
      // Path must reach goal
      expect(path[path.length - 1]).toEqual(goal);
      // Path must never step on the wall obstacle at (12, 10)
      const hitWall = path.some((p) => p.x === 12 && p.y === 10);
      expect(hitWall).toBe(false);
    });

    it('refuses to pathfind through unexplored darkness', () => {
      // (20, 20) is unexplored
      expect(engine.fov.isExplored(20, 20)).toBe(false);

      const start = { x: 10, y: 10 };
      const goal = { x: 20, y: 20 };

      const path = findAStarPath(map, engine.fov, start, goal);
      // Path must be empty because target is unexplored darkness
      expect(path.length).toBe(0);
    });

    it('avoids known active traps along the route', () => {
      // Mark region as explored
      for (let x = 9; x <= 15; x++) {
        for (let y = 9; y <= 15; y++) {
          engine.fov.setVisibility(x, y, Visibility.Explored);
        }
      }

      // Add a revealed active trap directly on the direct path at (12, 10)
      map.addTrap(
        new TrapInstance({
          id: 'revealed-pit',
          x: 12,
          y: 10,
          type: 'pit',
          damage: 10,
          concealment: 10,
          disarmDifficulty: 10,
          revealed: true,
          disarmed: false,
        })
      );

      const start = { x: 10, y: 10 };
      const goal = { x: 14, y: 10 };

      const path = findAStarPath(map, engine.fov, start, goal);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(goal);
      // Path routes around the trap
      const steppedOnTrap = path.some((p) => p.x === 12 && p.y === 10);
      expect(steppedOnTrap).toBe(false);
    });

    it('prevents diagonal corner-cutting between two adjacent orthogonal obstacles', () => {
      // Set up corner-cutting scenario:
      // S .
      // W W  (Obstacles at (10, 11) and (11, 10))
      // . G
      for (let x = 9; x <= 13; x++) {
        for (let y = 9; y <= 13; y++) {
          engine.fov.setVisibility(x, y, Visibility.Explored);
        }
      }

      map.setTile(10, 11, TILES.WALL);
      map.setTile(11, 10, TILES.WALL);

      const start = { x: 10, y: 10 };
      const goal = { x: 11, y: 11 };

      const path = findAStarPath(map, engine.fov, start, goal);
      // If path exists, it cannot jump directly from (10, 10) to (11, 11) in 1 diagonal step
      if (path.length > 0) {
        expect(path[0]).not.toEqual({ x: 11, y: 11 });
      }
    });
  });
});
