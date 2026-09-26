import type { GameEngine } from '../engine';
import { classifyLoadError, MISSING_SAVE, type LoadOutcome } from './loadResult';
import type { CharacterProfile, SaveData, StorageAdapter } from './types';
import type { GameContentManifest } from '../types/manifest';
import { serializeGame, deserializeGame } from './serializer';
import { CURRENT_SCHEMA_VERSION, defaultMigrator } from './migrator';
import { getDefaultStorage } from './profile-manager';
import { flightRecorder } from '../debug/flightRecorder';

export interface AutosaveEnvelope {
  schemaVersion: number;
  contentManifestId: string;
  timestamp: number;
  profile: CharacterProfile;
  data: SaveData;
}

/**
 * `latest` is the rolling autosave. `preserved` holds the run a newer autosave would
 * otherwise have destroyed (ARCHITECTURE.md §5, Autosave Never Erases Deeper Progress).
 */
export type AutosaveSlot = 'latest' | 'preserved';

export class AutosaveManager {
  private storage: StorageAdapter;
  private manifest?: GameContentManifest;

  constructor(storage?: StorageAdapter, manifest?: GameContentManifest) {
    this.storage = storage ?? getDefaultStorage();
    this.manifest = manifest;
  }

  /** Namespaced per content pack, so two packs never overwrite each other's autosave. */
  public get autosaveKey(): string {
    return `${this.manifest?.id ?? 'default'}_autosave`;
  }

  /** Where the superseded autosave is kept; see `preserveIfSuperseded`. */
  public get preservedAutosaveKey(): string {
    return `${this.autosaveKey}_preserved`;
  }

  private slotKey(slot: AutosaveSlot): string {
    return slot === 'preserved' ? this.preservedAutosaveKey : this.autosaveKey;
  }

  /**
   * Checks if an autosave should be triggered on this turn (every 50 turns).
   */
  public shouldAutosave(turnCount: number): boolean {
    return turnCount > 0 && turnCount % 50 === 0;
  }

  /**
   * Performs an asynchronous background autosave to persistent storage.
   * Traps quota and serialization errors gracefully without throwing.
   */
  public autosave(engine: GameEngine, profile: CharacterProfile): boolean {
    // A dead player's state is never saved; the last living autosave stays (ARCHITECTURE.md §5).
    if (!engine.player.isAlive()) return false;
    try {
      const saveData = serializeGame(engine, profile);
      const envelope: AutosaveEnvelope = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        contentManifestId: engine.manifest?.id ?? this.manifest?.id ?? 'default',
        timestamp: Date.now(),
        profile: {
          ...profile,
          level: engine.player.level,
          floor: engine.currentFloor,
          hp: engine.player.hp,
          maxHp: engine.player.maxHp,
          mana: engine.player.mana,
          maxMana: engine.player.maxMana,
          xp: engine.player.xp,
          lastSaved: Date.now(),
        },
        data: saveData,
      };

      this.preserveIfSuperseded(envelope.profile);
      this.storage.setItem(this.autosaveKey, JSON.stringify(envelope));
      return true;
    } catch (err) {
      flightRecorder.warn('[AutosaveManager] Failed to record autosave:', { error: String(err) });
      return false;
    }
  }

  /**
   * The autosave is one rolling slot, so a later autosave can bury better progress: another
   * hero's, or the same hero's after retreating upstairs or loading an older save. Before
   * `incoming` replaces the slot, the current autosave moves to the preserved slot when it
   * belongs to a different hero or is deeper than `incoming`. The preserved slot is replaced
   * unless it is the same hero's deeper run. A failure here never blocks the autosave itself.
   */
  private preserveIfSuperseded(incoming: CharacterProfile): void {
    try {
      const raw = this.storage.getItem(this.autosaveKey);
      if (!raw) return;
      const current = (JSON.parse(raw) as AutosaveEnvelope).profile;
      if (!current) return;
      const sameHero = current.id === incoming.id;
      if (sameHero && current.floor <= incoming.floor) return;

      const keptRaw = this.storage.getItem(this.preservedAutosaveKey);
      if (keptRaw) {
        const kept = (JSON.parse(keptRaw) as AutosaveEnvelope).profile;
        if (kept && kept.id === current.id && kept.floor > current.floor) return;
      }
      this.storage.setItem(this.preservedAutosaveKey, raw);
    } catch (err) {
      flightRecorder.warn('[AutosaveManager] Failed to preserve the superseded autosave:', { error: String(err) });
    }
  }

  /**
   * Checks if an autosave payload currently exists in storage.
   */
  public hasAutosave(): boolean {
    try {
      return !!this.storage.getItem(this.autosaveKey);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves summary metadata for the current autosave without full deserialization.
   */
  public getAutosaveMetadata(
    slot: AutosaveSlot = 'latest'
  ): { timestamp: number; profileId?: string; profileName: string; floor: number } | null {
    try {
      const raw = this.storage.getItem(this.slotKey(slot));
      if (!raw) return null;
      const env = JSON.parse(raw) as AutosaveEnvelope;
      return {
        timestamp: env.timestamp,
        profileId: env.profile?.id,
        profileName: env.profile?.name ?? 'Hero',
        floor: env.profile?.floor ?? env.data?.currentFloor ?? 1,
      };
    } catch {
      return null;
    }
  }

  /** Loads an autosave slot, reporting why it failed (ARCHITECTURE.md §5). */
  public loadAutosaveResult(
    activeManifest?: GameContentManifest,
    slot: AutosaveSlot = 'latest'
  ): LoadOutcome<{ engine: GameEngine; profile: CharacterProfile }> {
    try {
      const raw = this.storage.getItem(this.slotKey(slot));
      if (!raw) return MISSING_SAVE;
      const env = JSON.parse(raw) as AutosaveEnvelope;
      if (!env.data || !env.profile) {
        return { ok: false, reason: 'corrupt', message: 'The autosave is damaged and could not be loaded.', detail: 'autosave envelope missing data or profile' };
      }

      let migratedData = env.data;
      if (env.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const migrationResult = defaultMigrator.migrate(env, CURRENT_SCHEMA_VERSION);
        migratedData = migrationResult.envelope.data as SaveData;
      }

      const manifest = activeManifest ?? this.manifest;
      const deserialized = deserializeGame(migratedData, manifest);
      return { ok: true, value: { engine: deserialized.engine, profile: deserialized.profile ?? env.profile } };
    } catch (err) {
      const failure = classifyLoadError(err);
      console.error(`[AutosaveManager] Error loading autosave (${failure.reason}):`, err);
      return failure;
    }
  }

  /** Back-compatible shape: the loaded game, or `null` for any failure. */
  public loadAutosave(activeManifest?: GameContentManifest): { engine: GameEngine; profile: CharacterProfile } | null {
    const outcome = this.loadAutosaveResult(activeManifest);
    return outcome.ok ? outcome.value : null;
  }

  /**
   * Clears both autosave slots.
   */
  public clearAutosave(): void {
    for (const key of [this.autosaveKey, this.preservedAutosaveKey]) {
      try {
        this.storage.removeItem(key);
      } catch {
        // Ignore
      }
    }
  }
}
