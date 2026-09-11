import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { WaitAction } from '../actions/wait';
import { ProfileManager, MemoryStorage } from '../storage/profile-manager';
import { cotwManifest } from '../../content/cotw';

describe('Dungeon Monster Action Loop & Scheduler Integration', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    map = GameMap.createBoxRoom(20, 20);
    player = new Player({
      id: 'test_hero',
      name: 'Valiant',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      speed: 100,
    });
    engine = new GameEngine({ map, player, floor: 1 });
  });

  it('a) Spawning an adjacent monster and taking a player step causes the monster to act and attack/pursue', () => {
    // Spawn adjacent monster at (5, 6) in hunting mode
    const orc = new Monster({
      id: 'orc_warrior',
      name: 'Orc Warrior',
      position: { x: 5, y: 6 },
      stats: { hp: 30, maxHp: 30, attack: 8, defense: 2 },
      speed: 100,
      aiState: 'hunting',
    });
    engine.addEntity(orc);

    expect(orc.aiState).toBe('hunting');
    expect(player.hp).toBe(50);

    // Player takes a step West to (4, 5).
    // Orc is at (5, 6). Chebyshev distance between (4, 5) and (5, 6) is max(|4-5|, |5-6|) = 1 (diagonal).
    // In response to the player's step, Orc must immediately execute its turn and melee attack the player!
    const stepRes = engine.handlePlayerAction(new MovementAction(player, -1, 0));

    expect(stepRes.success).toBe(true);
    expect(player.x).toBe(4);
    expect(player.y).toBe(5);

    // Orc attacks for 8 - 2 = 6 damage, reducing player HP from 50 to 44
    expect(player.hp).toBe(44);
    expect(engine.messages.some((m) => m.includes('Orc Warrior attacks Valiant for 6 damage'))).toBe(true);
  });

  it('b) Striking a sleeping monster wakes it immediately and results in retaliation', () => {
    // Spawn sleeping goblin at (6, 5) (East of player at 5, 5)
    const goblin = new Monster({
      id: 'sleeping_goblin',
      name: 'Goblin Scout',
      position: { x: 6, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 6, defense: 1 },
      speed: 100,
      aiState: 'sleeping',
    });
    engine.addEntity(goblin);

    expect(goblin.aiState).toBe('sleeping');
    expect(player.hp).toBe(50);

    // Player strikes the sleeping goblin via bump attack East (1, 0)
    const bumpRes = engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(bumpRes.success).toBe(true);
    // Player deals 10 - 1 = 9 damage
    expect(goblin.hp).toBe(11);

    // Goblin must have awakened to 'hunting'
    expect(goblin.aiState).toBe('hunting');

    // In the same turn loop, the awakened goblin retaliates against the player: 6 - 2 = 4 damage
    expect(player.hp).toBe(46);
    expect(engine.messages.some((m) => m.includes('Valiant attacks Goblin Scout for 9 damage'))).toBe(true);
    expect(engine.messages.some((m) => m.includes('Goblin Scout attacks Valiant for 4 damage'))).toBe(true);
  });

  it('c) Awakening sleeping monster upon entering player FOV and pursuing across distance', () => {
    // Place sleeping monster at (5, 8) (distance 3 South of player at 5, 5)
    const skeleton = new Monster({
      id: 'sleeping_skel',
      name: 'Skeleton Warrior',
      position: { x: 5, y: 8 },
      stats: { hp: 15, maxHp: 15, attack: 7, defense: 2 },
      speed: 100,
      aiState: 'sleeping',
    });
    engine.addEntity(skeleton);

    // Update FOV - skeleton is in line of sight (box room) and awakens
    engine.updateFov();
    expect(skeleton.aiState).toBe('hunting');

    // Player waits a turn; skeleton must pathfind closer towards the player
    engine.handlePlayerAction(new WaitAction(player));

    // Skeleton moves from (5, 8) towards (5, 5) -> now at (5, 7)
    expect(skeleton.y).toBe(7);
    expect(skeleton.x).toBe(5);
  });

  it('d) Floor transition from Floor 0 (Town) to Floor 1 cleanses town NPCs from scheduler and registers active dungeon monsters', () => {
    const storage = new MemoryStorage();
    const pm = new ProfileManager(storage);
    const session = pm.createCharacter('DungeonExplorer', { startInTown: true, manifest: cotwManifest });
    const townEngine = session.engine;

    expect(townEngine.currentFloor).toBe(0);

    // Town has NPCs in its scheduler
    const townEntities = townEngine.scheduler.getEntities();
    expect(townEntities.some((e) => e.type === 'npc')).toBe(true);

    // Descend to Floor 1
    townEngine.changeFloor(1);
    expect(townEngine.currentFloor).toBe(1);

    // Scheduler must now ONLY contain the player and Floor 1 monsters (0 town NPCs!)
    const dungeonEntities = townEngine.scheduler.getEntities();
    expect(dungeonEntities.some((e) => e.type === 'npc')).toBe(false);
    expect(dungeonEntities.some((e) => e.type === 'player')).toBe(true);

    // Verify monsters on Floor 1 exist in scheduler and are ready to act
    const dungeonMonsters = dungeonEntities.filter((e) => e.type === 'monster');
    expect(dungeonMonsters.length).toBeGreaterThan(0);

    // Taking a step on Floor 1 does NOT deadlock and monsters accumulate energy/act properly
    const stepResult = townEngine.handlePlayerAction(new WaitAction(townEngine.player));
    expect(stepResult.success).toBe(true);
    expect(townEngine.turnCount).toBe(1);
  });
});
