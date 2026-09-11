import type { GameEngine } from '../engine';
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
  public static readonly AUTOSAVE_KEY = 'cotw_autosave';
  private storage: StorageAdapter;
  private manifest?: GameContentManifest;

  constructor(storage?: StorageAdapter, manifest?: GameContentManifest) {
    this.storage = storage ?? getDefaultStorage();
    this.manifest = manifest;
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
        contentManifestId: engine.manifest?.id ?? this.manifest?.id ?? 'cotw',
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

      this.storage.setItem(AutosaveManager.AUTOSAVE_KEY, JSON.stringify(envelope));
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
      return !!this.storage.getItem(AutosaveManager.AUTOSAVE_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves summary metadata for the current autosave without full deserialization.
   */
  public getAutosaveMetadata(): { timestamp: number; profileName: string; floor: number } | null {
    try {
      const raw = this.storage.getItem(AutosaveManager.AUTOSAVE_KEY);
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
  public loadAutosave(activeManifest?: GameContentManifest): { engine: GameEngine; profile: CharacterProfile } | null {
    try {
      const raw = this.storage.getItem(AutosaveManager.AUTOSAVE_KEY);
      if (!raw) return null;
      const env = JSON.parse(raw) as AutosaveEnvelope;
      if (!env.data || !env.profile) return null;

      let migratedData = env.data;
      if (env.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const migrationResult = defaultMigrator.migrate(env, CURRENT_SCHEMA_VERSION);
        migratedData = migrationResult.envelope.data as SaveData;
      }

      const manifest = activeManifest ?? this.manifest;
      const deserialized = deserializeGame(migratedData, manifest);
      return { engine: deserialized.engine, profile: deserialized.profile ?? env.profile };
    } catch (err) {
      console.error('[AutosaveManager] Error loading autosave:', err);
      return null;
    }
  }

  /**
   * Clears the current autosave entry.
   */
  public clearAutosave(): void {
    try {
      this.storage.removeItem(AutosaveManager.AUTOSAVE_KEY);
    } catch {
      // Ignore
    }
  }
}
