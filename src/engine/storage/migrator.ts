import type { SaveData } from './types';
import { compactTiles, compactFov } from './compaction';

export const CURRENT_SCHEMA_VERSION = 4;

export interface VersionedSaveEnvelope<T = SaveData> {
  schemaVersion: number;
  contentManifestId: string;
  timestamp: number;
  data: T;
}

export type MigrationFunction = (input: any) => any;

export class SchemaMigrator {
  private migrations = new Map<string, MigrationFunction>();

  constructor() {
    this.registerCoreMigrations();
  }

  public registerMigration(fromVersion: number, toVersion: number, fn: MigrationFunction): void {
    const key = `${fromVersion}->${toVersion}`;
    this.migrations.set(key, fn);
  }

  private registerCoreMigrations(): void {
    // Migration v0 -> v1: Wrap legacy raw save object in VersionedSaveEnvelope
    this.registerMigration(0, 1, (raw: any): VersionedSaveEnvelope => {
      const data = raw.data ?? raw;
      const contentManifestId = raw.contentManifestId ?? 'cotw';
      const timestamp = raw.timestamp ?? data.savedAt ?? Date.now();

      return {
        schemaVersion: 1,
        contentManifestId,
        timestamp,
        data,
      };
    });

    // Migration v1 -> v2: Compact map tiles and FOV coordinates with RLE compression
    this.registerMigration(1, 2, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      // Compact active map if tiles array is present
      if (data.map && Array.isArray(data.map.tiles) && !data.map.tilesRle) {
        data.map = {
          ...data.map,
          tilesRle: compactTiles(data.map.tiles),
        };
      }

      // Compact stored maps for other floors
      if (data.storedMaps) {
        const compactedStored: Record<number, any> = {};
        for (const [floorStr, fMap] of Object.entries(data.storedMaps) as [string, any][]) {
          const floorNum = parseInt(floorStr, 10);
          if (Array.isArray(fMap.tiles) && !fMap.tilesRle) {
            compactedStored[floorNum] = {
              ...fMap,
              tilesRle: compactTiles(fMap.tiles),
            };
          } else {
            compactedStored[floorNum] = fMap;
          }
        }
        data.storedMaps = compactedStored;
      }

      // Compact FOV if explored coordinates array is present
      if (Array.isArray(data.fovExplored) && !data.fovRle && data.map) {
        const exploredSet = new Set(data.fovExplored.map(([x, y]: [number, number]) => `${x},${y}`));
        data.fovRle = compactFov(data.map.width, data.map.height, (x, y) =>
          exploredSet.has(`${x},${y}`)
        );
      }

      return {
        schemaVersion: 2,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v2 -> v3: Schema v3 evolution (timestamps, vaults, item durability/aspect/unitWeight, actor morph)
    this.registerMigration(2, 3, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      // 1. Add lastVisitedTick to active map and all stored maps
      if (data.map) {
        data.map.lastVisitedTick = data.map.lastVisitedTick ?? 0;
      }
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap) {
            fMap.lastVisitedTick = fMap.lastVisitedTick ?? 0;
          }
        }
      }

      // 2. Add remoteVaults to worldState
      if (!data.worldState) {
        data.worldState = { flags: {}, counters: {}, factions: {}, remoteVaults: {} };
      } else if (!data.worldState.remoteVaults) {
        data.worldState.remoteVaults = {};
      }

      // 3. Normalizer helper for item nodes
      const normalizeItemNode = (item: any): any => {
        if (!item) return item;
        item.unitWeight = item.unitWeight ?? item.weight ?? 0;
        if (item.isContainer && Array.isArray(item.items)) {
          item.items = item.items.map(normalizeItemNode);
        }
        return item;
      };

      // 4. Update items in player inventory
      if (data.player?.inventory) {
        const inv = data.player.inventory;
        if (inv.paperdoll) {
          for (const [slot, item] of Object.entries(inv.paperdoll)) {
            if (item) {
              inv.paperdoll[slot] = normalizeItemNode(item);
            }
          }
        }
        if (inv.primaryPack) {
          inv.primaryPack = normalizeItemNode(inv.primaryPack);
        }
      }

      // 5. Update ground items in active map
      if (data.map && Array.isArray(data.map.groundItems)) {
        for (const pile of data.map.groundItems) {
          if (Array.isArray(pile.items)) {
            pile.items = pile.items.map(normalizeItemNode);
          }
        }
      }

      // 6. Update ground items in stored maps
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap && Array.isArray(fMap.groundItems)) {
            for (const pile of fMap.groundItems) {
              if (Array.isArray(pile.items)) {
                pile.items = pile.items.map(normalizeItemNode);
              }
            }
          }
        }
      }

      return {
        schemaVersion: 3,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v3 -> v4: Schema v4 evolution (planes, planeId, corruptionScore)
    this.registerMigration(3, 4, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      // 1. Initialize default planes if not present
      if (!data.planes) {
        data.planes = {
          physical: { id: 'physical', name: 'Material Plane', isLiminal: false },
          liminal: {
            id: 'liminal',
            name: 'Liminal Expanse',
            isLiminal: true,
            driftVector: { dx: 1, dy: 0, intervalTicks: 5 },
          },
        };
      }

      // 2. Set player planeId and corruptionScore
      if (data.player) {
        data.player.planeId = data.player.planeId ?? 'physical';
        data.player.corruptionScore = data.player.corruptionScore ?? 0;
      }

      // 3. Set planeId on active map monsters
      if (data.map && Array.isArray(data.map.monsters)) {
        for (const m of data.map.monsters) {
          if (m) {
            m.planeId = m.planeId ?? 'physical';
          }
        }
      }

      // 4. Set planeId on stored map monsters
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap && Array.isArray(fMap.monsters)) {
            for (const m of fMap.monsters) {
              if (m) {
                m.planeId = m.planeId ?? 'physical';
              }
            }
          }
        }
      }

      return {
        schemaVersion: 4,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });
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
