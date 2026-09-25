import { flightRecorder, type FlightEvent, type GameEngine, type StorageAdapter } from '../engine';

const KEY = 'yodc:session-guard';
/** Older unfinished sessions aren't worth asking about. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** What a session had persisted when it last took an input. */
export interface UnfinishedSession {
  savedAt: number;
  appVersion?: string;
  buildId?: string;
  manifestId: string;
  heroName: string;
  floor: number;
  turn: number;
  /** The input the game was handling when it stopped, e.g. `KeyZ` or `tap on BUTTON`. */
  lastInput: string;
  /** False once the page is hidden, so a phone evicting a background tab isn't a freeze. */
  visible: boolean;
  replay: string | null;
  events: FlightEvent[];
}

/**
 * Detects a session that stopped responding. A hung page runs no more script, so nothing
 * can be reported from inside it; instead, every input first persists the replay data
 * and recent log, and a clean exit (`pagehide`, save & quit, the crash dialog) removes
 * the record. A record still there on the next launch, from a page that was visible,
 * means the last session hung, and a report can be filed for it from the menu.
 */
export class SessionGuard {
  constructor(
    private readonly storage: StorageAdapter | null,
    private readonly build: { appVersion?: string; buildId?: string }
  ) {}

  /** Call before the game acts on an input. Never throws: a full storage quota is ignored. */
  public noteInput(engine: GameEngine, input: string): void {
    if (!this.storage) return;
    const record: UnfinishedSession = {
      savedAt: Date.now(),
      ...this.build,
      manifestId: engine.manifest?.id ?? 'unknown',
      heroName: engine.player.name,
      floor: engine.currentFloor,
      turn: engine.turnCount,
      lastInput: input,
      visible: true,
      replay: flightRecorder.exportReplayJson(engine),
      events: flightRecorder.getRecentEvents(50),
    };
    try {
      this.storage.setItem(KEY, JSON.stringify(record));
    } catch {
      // Quota or privacy mode: freeze detection is best-effort.
    }
  }

  public setVisible(visible: boolean): void {
    const record = this.read();
    if (!record || record.visible === visible) return;
    try {
      this.storage?.setItem(KEY, JSON.stringify({ ...record, visible }));
    } catch {
      // best-effort
    }
  }

  /** The session ended normally; nothing to report. */
  public end(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // best-effort
    }
  }

  /** The last session, if it stopped responding while visible. Clears it either way. */
  public takeUnfinished(now = Date.now()): UnfinishedSession | null {
    const record = this.read();
    this.end();
    if (!record || !record.visible || now - record.savedAt > MAX_AGE_MS) return null;
    return record;
  }

  private read(): UnfinishedSession | null {
    try {
      const raw = this.storage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as UnfinishedSession) : null;
    } catch {
      return null;
    }
  }
}
