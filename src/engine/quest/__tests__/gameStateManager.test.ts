import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from '../gameStateManager';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { createTestSunStone } from '../../__fixtures__/testHelpers';
import { MemoryStorage, ProfileManager } from '../../storage/profile-manager';
import { Leaderboard } from '../../hallOfFame/leaderboard';
import { Monster } from '../../entities/monster';
import { QUEST_RELIC_ID } from '../types';

describe('GameStateManager & Win/Loss Sequences', () => {
  let storage: MemoryStorage;
  let leaderboard: Leaderboard;
  let manager: ProfileManager;
  let gameState: GameStateManager;
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    storage = new MemoryStorage();
    leaderboard = new Leaderboard(storage);
    manager = new ProfileManager(storage);
    gameState = new GameStateManager(leaderboard);

    const map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'saga-hero',
      name: 'Bjorn',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
    });

    engine = new GameEngine({
      map,
      player,
      floor: 0,
      gameState,
    });
  });

  it('initializes in active state and tracks deepest floor', () => {
    expect(gameState.runStatus).toBe('active');
    expect(gameState.deepestFloor).toBe(0);

    gameState.updateFloor(3);
    expect(gameState.deepestFloor).toBe(3);

    // Should not decrease if ascending
    gameState.updateFloor(1);
    expect(gameState.deepestFloor).toBe(3);
  });

  it('records monster kills and flags boss defeat when Hrungnir is slain', () => {
    const minion = new Monster({
      id: 'minion-1',
      name: 'Goblin',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 4, defense: 1 },
      definitionId: 'goblin',
    });

    gameState.recordMonsterKill(minion);
    expect(gameState.monstersKilled).toBe(1);
    expect(gameState.bossDefeated).toBe(false);

    const boss = new Monster({
      id: 'boss-1',
      name: 'Hrungnir the Hill Giant Chieftain',
      position: { x: 7, y: 5 },
      stats: { hp: 120, maxHp: 120, attack: 18, defense: 8 },
      definitionId: 'boss_hrungnir',
    });

    gameState.recordMonsterKill(boss);
    expect(gameState.monstersKilled).toBe(2);
    expect(gameState.bossDefeated).toBe(true);
  });

  it('validates victory conditions: in town with Sun-Stone', () => {
    // 1. In town without Sun-Stone
    engine.currentFloor = 0;
    expect(gameState.checkVictoryEligible(engine)).toBeUndefined();

    // 2. In dungeon (Floor 3) with Sun-Stone
    engine.currentFloor = 3;
    player.inventory.primaryPack.addItem(createTestSunStone(QUEST_RELIC_ID));
    expect(gameState.checkVictoryEligible(engine)).toBeUndefined();

    // 3. In town (Floor 0) with Sun-Stone — the legacy single-ending fallback
    // (no manifest.quest.endings declared) reports the 'default' ending id.
    engine.currentFloor = 0;
    expect(gameState.checkVictoryEligible(engine)).toBe('default');
  });

  it('triggers victory, awards 5000 victory points, and updates profile', () => {
    // Give hero Sun-Stone and XP
    player.inventory.primaryPack.addItem(createTestSunStone(QUEST_RELIC_ID));
    player.gainXp(1200);
    engine.currentFloor = 0;
    gameState.updateFloor(5);

    // Register character in profile manager
    const { profile } = manager.createCharacter('Bjorn');
    (player as any).id = profile.id;

    const entry = gameState.triggerVictory(engine, manager);
    expect(gameState.runStatus).toBe('victorious');
    expect(entry.status).toBe('victorious');
    expect(entry.score).toBeGreaterThanOrEqual(5000); // Has 5000 victory bonus

    // Check saved entry in Hall of Valhalla
    const champions = leaderboard.getChampions();
    expect(champions.length).toBe(1);
    expect(champions[0].status).toBe('victorious');
    expect(champions[0].heroName).toBe('Bjorn');

    // Check profile status is marked as victorious
    const updatedProf = manager.getProfile(profile.id);
    expect(updatedProf?.questStatus).toBe('victorious');
  });

  it('supports multiple named endings (ARCHITECTURE.md §3), picking the first satisfied condition', () => {
    const endingsEngine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player,
      floor: 5,
      gameState,
      manifest: {
        ...engine.manifest,
        quest: {
          ...engine.manifest.quest,
          victoryFloor: 5,
          endings: {
            ragnarok: {
              id: 'ragnarok',
              requiredFlag: 'nidhogg_slain',
              victoryDialogue: 'The World Serpent falls; the sky splits.',
              victoryEpitaph: 'Ended Nidhogg, and with it, an age.',
              victoryScoreBonus: 9000,
            },
            sealed: {
              id: 'sealed',
              requiredFlag: 'nidhogg_sealed',
              victoryDialogue: 'The root is sealed; the world holds.',
              victoryEpitaph: 'Drove Nidhogg from the root of Yggdrasil.',
              victoryScoreBonus: 6000,
            },
          },
        },
      },
    });

    // Neither flag set yet: not eligible for either ending.
    expect(gameState.checkVictoryEligible(endingsEngine)).toBeUndefined();

    // Driving the boss off (not killing it) satisfies 'sealed', checked before
    // 'ragnarok' in insertion order but only matching its own flag.
    endingsEngine.setWorldFlag('nidhogg_sealed', true);
    expect(gameState.checkVictoryEligible(endingsEngine)).toBe('sealed');

    const sealedEntry = gameState.triggerVictory(endingsEngine, undefined, 'sealed');
    expect(sealedEntry.epitaph).toBe('Drove Nidhogg from the root of Yggdrasil.');
    expect(sealedEntry.score).toBeGreaterThanOrEqual(6000);
  });

  it('the ragnarok ending fires only for its own flag, with its own text and bonus', () => {
    gameState.runStatus = 'active'; // reset from the previous test's victory
    const endingsEngine = new GameEngine({
      map: new GameMap(10, 10, TILES.FLOOR),
      player,
      floor: 5,
      gameState,
      manifest: {
        ...engine.manifest,
        quest: {
          ...engine.manifest.quest,
          victoryFloor: 5,
          endings: {
            ragnarok: {
              id: 'ragnarok',
              requiredFlag: 'nidhogg_slain',
              victoryDialogue: 'The World Serpent falls; the sky splits.',
              victoryEpitaph: 'Ended Nidhogg, and with it, an age.',
              victoryScoreBonus: 9000,
            },
            sealed: {
              id: 'sealed',
              requiredFlag: 'nidhogg_sealed',
              victoryDialogue: 'The root is sealed; the world holds.',
              victoryEpitaph: 'Drove Nidhogg from the root of Yggdrasil.',
              victoryScoreBonus: 6000,
            },
          },
        },
      },
    });

    endingsEngine.setWorldFlag('nidhogg_slain', true);
    expect(gameState.checkVictoryEligible(endingsEngine)).toBe('ragnarok');

    const entry = gameState.triggerVictory(endingsEngine, undefined, 'ragnarok');
    expect(entry.epitaph).toBe('Ended Nidhogg, and with it, an age.');
    expect(entry.score).toBeGreaterThanOrEqual(9000);
  });

  it('triggers permadeath on fatal wounds, archives fallen hero, and records in Valhalla', () => {
    engine.currentFloor = 4;
    gameState.updateFloor(4);
    player.gainXp(450);

    const killer = new Monster({
      id: 'killer-ogre',
      name: 'Ogre Brute',
      position: { x: 5, y: 6 },
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 4 },
    });

    const entry = gameState.triggerDeath(engine, killer);
    expect(gameState.runStatus).toBe('fallen');
    expect(entry.status).toBe('fallen');
    expect(entry.epitaph).toBe('Slain by Ogre Brute on Floor 4');

    const champions = leaderboard.getChampions();
    expect(champions.length).toBe(1);
    expect(champions[0].status).toBe('fallen');
    expect(champions[0].epitaph).toContain('Ogre Brute');
  });
});
