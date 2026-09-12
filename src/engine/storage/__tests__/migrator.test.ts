import { describe, it, expect } from 'vitest';
import { defaultMigrator, CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../migrator';
import { decompactTiles } from '../compaction';

describe('Schema Migrator & Save State Versioning', () => {
  it('migrates legacy v0 save directly into v2 versioned and compacted envelope', () => {
    // Legacy v0 save: unwrapped SaveData without schemaVersion, containing raw 2D tiles array
    const legacyV0Save: any = {
      version: 1,
      savedAt: 1234567890,
      turnCount: 42,
      messages: ['Welcome adventurer'],
      profile: {
        id: 'hero-old',
        name: 'Olaf Jr',
        level: 2,
        floor: 1,
        hp: 30,
        maxHp: 30,
        strength: 15,
        lastSaved: 1234567890,
      },
      player: {
        id: 'hero-old',
        name: 'Olaf Jr',
        x: 5,
        y: 5,
        hp: 30,
        maxHp: 30,
        baseAttack: 7,
        baseDefense: 3,
        strength: 15,
        speed: 100,
        energy: 0,
        inventory: {
          paperdoll: {},
          primaryPack: {
            id: 'pack-1',
            name: 'Backpack',
            category: 'container',
            containerType: 'pack',
            weight: 1000,
            bulk: 1000,
            maxWeightCapacity: 10000,
            maxBulkCapacity: 10000,
            items: [],
          },
        },
      },
      map: {
        width: 10,
        height: 10,
        tiles: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'floor')),
        groundItems: [],
        monsters: [],
      },
      fovExplored: [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
    };

    const result = defaultMigrator.migrate(legacyV0Save);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.contentManifestId).toBe('cotw');
    expect(result.envelope.timestamp).toBe(1234567890);

    // Verify v2 compaction occurred
    const data = result.envelope.data;
    expect(data.map.tilesRle).toBeDefined();
    expect(data.map.tilesRle).toBe('100F');
    expect(data.fovRle).toBeDefined();

    // Verify decompression restores full tiles
    const decompacted = decompactTiles(data.map.tilesRle!, 10, 10);
    expect(decompacted[0][0]).toBe('floor');
    expect(decompacted[9][9]).toBe('floor');
  });

  it('migrates v1 envelope to v2 compacting tiles and fov', () => {
    const v1Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 1,
      contentManifestId: 'cotw',
      timestamp: 99999,
      data: {
        turnCount: 10,
        profile: { id: 'p1', name: 'Freya', level: 1, floor: 1, hp: 20, maxHp: 20, strength: 12, lastSaved: 99999 },
        player: {
          id: 'p1',
          name: 'Freya',
          x: 2,
          y: 2,
          hp: 20,
          maxHp: 20,
          baseAttack: 5,
          baseDefense: 2,
          strength: 12,
          speed: 100,
          energy: 0,
          inventory: { paperdoll: {}, primaryPack: { id: 'pk', items: [] } },
        },
        map: {
          width: 4,
          height: 4,
          tiles: [
            ['wall', 'wall', 'wall', 'wall'],
            ['wall', 'floor', 'floor', 'wall'],
            ['wall', 'floor', 'floor', 'wall'],
            ['wall', 'wall', 'wall', 'wall'],
          ],
          groundItems: [],
          monsters: [],
        },
        fovExplored: [
          [1, 1],
          [2, 1],
        ],
      },
    };

    const result = defaultMigrator.migrate(v1Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(1);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const data = result.envelope.data as any;
    expect(data.map.tilesRle).toBeDefined();
    expect(data.fovRle).toBeDefined();
    expect(data.map.lastVisitedTick).toBe(0);
    expect(data.worldState.remoteVaults).toEqual({});
  });

  it('migrates v2 envelope to v3 with timestamps, remoteVaults, and item unitWeight', () => {
    const v2Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 2,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        map: {
          width: 4,
          height: 4,
          tilesRle: '16W',
          groundItems: [
            { x: 1, y: 1, items: [{ id: 'gem-1', name: 'Ruby', weight: 50 }] },
          ],
          monsters: [],
        },
        storedMaps: {
          2: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [] },
        },
        player: {
          inventory: {
            paperdoll: {
              mainHand: { id: 'sword-1', name: 'Iron Sword', weight: 1500 },
            },
            primaryPack: {
              id: 'pack-1',
              isContainer: true,
              weight: 500,
              items: [
                { id: 'potion-1', name: 'Healing Potion', weight: 200 },
              ],
            },
          },
        },
        worldState: {
          flags: { talked_to_olaf: true },
          counters: { dungeon_level: 1 },
          factions: { town: 5 },
        },
      },
    };

    const result = defaultMigrator.migrate(v2Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(2);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const data = result.envelope.data as any;
    // Map timestamps initialized
    expect(data.map.lastVisitedTick).toBe(0);
    expect(data.storedMaps[2].lastVisitedTick).toBe(0);

    // remoteVaults initialized
    expect(data.worldState.remoteVaults).toEqual({});

    // Items normalized with unitWeight
    expect(data.player.inventory.paperdoll.mainHand.unitWeight).toBe(1500);
    expect(data.player.inventory.primaryPack.unitWeight).toBe(500);
    expect(data.player.inventory.primaryPack.items[0].unitWeight).toBe(200);
    expect(data.map.groundItems[0].items[0].unitWeight).toBe(50);
  });

  it('migrates v3 envelope to v4 adding default planes, planeId, and corruptionScore', () => {
    const v3Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 3,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        player: { id: 'hero', name: 'Sven', x: 2, y: 3 },
        map: {
          width: 4,
          height: 4,
          tilesRle: '16W',
          groundItems: [],
          monsters: [{ id: 'm1', name: 'Goblin', x: 1, y: 1 }],
          lastVisitedTick: 120,
        },
        storedMaps: {
          2: {
            width: 4,
            height: 4,
            tilesRle: '16W',
            groundItems: [],
            monsters: [{ id: 'm2', name: 'Orc', x: 2, y: 2 }],
          },
        },
        fovRle: '16U',
        worldState: { flags: {}, counters: {}, factions: {}, remoteVaults: {} },
      },
    };

    const result = defaultMigrator.migrate(v3Envelope, 4);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(3);
    expect(result.envelope.schemaVersion).toBe(4);

    const data = result.envelope.data as any;
    // Default planes injected
    expect(data.planes).toBeDefined();
    expect(data.planes.physical).toBeDefined();
    expect(data.planes.physical.id).toBe('physical');
    expect(data.planes.liminal).toBeDefined();
    expect(data.planes.liminal.isLiminal).toBe(true);

    // Player planeId and corruptionScore
    expect(data.player.planeId).toBe('physical');
    expect(data.player.corruptionScore).toBe(0);

    // Monsters planeId
    expect(data.map.monsters[0].planeId).toBe('physical');
    expect(data.storedMaps[2].monsters[0].planeId).toBe('physical');
  });

  it('migrates v4 envelope to v5 ensuring surface and substance arrays', () => {
    const v4Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 4,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        player: { id: 'hero', name: 'Sven', x: 2, y: 3, planeId: 'physical', corruptionScore: 5 },
        map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [], lastVisitedTick: 120 },
        storedMaps: {
          2: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [], lastVisitedTick: 50 },
        },
      },
    };

    const result = defaultMigrator.migrate(v4Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(4);
    expect(result.envelope.schemaVersion).toBe(6);
    expect(result.envelope.data.map.surfaces).toEqual([]);
    expect(result.envelope.data.map.substances).toEqual([]);
    expect(result.envelope.data.storedMaps![2].surfaces).toEqual([]);
    expect(result.envelope.data.storedMaps![2].substances).toEqual([]);
    expect(result.envelope.data.player.unspentStatPoints).toBe(0);
    expect(result.envelope.data.map.floorTurnCount).toBe(0);
    expect(result.envelope.data.map.isCleared).toBe(false);
  });

  it('migrates v5 envelope to v6 adding unspentStatPoints and floor metadata', () => {
    const v5Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 5,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        player: { id: 'hero', name: 'Sven', x: 2, y: 3, planeId: 'physical', corruptionScore: 5 },
        profile: { id: 'sven-prof', name: 'Sven', level: 3 },
        map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [], lastVisitedTick: 120, surfaces: [], substances: [] },
        fovRle: '16U',
        worldState: { flags: {}, counters: {}, factions: {}, remoteVaults: {} },
        planes: {
          physical: { id: 'physical', name: 'Material Plane' },
          liminal: { id: 'liminal', name: 'Liminal Expanse', isLiminal: true },
        },
      },
    };

    const result = defaultMigrator.migrate(v5Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(5);
    expect(result.envelope.schemaVersion).toBe(6);
    expect(result.envelope.data.player.unspentStatPoints).toBe(0);
    expect(result.envelope.data.profile.unspentStatPoints).toBe(0);
    expect(result.envelope.data.map.floorTurnCount).toBe(0);
    expect(result.envelope.data.map.isCleared).toBe(false);
  });

  it('leaves already up-to-date v6 save untouched', () => {
    const v6Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 6,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        player: { id: 'hero', name: 'Sven', x: 2, y: 3, planeId: 'physical', corruptionScore: 5, unspentStatPoints: 4 },
        profile: { id: 'sven-prof', name: 'Sven', level: 3, unspentStatPoints: 4 },
        map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [], lastVisitedTick: 120, surfaces: [], substances: [], floorTurnCount: 15, isCleared: true },
        fovRle: '16U',
        worldState: { flags: {}, counters: {}, factions: {}, remoteVaults: {} },
        planes: {
          physical: { id: 'physical', name: 'Material Plane' },
          liminal: { id: 'liminal', name: 'Liminal Expanse', isLiminal: true },
        },
      },
    };

    const result = defaultMigrator.migrate(v6Envelope);
    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(6);
    expect(result.envelope.schemaVersion).toBe(6);
    expect(result.envelope.data.map.tilesRle).toBe('16W');
    expect(result.envelope.data.map.lastVisitedTick).toBe(120);
    expect(result.envelope.data.player.corruptionScore).toBe(5);
    expect(result.envelope.data.player.unspentStatPoints).toBe(4);
    expect(result.envelope.data.map.floorTurnCount).toBe(15);
    expect(result.envelope.data.map.isCleared).toBe(true);
  });

  it('parses raw JSON string input transparently', () => {
    const rawJson = JSON.stringify({
      schemaVersion: 1,
      contentManifestId: 'cotw',
      timestamp: 55555,
      data: {
        map: { width: 2, height: 2, tiles: [['wall', 'wall'], ['wall', 'wall']], groundItems: [], monsters: [] },
      },
    });

    const result = defaultMigrator.migrate(rawJson);
    expect(result.migrated).toBe(true);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.map.tilesRle).toBe('4W');
    expect(result.envelope.data.map.lastVisitedTick).toBe(0);
    expect(result.envelope.data.planes).toBeDefined();
  });

  it('rejects saves from future schema versions with descriptive error', () => {
    const futureSave = {
      schemaVersion: 99,
      contentManifestId: 'cotw',
      timestamp: Date.now(),
      data: {},
    };

    expect(() => defaultMigrator.migrate(futureSave)).toThrowError(
      `Save payload schema version 99 is newer than engine version ${CURRENT_SCHEMA_VERSION}. Upgrade required.`
    );
  });
});

