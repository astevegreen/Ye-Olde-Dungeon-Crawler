import { describe, it, expect } from 'vitest';
import { DungeonArc } from '../dungeonArc';
import { ProfileManager } from '../../storage/profile-manager';
import { serializeGame, deserializeGame } from '../../storage/serializer';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { DIFFICULTY_MAX_FLOORS } from '../../types';
import type { QuestArcDefinition } from '../../types/manifest';
import type { CharacterProfile } from '../../storage/types';
import { COTW_QUEST } from '../../../content/cotw/quest';

describe('Dynamic Dungeon Depth & Difficulty Scaling', () => {
  const makeQuestArc = (maxFloor: number): QuestArcDefinition => ({
    ...COTW_QUEST,
    id: `arc-${maxFloor}`,
    name: `Quest Arc ${maxFloor}`,
    maxFloor,
    bossFloor: maxFloor,
  });

  describe('DungeonArc Floor Generation with Dynamic Max Floor', () => {
    it('generates Easy difficulty (25F) procedural floors and climax chamber', () => {
      const easyArc = makeQuestArc(25);

      expect(DungeonArc.isBossFloor(1, easyArc)).toBe(false);
      expect(DungeonArc.isBossFloor(24, easyArc)).toBe(false);
      expect(DungeonArc.isBossFloor(25, easyArc)).toBe(true);

      // Floor 24 should have stairs down
      const floor24 = DungeonArc.generateFloor(24, 1234, easyArc);
      expect(floor24.stairsUp).toBeDefined();
      expect(floor24.stairsDown).toBeDefined();
      expect(floor24.boss).toBeUndefined();

      // Floor 25 should be the Chieftain's Lair: boss present, no stairs down
      const floor25 = DungeonArc.generateFloor(25, 1234, easyArc);
      expect(floor25.stairsUp).toBeDefined();
      expect(floor25.stairsDown).toBeUndefined();
      expect(floor25.boss).toBeDefined();

      const boss = floor25.boss!;
      expect(boss.name).toBe('Hrungnir the Hill Giant Chieftain');
      // Scaled math on Floor 25:
      // HP: 120 * (1 + 0.08 * 24) = 120 * 2.92 = 350
      // Atk: 18 + floor(0.6 * 24) = 18 + 14 = 32
      // Def: 8 + floor(0.4 * 24) = 8 + 9 = 17
      expect(boss.hp).toBe(350);
      expect(boss.attack).toBe(32);
      expect(boss.defense).toBe(17);
    });

    it('generates Medium difficulty (37F) and Hard difficulty (50F) climax chambers', () => {
      const medArc = makeQuestArc(37);
      expect(DungeonArc.isBossFloor(37, medArc)).toBe(true);
      const floor37 = DungeonArc.generateFloor(37, 5678, medArc);
      expect(floor37.boss).toBeDefined();
      expect(floor37.stairsDown).toBeUndefined();
      // Floor 37 Boss stats:
      // HP: 120 * (1 + 0.08 * 36) = 120 * 3.88 = 466
      // Atk: 18 + floor(0.6 * 36) = 18 + 21 = 39
      // Def: 8 + floor(0.4 * 36) = 8 + 14 = 22
      expect(floor37.boss!.hp).toBe(466);
      expect(floor37.boss!.attack).toBe(39);
      expect(floor37.boss!.defense).toBe(22);

      const hardArc = makeQuestArc(50);
      expect(DungeonArc.isBossFloor(50, hardArc)).toBe(true);
      const floor50 = DungeonArc.generateFloor(50, 9999, hardArc);
      expect(floor50.boss).toBeDefined();
      expect(floor50.stairsDown).toBeUndefined();
      // Floor 50 Boss stats:
      // HP: 120 * (1 + 0.08 * 49) = 120 * 4.92 = 590
      // Atk: 18 + floor(0.6 * 49) = 18 + 29 = 47
      // Def: 8 + floor(0.4 * 49) = 8 + 19 = 27
      expect(floor50.boss!.hp).toBe(590);
      expect(floor50.boss!.attack).toBe(47);
      expect(floor50.boss!.defense).toBe(27);
    });
  });

  describe('Character Profile & Serialization of Difficulty', () => {
    it('creates character with specified difficulty and corresponding maxFloor', () => {
      const profileManager = new ProfileManager();

      const { profile: easyChar } = profileManager.createCharacter('EasyHero', {
        gender: 'male',
        difficulty: 'easy',
      });
      expect(easyChar.difficulty).toBe('easy');
      expect(easyChar.maxFloor).toBe(DIFFICULTY_MAX_FLOORS.easy); // 25

      const { profile: hardChar } = profileManager.createCharacter('HardHero', {
        gender: 'female',
        difficulty: 'hard',
      });
      expect(hardChar.difficulty).toBe('hard');
      expect(hardChar.maxFloor).toBe(DIFFICULTY_MAX_FLOORS.hard); // 50

      const { profile: defaultChar } = profileManager.createCharacter('DefaultHero', {
        gender: 'male',
      });
      expect(defaultChar.difficulty).toBe('medium');
      expect(defaultChar.maxFloor).toBe(DIFFICULTY_MAX_FLOORS.medium); // 37
    });

    it('roundtrips difficulty and maxFloor through serializeGame and deserializeGame', () => {
      const map = new GameMap(10, 10, TILES.FLOOR);
      const player = new Player({
        id: 'test-player-diff',
        name: 'Thorvald',
        position: { x: 5, y: 5 },
        difficulty: 'hard',
        maxFloor: 50,
      });

      expect(player.difficulty).toBe('hard');
      expect(player.maxFloor).toBe(50);

      const engine = new GameEngine({ map, player });
      const profile: CharacterProfile = {
        id: player.id,
        name: player.name,
        level: 1,
        floor: 1,
        lastSaved: Date.now(),
        hp: player.hp,
        maxHp: player.maxHp,
        strength: 15,
        difficulty: player.difficulty,
        maxFloor: player.maxFloor,
      };

      const serialized = serializeGame(engine, profile);
      expect(serialized.player.difficulty).toBe('hard');
      expect(serialized.player.maxFloor).toBe(50);
      expect(serialized.profile.difficulty).toBe('hard');
      expect(serialized.profile.maxFloor).toBe(50);

      const { engine: restoredEngine } = deserializeGame(serialized);
      expect(restoredEngine.player.difficulty).toBe('hard');
      expect(restoredEngine.player.maxFloor).toBe(50);
    });
  });
});
