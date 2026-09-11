import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameEngine,
  GameMap,
  TILES,
  Player,
  Monster,
  Item,
  serializeGame,
  deserializeGame,
  SchemaMigrator,
  InventoryManager,
  OpenDoorAction,
} from '../src/engine';
import { MouseVectorOverlay } from '../src/rendering/mouseVectorOverlay';
import { Camera } from '../src/rendering/camera';
import { ChordBuffer } from '../src/ui/input/chordBuffer';

describe('Adversarial Audit Remediations Regression Suite', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player });
  });

  it('CD-1: does not register duplicate entities in scheduler upon save reload', () => {
    const monster = new Monster({
      id: 'goblin-1',
      name: 'Goblin',
      position: { x: 7, y: 7 },
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      speed: 100,
    });
    map.addEntity(monster);

    const savedData = serializeGame(engine, {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    });

    const restored = deserializeGame(savedData);
    const livingEntities = restored.engine.scheduler.getEntities().filter((e) => e.isAlive());
    const goblinRefs = livingEntities.filter((e) => e.id === 'goblin-1');

    // Should only be registered exactly once, not duplicated
    expect(goblinRefs.length).toBe(1);
  });

  it('CD-2: fails fast when envelope has no valid numeric schemaVersion', () => {
    const migrator = new SchemaMigrator();
    const invalidEnvelope = {
      version: 'invalid',
      timestamp: Date.now(),
      data: { player: {} },
    };

    expect(() => {
      migrator.migrate(invalidEnvelope);
    }).toThrow(/envelope structure detected/i);
  });

  it('CD-3: validates structural integrity before deserialization', () => {
    expect(() => deserializeGame(null as any)).toThrow(/structurally invalid/i);
    expect(() => deserializeGame({} as any)).toThrow(/map/i);
    expect(() =>
      deserializeGame({ map: { width: 10, height: 10, tiles: [] } } as any)
    ).toThrow(/player/i);
    expect(() =>
      deserializeGame({ map: { width: 10, height: 10, tiles: [] }, player: {} } as any)
    ).toThrow(/inventory/i);
  });

  it('CD-6: prevents silent item deletion when pack cannot hold displaced equipment on equip', () => {
    const invManager = new InventoryManager();
    // Create an armor item and equip it
    const heavyPlate = new Item({
      id: 'plate-1',
      name: 'Plate Mail',
      category: 'armor',
      slot: 'torso',
      weight: 20000,
      bulk: 5000,
    });
    invManager.primaryPack.addItem(heavyPlate);
    invManager.equipFromPack('plate-1');
    expect(invManager.paperdoll.getItem('torso')?.id).toBe('plate-1');

    // Create a leather armor in pack to swap with
    const leatherArmor = new Item({
      id: 'leather-1',
      name: 'Leather Armor',
      category: 'armor',
      slot: 'torso',
      weight: 2000,
      bulk: 1000,
    });
    invManager.primaryPack.addItem(leatherArmor);

    // Mock pack capacity so it cannot hold the heavy plate being displaced
    const initialContained = invManager.primaryPack.containedWeight();
    (invManager.primaryPack as any).maxWeightCapacity = initialContained + 1; // Not enough room for plate

    const result = invManager.equipFromPack('leather-1');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/weight limit exceeded/i);
    // Heavy plate must remain safely equipped, leather must remain in pack
    expect(invManager.paperdoll.getItem('torso')?.id).toBe('plate-1');
    expect(invManager.primaryPack.hasItem('leather-1')).toBe(true);
  });

  it('HR-1: gracefully handles ground item piles with null or sparse entries', () => {
    const savedData = serializeGame(engine, {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    });

    // Inject corrupted sparse / null item entry into ground items
    savedData.map.groundItems = [
      {
        x: 5,
        y: 6,
        items: [null as any, undefined as any],
      },
    ];

    expect(() => {
      const restored = deserializeGame(savedData);
      expect(restored.engine.map.getItemsAt(5, 6).length).toBe(0);
    }).not.toThrow();
  });

  it('HR-2: coerces non-numeric stats to defaults and prevents NaN poisoning', () => {
    const savedData = serializeGame(engine, {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    });

    // Inject NaN / invalid string into player stats
    (savedData.player as any).hp = 'corrupt_nan';
    (savedData.player as any).maxHp = NaN;
    (savedData.player as any).energy = undefined;
    (savedData.player as any).speed = null;

    const restored = deserializeGame(savedData);
    expect(Number.isFinite(restored.engine.player.hp)).toBe(true);
    expect(restored.engine.player.hp).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(restored.engine.player.maxHp)).toBe(true);
    expect(restored.engine.player.maxHp).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(restored.engine.player.energy)).toBe(true);
    expect(Number.isFinite(restored.engine.player.speed)).toBe(true);
  });

  it('GE-3: MouseVectorOverlay clicks on adjacent closed doors open them instead of moving', () => {
    const overlay = new MouseVectorOverlay();
    const camera = new Camera();

    // Place closed door immediately north of player at (5, 4)
    map.setTile(5, 4, TILES.DOOR_CLOSED);

    // Calculate virtual coords for tile (5, 4)
    const cellSize = 32;
    const screenPos = camera.worldToScreen(5, 4, cellSize, 0, 0);
    expect(screenPos).not.toBeNull();

    const result = overlay.handleClick(screenPos!.x + 16, screenPos!.y + 16, engine, camera, cellSize, 0, 0, true);
    expect(result.handled).toBe(true);
    expect(result.action).toBeInstanceOf(OpenDoorAction);
  });

  it('GE-6: ChordBuffer immediate 180-degree reversal prioritizes the latest key', () => {
    let resolvedDirection: { dx: number; dy: number } | null = null;
    const buffer = new ChordBuffer({
      onMove: (dx, dy) => {
        resolvedDirection = { dx, dy };
      },
      getBufferMs: () => 40,
    });

    // Press right, then quickly press left
    buffer.handleKeyDown('ArrowRight');
    buffer.handleKeyDown('ArrowLeft');

    // Should resolve left, prioritizing the reversal key
    buffer.flush();
    expect(resolvedDirection).toEqual({ dx: -1, dy: 0 });

    buffer.destroy();
  });
});
