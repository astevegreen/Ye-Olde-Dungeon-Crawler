import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import {
  recordMilestone,
  getRenownTotal,
  hasEarnedMilestone,
  getActiveTitle,
} from '../renownLedger';
import type { GameContentManifest, RenownMilestoneDefinition, RenownTitleDefinition } from '../../types/manifest';

describe('RenownLedger (Milestone Renown Meta-Progression)', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  const testMilestones: RenownMilestoneDefinition[] = [
    {
      id: 'slay_first_goblin',
      category: 'combat',
      label: 'Goblin Slayer',
      description: 'Slay your first goblin in the deep warrens.',
      renownValue: 10,
      repeatable: false,
      flag: 'flag_goblin_slayer_unlocked',
    },
    {
      id: 'open_chest',
      category: 'exploration',
      label: 'Treasure Seeker',
      description: 'Open a dungeon chest.',
      renownValue: 5,
      repeatable: true,
    },
  ];

  const testTitles: RenownTitleDefinition[] = [
    { title: 'the Explorer', threshold: 15, category: 'exploration' },
    { title: 'the Veteran', threshold: 20, category: 'combat' },
    { title: 'Dungeon Master', threshold: 50 },
  ];

  const testManifest: Partial<GameContentManifest> = {
    id: 'test_manifest',
    name: 'Test Manifest',
    renownMilestones: testMilestones,
    renownTitles: testTitles,
  };

  beforeEach(() => {
    map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player, manifest: testManifest as GameContentManifest });
  });

  describe('recordMilestone', () => {
    it('returns awarded: false for unknown milestone IDs', () => {
      const result = recordMilestone(engine, 'nonexistent_milestone');
      expect(result).toEqual({ awarded: false, reason: 'unknown_milestone' });
      expect(getRenownTotal(engine)).toBe(0);
    });

    it('awards non-repeatable milestone, increments category and total renown, and sets flags', () => {
      const result = recordMilestone(engine, 'slay_first_goblin');

      expect(result.awarded).toBe(true);
      expect(result.renownValue).toBe(10);
      expect(result.category).toBe('combat');
      expect(result.totalForCategory).toBe(10);
      expect(result.totalRenown).toBe(10);

      expect(getRenownTotal(engine, 'combat')).toBe(10);
      expect(getRenownTotal(engine)).toBe(10);
      expect(hasEarnedMilestone(engine, 'slay_first_goblin')).toBe(true);
      expect(engine.worldState.flags['flag_goblin_slayer_unlocked']).toBe(true);
    });

    it('rejects awarding non-repeatable milestone a second time', () => {
      const first = recordMilestone(engine, 'slay_first_goblin');
      expect(first.awarded).toBe(true);

      const second = recordMilestone(engine, 'slay_first_goblin');
      expect(second).toEqual({ awarded: false, reason: 'already_earned' });

      expect(getRenownTotal(engine, 'combat')).toBe(10);
      expect(getRenownTotal(engine)).toBe(10);
    });

    it('allows repeatable milestones to be recorded multiple times', () => {
      const first = recordMilestone(engine, 'open_chest');
      expect(first.awarded).toBe(true);
      expect(first.totalForCategory).toBe(5);
      expect(first.totalRenown).toBe(5);

      const second = recordMilestone(engine, 'open_chest');
      expect(second.awarded).toBe(true);
      expect(second.totalForCategory).toBe(10);
      expect(second.totalRenown).toBe(10);

      const third = recordMilestone(engine, 'open_chest');
      expect(third.awarded).toBe(true);
      expect(third.totalForCategory).toBe(15);
      expect(third.totalRenown).toBe(15);

      expect(getRenownTotal(engine, 'exploration')).toBe(15);
      expect(getRenownTotal(engine)).toBe(15);
    });

    it('accumulates separate categories while maintaining unified total', () => {
      recordMilestone(engine, 'slay_first_goblin'); // +10 combat
      recordMilestone(engine, 'open_chest'); // +5 exploration
      recordMilestone(engine, 'open_chest'); // +5 exploration

      expect(getRenownTotal(engine, 'combat')).toBe(10);
      expect(getRenownTotal(engine, 'exploration')).toBe(10);
      expect(getRenownTotal(engine)).toBe(20);
    });
  });

  describe('getActiveTitle', () => {
    it('returns null when no titles qualify', () => {
      expect(getActiveTitle(engine)).toBeNull();
    });

    it('returns category-based title when category threshold is reached', () => {
      recordMilestone(engine, 'open_chest');
      recordMilestone(engine, 'open_chest');
      expect(getActiveTitle(engine)).toBeNull();

      // Third chest reaches 15 exploration renown -> 'the Explorer'
      recordMilestone(engine, 'open_chest');
      expect(getActiveTitle(engine)).toBe('the Explorer');
    });

    it('returns higher threshold title when multiple titles qualify', () => {
      // 3 chests = 15 exploration -> 'the Explorer'
      recordMilestone(engine, 'open_chest');
      recordMilestone(engine, 'open_chest');
      recordMilestone(engine, 'open_chest');
      expect(getActiveTitle(engine)).toBe('the Explorer');

      // Add combat milestone
      recordMilestone(engine, 'slay_first_goblin'); // 10 combat, total 25
      expect(getActiveTitle(engine)).toBe('the Explorer');

      // Now set total to 55 to qualify for global threshold 50 'Dungeon Master'
      for (let i = 0; i < 6; i++) {
        recordMilestone(engine, 'open_chest');
      }
      expect(getActiveTitle(engine)).toBe('Dungeon Master');
    });

    it('returns null if engine manifest has no renown titles', () => {
      const bareEngine = new GameEngine({ map, player, manifest: { id: 'bare', name: 'Bare' } as GameContentManifest });
      expect(getActiveTitle(bareEngine)).toBeNull();
    });
  });
});
