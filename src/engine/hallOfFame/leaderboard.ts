import type { Gender } from '../character/types';
import type { StorageAdapter } from '../storage/types';
import { getDefaultStorage } from '../storage/profile-manager';
import { utf8ToBase64, base64ToUtf8 } from '../storage/saveTransfer';
import { flightRecorder } from '../debug/flightRecorder';

const HALL_OF_FAME_STORAGE_KEY = 'yodc_hall_of_fame';

export interface HallOfFameEntry {
  id: string;
  heroName: string;
  gender: Gender;
  status: 'victorious' | 'fallen';
  epitaph: string;
  level: number;
  deepestFloor: number;
  turns: number;
  /** XP earned over the whole run (Player.totalXp). */
  xp: number;
  goldCp: number;
  score: number;
  date: number;
}

/**
 * A run as a saga code carries it. A code carries no id: an entry's id is its hero's profile
 * id (`hero_<creation time>_<random>`), and an inscription gets its own (R-econ-23). A code
 * written before then carries the sharer's id, and its checksum covers it.
 */
type SharedSagaEntry = Omit<HallOfFameEntry, 'id'> & { id?: string };

export interface SharedSagaEnvelope {
  version: 1;
  generator: 'yodc_saga';
  timestamp: number;
  entry: SharedSagaEntry;
  checksum: number;
}

/** A missing id reads as empty, so a code with one checks exactly as it always did. */
function computeSagaChecksum(entry: SharedSagaEntry): number {
  const str = `${entry.id ?? ''}:${entry.heroName}:${entry.status}:${entry.score}:${entry.level}:${entry.deepestFloor}:${entry.turns}:${entry.xp}:${entry.goldCp}:${entry.date}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The id a shared saga is inscribed under: derived from the run, never the sharer's. */
function inscriptionId(entry: SharedSagaEntry): string {
  return `saga-${computeSagaChecksum({ ...entry, id: 'saga' }).toString(36)}`;
}

export class Leaderboard {
  private storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? getDefaultStorage();
  }

  /**
   * Calculates final score:
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
  public getChampions(): HallOfFameEntry[] {
    const raw = this.storage.getItem(HALL_OF_FAME_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return (parsed as HallOfFameEntry[]).sort((a, b) => b.score - a.score);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Records a new run entry into the hall of fame. Returns false, and records why, when
   * the storage refuses the write (a full quota): the death and victory screens follow
   * this call, so it never throws (R-stor-9).
   */
  public recordRun(entry: HallOfFameEntry): boolean {
    const champions = this.getChampions();
    champions.push(entry);
    champions.sort((a, b) => b.score - a.score);
    try {
      this.storage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(champions));
      return true;
    } catch (err) {
      flightRecorder.warn('[Leaderboard] Could not record the run in the hall of fame:', { error: String(err) });
      return false;
    }
  }

  /**
   * Encodes a hall-of-fame entry into a compact, URL-safe Base64 string with checksum.
   * The entry's id, its hero's profile id, stays out of it.
   */
  public static encodeRunShare(entry: HallOfFameEntry): string {
    const shared: SharedSagaEntry = {
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
    };
    const envelope: SharedSagaEnvelope = {
      version: 1,
      generator: 'yodc_saga',
      timestamp: Date.now(),
      entry: shared,
      checksum: computeSagaChecksum(shared),
    };

    const json = JSON.stringify(envelope);
    const b64 = utf8ToBase64(json);
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `SAGA1_${urlSafe}`;
  }

  /**
   * Decodes a URL-safe Base64 run share code into a validated HallOfFameEntry,
   * verifying schema integrity and checksum. Returns null if corrupted or invalid.
   * The entry comes back under the id its inscription gets, whatever id an older code carried.
   */
  public static decodeRunShare(code: string): HallOfFameEntry | null {
    if (!code || typeof code !== 'string') return null;
    let raw = code.trim();
    if (raw.startsWith('SAGA1_')) {
      raw = raw.slice(6);
    }

    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }

    try {
      const json = base64ToUtf8(b64);
      const parsed = JSON.parse(json);
      if (!parsed || parsed.version !== 1 || !parsed.entry) return null;
      const entry = parsed.entry as SharedSagaEntry;

      // Anyone can compute the checksum, so every field is checked: the preview and the
      // hall render all of them (R-econ-23).
      const isNumber = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
      if (
        (entry.id !== undefined && typeof entry.id !== 'string') ||
        typeof entry.heroName !== 'string' ||
        (entry.gender !== 'male' && entry.gender !== 'female') ||
        (entry.status !== 'victorious' && entry.status !== 'fallen') ||
        typeof entry.epitaph !== 'string' ||
        !isNumber(entry.level) ||
        !isNumber(entry.deepestFloor) ||
        !isNumber(entry.turns) ||
        !isNumber(entry.xp) ||
        !isNumber(entry.goldCp) ||
        !isNumber(entry.score) ||
        !isNumber(entry.date)
      ) {
        return null;
      }

      const expectedChecksum = computeSagaChecksum(entry);
      if (parsed.checksum !== expectedChecksum) {
        return null;
      }

      return {
        id: inscriptionId(entry),
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
      };
    } catch {
      return null;
    }
  }

  /**
   * Generates a complete web share URL embedding the run saga code in the query string.
   */
  public static generateShareUrl(entry: HallOfFameEntry, baseUrl?: string): string {
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
   * Imports a shared saga entry and records it into the hall of fame.
   * Idempotent: detects duplicate saga entries and avoids duplicate inscriptions.
   * The inscription gets its own id, derived from the run: the sharer's id is their
   * hero's profile id, which every run of that hero shares (R-econ-23).
   */
  public importSharedRun(entry: HallOfFameEntry): { success: boolean; message: string; champion?: HallOfFameEntry } {
    const champions = this.getChampions();
    const isDuplicate = champions.some(
      (c) => c.heroName === entry.heroName && c.score === entry.score && c.date === entry.date
    );
    if (isDuplicate) {
      return { success: false, message: `${entry.heroName}'s saga is already inscribed in the Hall of Fame!`, champion: entry };
    }
    const inscribed: HallOfFameEntry = { ...entry, id: inscriptionId(entry) };
    if (!this.recordRun(inscribed)) {
      return { success: false, message: `Could not inscribe ${entry.heroName}: the browser's storage refused it.`, champion: entry };
    }
    return {
      success: true,
      message: `Inscribed ${entry.heroName} (${entry.score.toLocaleString()} pts) into the Hall of Fame!`,
      champion: inscribed,
    };
  }

  /**
   * Clears all leaderboard entries (useful for testing).
   */
  public clear(): void {
    this.storage.removeItem(HALL_OF_FAME_STORAGE_KEY);
  }
}
