import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { TownMapGenerator } from '../../town/townMap';
import { DungeonArc } from '../../quest/dungeonArc';
import { Player } from '../../entities/player';
import { CharacterRoller } from '../../character/characterRoller';
import { serializeGame, deserializeGame } from '../serializer';
import { CURRENT_SCHEMA_VERSION, type VersionedSaveEnvelope } from '../migrator';
import { compactTiles, compactTilesWithDictionary, decompactTiles, compactFov, decompactFov } from '../compaction';
import type { CharacterProfile, SaveData } from '../types';

describe('Storage Payload Compaction & RLE Benchmarking', () => {
  it('correctly compresses and decompresses complex 2D tile patterns with legacy RLE', () => {
    const rawTiles: any[][] = [
      ['wall', 'wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'floor', 'wall'],
      ['wall', 'door_closed', 'floor', 'door_open', 'wall'],
      ['wall', 'stairs_up', 'floor', 'stairs_down', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall'],
    ];

    const rle = compactTiles(rawTiles);
    expect(rle).toBe('6W3F2W1C1F1O2W1U1F1D6W');

    const restored = decompactTiles(rle, 5, 5);
    expect(restored).toEqual(rawTiles);
  });

  it('encodes and decodes tiles with dictionary-based RLE compaction', () => {
    const rawTiles: any[][] = [
      ['wall', 'wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'floor', 'wall'],
      ['wall', 'door_closed', 'floor', 'door_open', 'wall'],
      ['wall', 'stairs_up', 'floor', 'stairs_down', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall'],
    ];

    const { tilesRle, tileCodes } = compactTilesWithDictionary(rawTiles);
    expect(tilesRle).toBe('6:0;3:1;2:0;1:2;1:1;1:3;2:0;1:4;1:1;1:5;6:0;');
    expect(tileCodes).toEqual(['wall', 'floor', 'door_closed', 'door_open', 'stairs_up', 'stairs_down']);

    const restored = decompactTiles(tilesRle, 5, 5, tileCodes);
    expect(restored).toEqual(rawTiles);
  });

  it('compacts custom content tile types without defaulting to wall', () => {
    const rawTiles: any[][] = [
      ['floor', 'crystal_pillar', 'floor'],
      ['magma_vent', 'magma_vent', 'floor'],
    ];

    const { tilesRle, tileCodes } = compactTilesWithDictionary(rawTiles);
    expect(tileCodes).toEqual(['floor', 'crystal_pillar', 'magma_vent']);
    expect(tilesRle).toBe('1:0;1:1;1:0;2:2;1:0;');

    const restored = decompactTiles(tilesRle, 3, 2, tileCodes);
    expect(restored).toEqual(rawTiles);
  });

  it('falls back to legacy decoding when tileCodes is not provided', () => {
    const legacyRle = '6W3F2W1C1F1O2W1U1F1D6W';
    const restored = decompactTiles(legacyRle, 5, 5);
    expect(restored[0]).toEqual(['wall', 'wall', 'wall', 'wall', 'wall']);
    expect(restored[1]).toEqual(['wall', 'floor', 'floor', 'floor', 'wall']);
  });

  it('compacts and decompacts the Gateway to Valhalla victory-portal tile correctly', () => {
    // Regression coverage carried over from the removed townReturn test suite
    // (ARCHITECTURE.md P-03, 2026-09-16): gateway_valhalla is unrelated campaign
    // content and was explicitly kept, but its only RLE round-trip coverage lived
    // in the deleted persistence.test.ts alongside the mechanics that were removed.
    const row: any[] = ['floor', 'gateway_valhalla', 'floor'];
    const rle = compactTiles([row]);
    expect(rle).toBe('1F1G1F');

    const restored = decompactTiles(rle, 3, 1);
    expect(restored[0]).toEqual(row);
  });

  it('correctly compresses and decompresses explored FOV bitstreams', () => {
    const width = 10;
    const height = 10;
    const exploredSet = new Set<string>(['2,2', '2,3', '2,4', '5,5', '5,6']);

    const rle = compactFov(width, height, (x, y) => exploredSet.has(`${x},${y}`));
    const restoredCoords = decompactFov(rle, width, height);

    expect(restoredCoords.length).toBe(exploredSet.size);
    for (const [x, y] of restoredCoords) {
      expect(exploredSet.has(`${x},${y}`)).toBe(true);
    }
  });

  it('keeps multi-floor campaign save state (Town + 5 Dungeon Floors) well under 500 KB (target < 50 KB)', () => {
    // 1. Generate Town (Floor 0)
    const townGen = new TownMapGenerator(50, 30);
    const town = townGen.generate();

    // 2. Initialize Player
    const player = new Player({
      id: 'hero-campaign',
      name: 'Sigurd Dragonbane',
      position: town.playerSpawn,
      stats: { hp: 50, maxHp: 50, attack: 12, defense: 6 },
    });
    CharacterRoller.equipStartingKit(player, 'hero-campaign', undefined, undefined, Math.random);

    const engine = new GameEngine({
      map: town.map,
      player,
      floor: 0,
    });

    // 3. Populate storedFloors with Floors 1 through 5
    for (let f = 1; f <= 5; f++) {
      const dungeon = DungeonArc.generateFloor(f, 1000 + f);
      engine.storedFloors.set(f, dungeon.map);
    }
    expect(engine.storedFloors.size).toBe(6); // Floor 0 + Floors 1-5

    // Explore some FOV
    for (let x = 5; x < 25; x++) {
      for (let y = 5; y < 20; y++) {
        engine.fov.setVisibility(x, y, 2); // Explored
      }
    }

    const profile: CharacterProfile = {
      id: player.id,
      name: player.name,
      level: 4,
      floor: 0,
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
      lastSaved: Date.now(),
    };

    // 4. Serialize to SaveData & Wrap in Envelope
    const saveData = serializeGame(engine, profile);
    const envelope: VersionedSaveEnvelope<SaveData> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      contentManifestId: 'cotw',
      timestamp: Date.now(),
      data: saveData,
    };

    const jsonString = JSON.stringify(envelope);
    const sizeInBytes = new TextEncoder().encode(jsonString).length;
    const sizeInKB = sizeInBytes / 1024;

    console.log(`Campaign Save Payload Size (Town + 5 Floors): ${sizeInKB.toFixed(2)} KB (${sizeInBytes} bytes)`);

    // Must be well under 500 KB (and easily beat the 50 KB target!)
    expect(sizeInKB).toBeLessThan(500);
    expect(sizeInKB).toBeLessThan(50);

    // 5. Verify round-trip deserialization preserves all floors and entities
    const deserialized = deserializeGame(envelope);
    expect(deserialized.engine.storedFloors.size).toBe(6);
    expect(deserialized.engine.storedFloors.has(5)).toBe(true);

    const restoredFloor5 = deserialized.engine.storedFloors.get(5);
    expect(restoredFloor5).toBeDefined();
    expect(restoredFloor5!.width).toBe(44);
    expect(restoredFloor5!.height).toBe(34);

    const restoredFloor4 = deserialized.engine.storedFloors.get(4);
    expect(restoredFloor4).toBeDefined();
    expect(restoredFloor4!.width).toBe(50);
    expect(restoredFloor4!.height).toBe(35);
  });
});
