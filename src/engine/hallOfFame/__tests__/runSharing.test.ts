import { describe, it, expect, beforeEach } from 'vitest';
import { Leaderboard, type ValhallaEntry } from '../leaderboard';
import { MemoryStorage } from '../../storage/profile-manager';

describe('Run Sharing & Saga Exchange System', () => {
  let storage: MemoryStorage;
  let leaderboard: Leaderboard;

  const testEntry: ValhallaEntry = {
    id: 'hero-sigurd',
    heroName: 'Sigurd Dragonbane',
    gender: 'male',
    status: 'victorious',
    epitaph: 'Vanished Fafnir and retrieved the sacred relic of Freyr',
    level: 10,
    deepestFloor: 12,
    turns: 1420,
    xp: 25400,
    goldCp: 185000,
    score: 37325,
    date: 1700000000000,
  };

  beforeEach(() => {
    storage = new MemoryStorage();
    leaderboard = new Leaderboard(storage);
  });

  it('encodes a run entry into a compact, URL-safe string prefixed with SAGA1_', () => {
    const code = Leaderboard.encodeRunShare(testEntry);
    expect(code).toBeDefined();
    expect(code.startsWith('SAGA1_')).toBe(true);

    // Verify it contains only URL-safe characters (letters, numbers, underscore, hyphen)
    const rawPayload = code.slice(6);
    expect(/^[A-Za-z0-9_-]+$/.test(rawPayload)).toBe(true);
  });

  it('decodes an encoded saga code back into identical run details', () => {
    const code = Leaderboard.encodeRunShare(testEntry);
    const decoded = Leaderboard.decodeRunShare(code);

    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(testEntry.id);
    expect(decoded?.heroName).toBe(testEntry.heroName);
    expect(decoded?.gender).toBe(testEntry.gender);
    expect(decoded?.status).toBe(testEntry.status);
    expect(decoded?.epitaph).toBe(testEntry.epitaph);
    expect(decoded?.level).toBe(testEntry.level);
    expect(decoded?.deepestFloor).toBe(testEntry.deepestFloor);
    expect(decoded?.turns).toBe(testEntry.turns);
    expect(decoded?.xp).toBe(testEntry.xp);
    expect(decoded?.goldCp).toBe(testEntry.goldCp);
    expect(decoded?.score).toBe(testEntry.score);
    expect(decoded?.date).toBe(testEntry.date);
  });

  it('rejects invalid or corrupted saga codes', () => {
    expect(Leaderboard.decodeRunShare('')).toBeNull();
    expect(Leaderboard.decodeRunShare('not-a-saga-code')).toBeNull();
    expect(Leaderboard.decodeRunShare('SAGA1_invalid!@#$%')).toBeNull();

    // Tamper with payload (tampered checksum mismatch)
    const validCode = Leaderboard.encodeRunShare(testEntry);
    // Alter characters in the middle of payload
    const tampered = validCode.slice(0, 15) + 'XYZ' + validCode.slice(18);
    const decoded = Leaderboard.decodeRunShare(tampered);
    expect(decoded).toBeNull();
  });

  it('generates a full web share link with the saga code in query params', () => {
    const url = Leaderboard.generateShareUrl(testEntry, 'https://cotw.game/play');
    expect(url.startsWith('https://cotw.game/play?saga=SAGA1_')).toBe(true);

    // Extract code from URL and decode
    const parsedUrl = new URL(url);
    const sagaParam = parsedUrl.searchParams.get('saga');
    expect(sagaParam).not.toBeNull();

    const decoded = Leaderboard.decodeRunShare(sagaParam!);
    expect(decoded?.heroName).toBe(testEntry.heroName);
  });

  it('imports shared saga into the Hall of Valhalla with idempotency', () => {
    expect(leaderboard.getChampions().length).toBe(0);

    const result1 = leaderboard.importSharedRun(testEntry);
    expect(result1.success).toBe(true);
    expect(result1.message).toContain('Inscribed');

    const champions = leaderboard.getChampions();
    expect(champions.length).toBe(1);
    expect(champions[0].heroName).toBe('Sigurd Dragonbane');

    // Attempting duplicate import is rejected cleanly
    const result2 = leaderboard.importSharedRun(testEntry);
    expect(result2.success).toBe(false);
    expect(result2.message).toContain('already inscribed');
    expect(leaderboard.getChampions().length).toBe(1);
  });

  it('correctly ranks imported runs alongside local runs in descending score order', () => {
    const localEntry: ValhallaEntry = {
      id: 'local-bjorn',
      heroName: 'Bjorn the Stout',
      gender: 'male',
      status: 'fallen',
      epitaph: 'Slain by Ogre on Floor 4',
      level: 4,
      deepestFloor: 4,
      turns: 500,
      xp: 2000,
      goldCp: 10000,
      score: 4050,
      date: 1699999000000,
    };

    leaderboard.recordRun(localEntry);
    leaderboard.importSharedRun(testEntry); // 37325 score

    const champions = leaderboard.getChampions();
    expect(champions.length).toBe(2);
    expect(champions[0].heroName).toBe('Sigurd Dragonbane'); // higher score
    expect(champions[1].heroName).toBe('Bjorn the Stout');
  });
});
