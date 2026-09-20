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

      this.storage.setItem(this.autosaveKey, JSON.stringify(envelope));
      return true;
    } catch (err) {
      flightRecorder.warn('[AutosaveManager] Failed to record autosave:', { error: String(err) });
      return false;
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
  public getAutosaveMetadata(): { timestamp: number; profileName: string; floor: number } | null {
    try {
      const raw = this.storage.getItem(this.autosaveKey);
      if (!raw) return null;
      const env = JSON.parse(raw) as AutosaveEnvelope;
      return {
        timestamp: env.timestamp,
        profileName: env.profile?.name ?? 'Hero',
        floor: env.profile?.floor ?? env.data?.currentFloor ?? 1,
      };
    } catch {
      return null;
    }
  }

  /**
   * Loads and deserializes the game state from the autosave slot.
   */
  /** Loads the autosave, reporting why it failed (ARCHITECTURE.md §5). */
  public loadAutosaveResult(
    activeManifest?: GameContentManifest
  ): LoadOutcome<{ engine: GameEngine; profile: CharacterProfile }> {
    try {
      const raw = this.storage.getItem(this.autosaveKey);
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
   * Clears the current autosave entry.
   */
  public clearAutosave(): void {
    try {
      this.storage.removeItem(this.autosaveKey);
    } catch {
      // Ignore
    }
  }
}
