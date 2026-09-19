import { describe, it, expect } from 'vitest';
import { defaultMigrator, CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../migrator';
import { decompactTiles } from '../compaction';
import { deserializeMapObject } from '../serializer';
import type { SerializedMap } from '../types';
import { COTW_TILES } from '../../../content/cotw';

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
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
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
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.player.unspentStatPoints).toBe(0);
    expect(result.envelope.data.profile.unspentStatPoints).toBe(0);
    expect(result.envelope.data.map.floorTurnCount).toBe(0);
    expect(result.envelope.data.map.isCleared).toBe(false);
  });

  it('migrates v6 envelope to v7 normalizing item modifiers', () => {
    const v6Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 6,
      contentManifestId: 'cotw',
      timestamp: 100000,
      data: {
        player: {
          id: 'hero',
          name: 'Sven',
          x: 2,
          y: 3,
          inventory: {
            paperdoll: {
              mainHand: { id: 'w1', name: 'Broadsword', category: 'weapon' },
            },
            primaryPack: {
              id: 'p1',
              name: 'Pack',
              category: 'container',
              items: [{ id: 'a1', name: 'Shield', category: 'shield' }],
            },
          },
        },
        map: {
          width: 4,
          height: 4,
          tilesRle: '16W',
          groundItems: [{ x: 1, y: 1, items: [{ id: 'g1', name: 'Helm', category: 'helmet' }] }],
          monsters: [],
        },
      },
    };

    const result = defaultMigrator.migrate(v6Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(6);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.player.inventory.paperdoll.mainHand!.modifiers).toEqual([]);
    expect(result.envelope.data.player.inventory.primaryPack.items[0].modifiers).toEqual([]);
    expect(result.envelope.data.map.groundItems[0].items[0].modifiers).toEqual([]);
  });

  it('migrates v7 save to v8 by normalizing item parentId, ownerId, and stripping legacy parent references', () => {
    const v7Save: VersionedSaveEnvelope<any> = {
      schemaVersion: 7,
      contentManifestId: 'cotw',
      timestamp: 99999,
      data: {
        player: {
          id: 'player-1',
          inventory: {
            paperdoll: {
              mainHand: { id: 'sword-1', name: 'Iron Sword', parent: { id: 'circular' } },
            },
            primaryPack: {
              id: 'backpack-1',
              name: 'Backpack',
              items: [
                {
                  id: 'pouch-1',
                  name: 'Pouch',
                  items: [
                    { id: 'gem-1', name: 'Ruby', parent: { id: 'circular-pouch' } },
                  ],
                },
              ],
            },
          },
        },
        map: {
          groundItems: [
            {
              x: 2,
              y: 3,
              items: [
                { id: 'potion-1', name: 'Healing Potion' },
                {
                  id: 'chest-1',
                  name: 'Chest',
                  items: [
                    { id: 'gold-1', name: 'Gold Coin' },
                  ],
                },
              ],
            },
          ],
        },
      },
    };

    // Pin targetVersion to 8 to isolate this step's own behavior from later
    // migrations (e.g. v8->v9's companion field) added since this test was written.
    const result = defaultMigrator.migrate(v7Save, 8);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(7);
    expect(result.envelope.schemaVersion).toBe(8);

    // Player inventory items
    const sword = result.envelope.data.player.inventory.paperdoll.mainHand as any;
    expect(sword.parentId).toBeNull();
    expect(sword.ownerId).toBe('player-1');
    expect(sword.parent).toBeUndefined();

    const pack = result.envelope.data.player.inventory.primaryPack as any;
    expect(pack.parentId).toBeNull();
    expect(pack.ownerId).toBe('player-1');

    const pouch = pack.items[0] as any;
    expect(pouch.parentId).toBe('backpack-1');
    expect(pouch.ownerId).toBe('player-1');

    const ruby = pouch.items[0] as any;
    expect(ruby.parentId).toBe('pouch-1');
    expect(ruby.ownerId).toBe('player-1');
    expect(ruby.parent).toBeUndefined();

    // Ground items
    const groundPotion = result.envelope.data.map.groundItems[0].items[0] as any;
    expect(groundPotion.parentId).toBeNull();
    expect(groundPotion.ownerId).toBeNull();

    const groundChest = result.envelope.data.map.groundItems[0].items[1] as any;
    expect(groundChest.parentId).toBeNull();
    expect(groundChest.ownerId).toBeNull();

    const groundGold = groundChest.items[0] as any;
    expect(groundGold.parentId).toBe('chest-1');
    expect(groundGold.ownerId).toBeNull();
  });

  it('migrates v8 save to v9 by defaulting the new companion field to null (ARCHITECTURE.md P-14)', () => {
    const v8Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 8,
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

    const result = defaultMigrator.migrate(v8Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(8);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.companion).toBeNull();
    // Everything else from the v7->v8 step onward is untouched
    expect(result.envelope.data.map.tilesRle).toBe('16W');
    expect(result.envelope.data.map.lastVisitedTick).toBe(120);
    expect(result.envelope.data.player.corruptionScore).toBe(5);
    expect(result.envelope.data.player.unspentStatPoints).toBe(4);
    expect(result.envelope.data.map.floorTurnCount).toBe(15);
    expect(result.envelope.data.map.isCleared).toBe(true);
  });

  it('migrates a v9 save with a companion to v10, preserving the companion', () => {
    const v9Envelope: VersionedSaveEnvelope<any> = {
      schemaVersion: 9,
      contentManifestId: 'cotw',
      timestamp: 100001,
      data: {
        player: { id: 'hero', name: 'Sven' },
        map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [] },
        companion: { id: 'companion-1', name: 'Fenrir-kin Battle-Hound', companionDefinitionId: 'battle_hound', x: 3, y: 3, hp: 20, maxHp: 30, attack: 6, defense: 2, speed: 110, energy: 0, primaryPack: { id: 'pack-1', name: 'Pack', items: [] } },
      },
    };

    const result = defaultMigrator.migrate(v9Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(9);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // v9 saves carry every floor inline, so nothing is archived yet (ARCHITECTURE.md §5).
    expect(result.envelope.data.archivedFloors).toEqual([]);
    expect(result.envelope.data.companion!.id).toBe('companion-1');
    expect(result.envelope.data.companion!.hp).toBe(20);
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

  it('migrates v10 save payload forward to CURRENT_SCHEMA_VERSION', () => {
    const v10Envelope = {
      schemaVersion: 10,
      contentManifestId: 'cotw',
      timestamp: 123456789,
      data: {
        player: { id: 'hero', name: 'Sven' },
        map: { width: 4, height: 4, tilesRle: '16W', groundItems: [], monsters: [] },
        archivedFloors: [1, 2],
      },
    };

    const result = defaultMigrator.migrate(v10Envelope);
    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(10);
    expect(result.envelope.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.envelope.data.archivedFloors).toEqual([1, 2]);
  });

  it('loads legacy v10 save containing G/Y codes with definitions supplied by content', () => {
    // In legacy format (v10), 'G' is gateway_valhalla and 'Y' is altar_tyr
    const legacyRle = '1G1Y2F';
    const tileGrid = decompactTiles(legacyRle, 2, 2);
    expect(tileGrid[0][0]).toBe('gateway_valhalla');
    expect(tileGrid[0][1]).toBe('altar_tyr');
    expect(tileGrid[1][0]).toBe('floor');
    expect(tileGrid[1][1]).toBe('floor');
  });

  it('deserializes an archived floor without tileCodes via legacy fallback', () => {
    const archivedMap: SerializedMap = {
      width: 2,
      height: 2,
      tilesRle: '1G1Y2F',
      groundItems: [],
      monsters: [],
    };
    const map = deserializeMapObject(archivedMap, COTW_TILES);
    expect(map.getTile(0, 0)?.type).toBe('gateway_valhalla');
    expect(map.getTile(1, 0)?.type).toBe('altar_tyr');
    expect(map.getTile(0, 1)?.type).toBe('floor');
    expect(map.getTile(1, 1)?.type).toBe('floor');
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

