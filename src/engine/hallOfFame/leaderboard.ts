import type { Gender } from '../character/types';
import type { StorageAdapter } from '../storage/types';
import { getDefaultStorage } from '../storage/profile-manager';
import { utf8ToBase64, base64ToUtf8 } from '../storage/saveTransfer';

const VALHALLA_STORAGE_KEY = 'cotw_valhalla_champions';

export interface ValhallaEntry {
  id: string;
  heroName: string;
  gender: Gender;
  status: 'victorious' | 'fallen';
  epitaph: string;
  level: number;
  deepestFloor: number;
  turns: number;
  xp: number;
  goldCp: number;
  score: number;
  date: number;
}

export interface SharedSagaEnvelope {
  version: 1;
  generator: 'cotw_valhalla';
  timestamp: number;
  entry: ValhallaEntry;
  checksum: number;
}

function computeSagaChecksum(entry: ValhallaEntry): number {
  const str = `${entry.id}:${entry.heroName}:${entry.status}:${entry.score}:${entry.level}:${entry.deepestFloor}:${entry.turns}:${entry.xp}:${entry.goldCp}:${entry.date}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class Leaderboard {
  private storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? getDefaultStorage();
  }

  /**
   * Calculates final score according to the official Castle of the Winds rubric:
   * (XP * 1.0) + (Total Gold GP * 0.5) + (Deepest Floor * 500) + (Victory ? 5000 : 0)
   */
  public static calculateScore(
    xp: number,
    totalGoldCp: number,
    deepestFloor: number,
    isVictorious: boolean,
    customVictoryBonus = 5000
  ): number {
    const goldGp = Math.floor(totalGoldCp / 100);
    const xpPoints = Math.floor(xp * 1.0);
    const goldPoints = Math.floor(goldGp * 0.5);
    const floorPoints = Math.max(0, deepestFloor) * 500;
    const victoryBonus = isVictorious ? customVictoryBonus : 0;

    return xpPoints + goldPoints + floorPoints + victoryBonus;
  }

  /**
   * Retrieves all champions from storage sorted in descending score order.
   */
  public getChampions(): ValhallaEntry[] {
    const raw = this.storage.getItem(VALHALLA_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as ValhallaEntry[]).sort((a, b) => b.score - a.score);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Records a new run entry into the Hall of Valhalla.
   */
  public recordRun(entry: ValhallaEntry): void {
    const champions = this.getChampions();
    champions.push(entry);
    champions.sort((a, b) => b.score - a.score);
    this.storage.setItem(VALHALLA_STORAGE_KEY, JSON.stringify(champions));
  }

  /**
   * Formats a glorious ASCII memorial epitaph for clipboard export.
   */
  public static formatEpitaph(entry: ValhallaEntry): string {
    const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const statusBanner =
      entry.status === 'victorious'
        ? '✦ ✦ ✦ VICTOR OF THE NORTH ✦ ✦ ✦'
        : '✝ ✝ ✝ FALLEN IN BATTLE ✝ ✝ ✝';

    const goldGp = Math.floor(entry.goldCp / 100);

    return [
      '╔════════════════════════════════════════════════════════════╗',
      '║                 HALL OF VALHALLA MEMORIAL                  ║',
      '╠════════════════════════════════════════════════════════════╣',
      `║ ${statusBanner.padEnd(58)} ║`,
      '╠════════════════════════════════════════════════════════════╣',
      `║ Hero:         ${entry.heroName.padEnd(43)} ║`,
      `║ Rank / Level: Level ${entry.level.toString().padEnd(37)} ║`,
      `║ Fate:         ${entry.epitaph.slice(0, 43).padEnd(43)} ║`,
      `║ Depth:        Floor ${entry.deepestFloor.toString().padEnd(37)} ║`,
      `║ Turns Taken:  ${entry.turns.toString().padEnd(43)} ║`,
      `║ Experience:   ${entry.xp.toString()} XP`.padEnd(59) + '║',
      `║ Wealth:       ${goldGp.toString()} GP (${entry.goldCp.toString()} CP)`.padEnd(59) + '║',
      '╠════════════════════════════════════════════════════════════╣',
      `║ FINAL SCORE:  ${entry.score.toLocaleString()} POINTS`.padEnd(59) + '║',
      `║ Date of Saga: ${dateStr.padEnd(43)} ║`,
      '╚════════════════════════════════════════════════════════════╝',
    ].join('\n');
  }

  /**
   * Encodes a Valhalla run entry into a compact, URL-safe Base64 string with checksum.
   */
  public static encodeRunShare(entry: ValhallaEntry): string {
    const envelope: SharedSagaEnvelope = {
      version: 1,
      generator: 'cotw_valhalla',
      timestamp: Date.now(),
      entry: {
        id: entry.id,
        heroName: entry.heroName,
        gender: entry.gender,
        status: entry.status,
        epitaph: entry.epitaph,
        level: entry.level,
        deepestFloor: entry.deepestFloor,
        turns: entry.turns,
        xp: entry.xp,
        goldCp: entry.goldCp,
        score: entry.score,
        date: entry.date,
      },
      checksum: computeSagaChecksum(entry),
    };

    const json = JSON.stringify(envelope);
    const b64 = utf8ToBase64(json);
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `SAGA1_${urlSafe}`;
  }

  /**
   * Decodes a URL-safe Base64 run share code into a validated ValhallaEntry,
   * verifying schema integrity and checksum. Returns null if corrupted or invalid.
   */
  public static decodeRunShare(code: string): ValhallaEntry | null {
    if (!code || typeof code !== 'string') return null;
    let raw = code.trim();
    if (raw.startsWith('SAGA1_')) {
      raw = raw.slice(6);
    } else if (raw.startsWith('COTW_SAGA_')) {
      raw = raw.slice(10);
    }

    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }

    try {
      const json = base64ToUtf8(b64);
      const parsed = JSON.parse(json);
      if (!parsed || parsed.version !== 1 || !parsed.entry) return null;
      const entry = parsed.entry as ValhallaEntry;

      if (
        typeof entry.heroName !== 'string' ||
        typeof entry.score !== 'number' ||
        typeof entry.level !== 'number' ||
        typeof entry.deepestFloor !== 'number' ||
        typeof entry.turns !== 'number' ||
        (entry.status !== 'victorious' && entry.status !== 'fallen')
      ) {
        return null;
      }

      const expectedChecksum = computeSagaChecksum(entry);
      if (parsed.checksum !== expectedChecksum) {
        return null;
      }

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Generates a complete web share URL embedding the run saga code in the query string.
   */
  public static generateShareUrl(entry: ValhallaEntry, baseUrl?: string): string {
    const code = Leaderboard.encodeRunShare(entry);
    const base = baseUrl || 'https://cotw.game/';

    try {
      const url = new URL(base);
      url.searchParams.set('saga', code);
      return url.toString();
    } catch {
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}saga=${encodeURIComponent(code)}`;
    }
  }

  /**
   * Imports a shared saga entry and records it into the Hall of Valhalla.
   * Idempotent: detects duplicate saga entries and avoids duplicate inscriptions.
   */
  public importSharedRun(entry: ValhallaEntry): { success: boolean; message: string; champion?: ValhallaEntry } {
    const champions = this.getChampions();
    const isDuplicate = champions.some(
      (c) => c.id === entry.id || (c.heroName === entry.heroName && c.score === entry.score && c.date === entry.date)
    );
    if (isDuplicate) {
      return { success: false, message: `${entry.heroName}'s saga is already inscribed in Valhalla!`, champion: entry };
    }
    this.recordRun(entry);
    return {
      success: true,
      message: `Inscribed ${entry.heroName} (${entry.score.toLocaleString()} pts) into the Hall of Valhalla! 🏆`,
      champion: entry,
    };
  }

  /**
   * Clears all leaderboard entries (useful for testing).
   */
  public clear(): void {
    this.storage.removeItem(VALHALLA_STORAGE_KEY);
  }
}
