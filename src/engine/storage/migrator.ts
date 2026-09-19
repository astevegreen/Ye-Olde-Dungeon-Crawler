import type { SaveData } from './types';
import { compactTiles, compactFov } from './compaction';

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

    // Migration v4 -> v5: Schema v5 evolution (surfaces, substances, and PRNG persistence)
    this.registerMigration(4, 5, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      // 1. Ensure surfaces and substances arrays on active map
      if (data.map) {
        data.map.surfaces = data.map.surfaces ?? [];
        data.map.substances = data.map.substances ?? [];
      }

      // 2. Ensure surfaces and substances arrays on stored maps
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap) {
            fMap.surfaces = fMap.surfaces ?? [];
            fMap.substances = fMap.substances ?? [];
          }
        }
      }

      return {
        schemaVersion: 5,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v5 -> v6: Level-up attribute allocation and floor clear/turn metadata
    this.registerMigration(5, 6, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      // 1. Ensure unspentStatPoints on player
      if (data.player) {
        data.player.unspentStatPoints = data.player.unspentStatPoints ?? 0;
      }

      // 2. Ensure unspentStatPoints on profile
      if (data.profile) {
        data.profile.unspentStatPoints = data.profile.unspentStatPoints ?? 0;
      }

      // 3. Ensure floorTurnCount and isCleared on active map
      if (data.map) {
        data.map.floorTurnCount = data.map.floorTurnCount ?? 0;
        data.map.isCleared = data.map.isCleared ?? false;
      }

      // 4. Ensure floorTurnCount and isCleared on stored maps
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap) {
            fMap.floorTurnCount = fMap.floorTurnCount ?? 0;
            fMap.isCleared = fMap.isCleared ?? false;
          }
        }
      }

      return {
        schemaVersion: 6,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v6 -> v7: Declarative item modifier architecture
    this.registerMigration(6, 7, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      const normalizeItem = (it: any) => {
        if (!it) return;
        if (!Array.isArray(it.modifiers)) {
          it.modifiers = [];
        }
        if (Array.isArray(it.items)) {
          for (const child of it.items) {
            normalizeItem(child);
          }
        }
      };

      // 1. Normalize items in player inventory
      if (data.player?.inventory) {
        if (data.player.inventory.paperdoll) {
          for (const item of Object.values(data.player.inventory.paperdoll) as any[]) {
            normalizeItem(item);
          }
        }
        if (data.player.inventory.primaryPack) {
          normalizeItem(data.player.inventory.primaryPack);
        }
      }

      // 2. Normalize ground items on active map
      if (data.map?.groundItems) {
        for (const tile of data.map.groundItems) {
          if (Array.isArray(tile.items)) {
            for (const item of tile.items) {
              normalizeItem(item);
            }
          }
        }
      }

      // 3. Normalize ground items on stored maps
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (fMap?.groundItems) {
            for (const tile of fMap.groundItems) {
              if (Array.isArray(tile.items)) {
                for (const item of tile.items) {
                  normalizeItem(item);
                }
              }
            }
          }
        }
      }

      return {
        schemaVersion: 7,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v7 -> v8: Enforce scalar ID normalization for item containment (parentId, ownerId)
    this.registerMigration(7, 8, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };
      const playerId = data.player?.id ?? null;

      const normalizeItemTree = (it: any, parentId: string | null, ownerId: string | null) => {
        if (!it || typeof it !== 'object') return;
        // Strip legacy circular references if present
        delete it.parent;
        delete it.container;
        delete it.owner;

        it.parentId = it.parentId ?? parentId;
        it.ownerId = it.ownerId ?? ownerId;

        if (Array.isArray(it.items)) {
          for (const child of it.items) {
            normalizeItemTree(child, it.id, it.ownerId);
          }
        }
      };

      const normalizeInventory = (inv: any, ownerId: string | null) => {
        if (!inv) return;
        if (inv.paperdoll) {
          for (const item of Object.values(inv.paperdoll) as any[]) {
            if (item) {
              normalizeItemTree(item, null, ownerId);
            }
          }
        }
        if (inv.primaryPack) {
          normalizeItemTree(inv.primaryPack, null, ownerId);
        }
      };

      // 1. Normalize items in player inventory
      if (data.player?.inventory) {
        normalizeInventory(data.player.inventory, playerId);
      }

      // 2. Normalize items in monster inventories
      if (Array.isArray(data.map?.monsters)) {
        for (const m of data.map.monsters) {
          if (m?.inventory) {
            normalizeInventory(m.inventory, m.id ?? null);
          }
        }
      }

      // 3. Normalize ground items on active map
      if (data.map?.groundItems) {
        for (const tile of data.map.groundItems) {
          if (Array.isArray(tile.items)) {
            for (const item of tile.items) {
              normalizeItemTree(item, null, null);
            }
          }
        }
      }

      // 4. Normalize stored maps
      if (data.storedMaps) {
        for (const fMap of Object.values(data.storedMaps) as any[]) {
          if (Array.isArray(fMap?.monsters)) {
            for (const m of fMap.monsters) {
              if (m?.inventory) {
                normalizeInventory(m.inventory, m.id ?? null);
              }
            }
          }
          if (fMap?.groundItems) {
            for (const tile of fMap.groundItems) {
              if (Array.isArray(tile.items)) {
                for (const item of tile.items) {
                  normalizeItemTree(item, null, null);
                }
              }
            }
          }
        }
      }

      return {
        schemaVersion: 8,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // Migration v8 -> v9: Companions & Pet Progression (ARCHITECTURE.md P-14) —
    // additive top-level `companion` field, absent/null meaning no companion summoned.
    this.registerMigration(8, 9, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };
      data.companion = data.companion ?? null;

      return {
        schemaVersion: 9,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // v9 -> v10: floors may live in the async tier (ARCHITECTURE.md §5). A v9 save carries
    // every floor inline, so nothing is archived yet; the field just becomes explicit.
    this.registerMigration(9, 10, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };
      data.archivedFloors = data.archivedFloors ?? [];

      return {
        schemaVersion: 10,
        contentManifestId: envelope.contentManifestId ?? 'cotw',
        timestamp: envelope.timestamp ?? Date.now(),
        data,
      };
    });

    // v10 -> v11: Dictionary-based RLE map compaction (tileCodes: string[]) (ARCHITECTURE.md §5, P-03 stage 3).
    // Older builds reject v11 saves as newer-than-engine. Legacy saves and unmigrated BulkArchive
    // floors decode transparently via the backward-compatible legacy tile table fallback.
    this.registerMigration(10, 11, (envelope: VersionedSaveEnvelope<any>): VersionedSaveEnvelope => {
      const data = { ...envelope.data };

      return {
        schemaVersion: 11,
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
