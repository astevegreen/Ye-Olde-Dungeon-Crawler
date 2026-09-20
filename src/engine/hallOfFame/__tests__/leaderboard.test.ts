import { describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard, type HallOfFameEntry } from '../leaderboard';
import { MemoryStorage } from '../../storage/profile-manager';

describe('Leaderboard & Hall of Valhalla High Score System', () => {
  let storage: MemoryStorage;
  let leaderboard: Leaderboard;

  beforeEach(() => {
    storage = new MemoryStorage();
    leaderboard = new Leaderboard(storage);
  });

  it('accurately computes score with official formula', () => {
    // XP: 1000 -> 1000 pts
    // Gold: 2500 CP -> 25 GP -> 12 pts
    // Floors Cleared: 4 -> 2000 pts
    // Victorious: false -> 0 pts
    // Total: 1000 + 12 + 2000 = 3012 pts
    const scoreDefeat = Leaderboard.calculateScore(1000, 2500, 4, false);
    expect(scoreDefeat).toBe(3012);

    // Victory bonus: +5000 pts -> 8012 pts
    const scoreVictory = Leaderboard.calculateScore(1000, 2500, 4, true);
    expect(scoreVictory).toBe(8012);
  });

  it('records champions and retrieves sorted in descending score order', () => {
    const entry1: HallOfFameEntry = {
      id: 'hero-1',
      heroName: 'Torvald',
      gender: 'male',
      status: 'fallen',
      epitaph: 'Slain by Kobold on Floor 1',
      level: 1,
      deepestFloor: 1,
      turns: 40,
      xp: 150,
      goldCp: 300,
      score: 651,
      date: 1000,
    };

    const entry2: HallOfFameEntry = {
      id: 'hero-2',
      heroName: 'Astrid',
      gender: 'female',
      status: 'victorious',
      epitaph: 'Hero of Bjarnarhaven',
      level: 5,
      deepestFloor: 5,
      turns: 850,
      xp: 4500,
      goldCp: 50000,
      score: 12250,
      date: 2000,
    };

    const entry3: HallOfFameEntry = {
      id: 'hero-3',
      heroName: 'Sven',
      gender: 'male',
      status: 'fallen',
      epitaph: 'Slain by Ogre on Floor 3',
      level: 3,
      deepestFloor: 3,
      turns: 320,
      xp: 1200,
      goldCp: 2000,
      score: 2710,
      date: 1500,
    };

    leaderboard.recordRun(entry1);
    leaderboard.recordRun(entry2);
    leaderboard.recordRun(entry3);

    const champions = leaderboard.getChampions();
    expect(champions.length).toBe(3);
    // Should be sorted Astrid (12250), Sven (2710), Torvald (651)
    expect(champions[0].heroName).toBe('Astrid');
    expect(champions[1].heroName).toBe('Sven');
    expect(champions[2].heroName).toBe('Torvald');
  });

  it('generates a formatted ASCII memorial scroll for epitaph export', () => {
    const entry: HallOfFameEntry = {
      id: 'hero-export',
      heroName: 'Freya the Bold',
      gender: 'female',
      status: 'victorious',
      epitaph: 'Hero of Bjarnarhaven - Recovered The Sun-Stone',
      level: 4,
      deepestFloor: 5,
      turns: 642,
      xp: 3200,
      goldCp: 18400,
      score: 10792,
      date: Date.now(),
    };

    const epitaph = Leaderboard.formatEpitaph(entry);
    expect(epitaph).toContain('HALL OF VALHALLA MEMORIAL');
    expect(epitaph).toContain('VICTOR OF THE NORTH');
    expect(epitaph).toContain('Freya the Bold');
    expect(epitaph).toContain('10,792 POINTS');
  });
});
