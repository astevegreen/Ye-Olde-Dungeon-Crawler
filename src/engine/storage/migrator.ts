import type { SaveData } from './types';

/**
 * Current save format, and also the oldest one this engine can read. The v0 -> v11
 * step chain was removed pre-launch, when no save predating v11 existed outside
 * development; an older payload is rejected by `migrate()` rather than silently
 * mis-decoded. Every future format change still adds exactly one forward-only
 * step and increments this (ARCHITECTURE.md §5).
 */
export const CURRENT_SCHEMA_VERSION = 11;

export interface VersionedSaveEnvelope<T = SaveData> {
  schemaVersion: number;
  contentManifestId: string;
  timestamp: number;
  data: T;
}

export type MigrationFunction = (input: any) => any;

export class SchemaMigrator {
  private migrations = new Map<string, MigrationFunction>();

  public registerMigration(fromVersion: number, toVersion: number, fn: MigrationFunction): void {
    const key = `${fromVersion}->${toVersion}`;
    this.migrations.set(key, fn);
  }

  /**
   * Inspects a save payload (JSON string or object), detects its schema version,
   * and runs sequential migrations until it reaches the targetVersion.
   */
  public migrate(
    rawInput: string | unknown,
    targetVersion = CURRENT_SCHEMA_VERSION
  ): { envelope: VersionedSaveEnvelope; migrated: boolean; fromVersion: number } {
    let currentObj: any;

    if (typeof rawInput === 'string') {
      try {
        currentObj = JSON.parse(rawInput);
      } catch (err) {
        throw new Error(`Failed to parse save JSON: ${(err as Error).message}`);
      }
    } else if (rawInput && typeof rawInput === 'object') {
      currentObj = { ...rawInput };
    } else {
      throw new Error('Invalid save payload: expected object or JSON string.');
    }

    // Detect version: if missing schemaVersion, treat as legacy v0 unless it has envelope shape
    let currentVersion = 0;
    if (typeof currentObj.schemaVersion === 'number') {
      currentVersion = currentObj.schemaVersion;
    } else if (currentObj.data && currentObj.timestamp) {
      throw new Error(
        'Save corrupted: envelope structure detected but schemaVersion is missing or non-numeric.'
      );
    }

    if (currentVersion > targetVersion) {
      throw new Error(
        `Save payload schema version ${currentVersion} is newer than engine version ${targetVersion}. Upgrade required.`
      );
    }

    const fromVersion = currentVersion;
    let migrated = false;

    // Run sequential step-by-step migrations
    while (currentVersion < targetVersion) {
      const nextVersion = currentVersion + 1;
      const key = `${currentVersion}->${nextVersion}`;
      const migrationFn = this.migrations.get(key);

      if (!migrationFn) {
        throw new Error(`Missing migration function for upgrade ${key}`);
      }

      try {
        currentObj = migrationFn(currentObj);
      } catch (err) {
        throw new Error(
          `Schema migration ${key} failed: ${(err as Error).message}. Save may be partially or fully unrecoverable.`
        );
      }
      currentVersion = nextVersion;
      migrated = true;
    }

    return {
      envelope: currentObj as VersionedSaveEnvelope,
      migrated,
      fromVersion,
    };
  }
}

export const defaultMigrator = new SchemaMigrator();
