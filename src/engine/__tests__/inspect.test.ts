import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { cotwManifest } from '../../content/cotw';
import { createTestOgre } from '../__fixtures__/testHelpers';
import { ItemFactory } from '../items/factory';
import { TileInspector } from '../inspect/inspector';
import { TILES } from '../grid/tile';

describe('Look / Inspect Mode & Tile Inspector', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = GameMap.createBoxRoom(30, 30);
    player = new Player({
      id: 'test_hero',
      name: 'Valiant',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      speed: 100,
    });
    engine = new GameEngine({ map, player, floor: 1, manifest: cotwManifest });
    engine.updateFov();
  });

  it('accurately aggregates terrain details without advancing scheduler ticks or energy', () => {
    const initialTicks = engine.turnCount;
    const initialEnergy = engine.player.energy;

    // Set up a closed door at (6, 5)
    engine.map.setTile(6, 5, TILES.DOOR_CLOSED);
    engine.fov.revealTile(6, 5);

    const inspection = TileInspector.inspectTile(engine, 6, 5);
    expect(inspection.visibility).toBe('visible');
    expect(inspection.terrain).not.toBeNull();
    expect(inspection.terrain?.name).toBe('Closed Oak Door');
    expect(inspection.terrain?.passable).toBe(false);

    // Verify 0 scheduler ticks and 0 energy consumed
    expect(engine.turnCount).toBe(initialTicks);
    expect(engine.player.energy).toBe(initialEnergy);
  });

  it('aggregates ground items with weights and bulk volumes', () => {
    const dagger = ItemFactory.createDagger('test-dagger-1');
    const shield = ItemFactory.createWoodenShield('test-shield-1');
    const coins = ItemFactory.createGoldCoins('test-coins-1', 50);

    engine.map.addItemAt(5, 5, dagger);
    engine.map.addItemAt(5, 5, shield);
    engine.map.addItemAt(5, 5, coins);

    const inspection = TileInspector.inspectTile(engine, 5, 5);
    expect(inspection.items).toHaveLength(3);

    const names = inspection.items.map((i) => i.name);
    expect(names).toContain(dagger.displayName);
    expect(names).toContain(shield.displayName);
    expect(names).toContain(coins.displayName);

    const daggerInspection = inspection.items.find((i) => i.id === dagger.id);
    expect(daggerInspection?.weight).toBe(dagger.weight);
    expect(daggerInspection?.bulk).toBe(dagger.bulk);
  });

  it('keeps an unidentified ground item\'s stats, +N and affix to itself until it is identified', () => {
    const sword = ItemFactory.createBroadsword('look-sword');
    sword.enchantmentLevel = 3;
    sword.elementalAffix = { element: 'fire', bonusDamage: 5, name: 'of Fire' };
    engine.map.addItemAt(5, 5, sword);

    const hidden = TileInspector.inspectTile(engine, 5, 5).items.find((i) => i.id === sword.id)!;
    expect(hidden.name).toBe('Unidentified Heavy Sword');
    expect(hidden.stats).toBeUndefined();
    expect(hidden.enchantmentLevel).toBeUndefined();
    expect(hidden.elementalAffix).toBeUndefined();

    sword.identified = true;
    const shown = TileInspector.inspectTile(engine, 5, 5).items.find((i) => i.id === sword.id)!;
    expect(shown.name).toBe('Steel Broadsword +3 of Fire');
    expect(shown.stats?.attackBonus).toBe(8);
    expect(shown.enchantmentLevel).toBe(3);
    expect(shown.elementalAffix?.element).toBe('fire');
  });

  it('inspects living entities with exact HP, speed tier, status effects, and intent', () => {
    const ogre = createTestOgre('test-ogre-inspect', { x: 5, y: 6 });
    ogre.takeDamage(15); // Damaged HP
    ogre.statusManager.applyStatus({ type: 'slow', duration: 3 });
    ogre.intent = {
      type: 'windup',
      targetTile: { x: 5, y: 5 },
      abilityName: 'Crushing Club Slam',
      turnsRemaining: 1,
    };
    engine.addEntity(ogre);

    const inspection = TileInspector.inspectTile(engine, 5, 6);
    expect(inspection.entity).not.toBeNull();
    expect(inspection.entity?.name).toBe(ogre.name);
    expect(inspection.entity?.hp).toBe(35);
    expect(inspection.entity?.maxHp).toBe(50);
    expect(inspection.entity?.speedTier).toBe('Slow'); // 75 speed
    expect(inspection.entity?.statusEffects).toContain('Slow (3 turns)');
    expect(inspection.entity?.intent?.type).toBe('windup');
    expect(inspection.entity?.intent?.abilityName).toBe('Crushing Club Slam');
  });

  it('returns unexplored status for tiles outside explored bounds', () => {
    // Tile (25, 25) is unexplored and out of player FOV
    const inspection = TileInspector.inspectTile(engine, 25, 25);
    expect(inspection.visibility).toBe('unexplored');
    expect(inspection.terrain).toBeNull();
    expect(inspection.entity).toBeNull();
    expect(inspection.items).toHaveLength(0);
  });
});

/**
 * R-dbg-16: Look listed the live ground items of any explored tile, names and weights, though
 * the map draws items only where the hero sees, or as anonymous marks under Detect Objects.
 * So Look saw through Clairvoyance and Detect Objects, and showed what changed while away.
 */
describe('R-dbg-16 · Look names only the items the hero can see', () => {
  function farTile() {
    const map = GameMap.createBoxRoom(40, 12);
    for (let y = 0; y < 12; y++) map.setTile(20, y, TILES.WALL);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player, floor: 1, manifest: cotwManifest });
    engine.updateFov();
    engine.fov.revealAllTiles(); // Clairvoyance: the far side is explored, not seen
    map.addItemAt(30, 5, ItemFactory.createDagger('far-dagger'));
    return engine;
  }

  it('an explored tile out of sight lists no items', () => {
    const inspection = TileInspector.inspectTile(farTile(), 30, 5);
    expect(inspection.visibility).toBe('explored');
    expect(inspection.items).toEqual([]);
  });

  it('under Detect Objects it lists one unnamed something, as the map marks it', () => {
    const engine = farTile();
    engine.detectObjectsTurns = 10;
    const items = TileInspector.inspectTile(engine, 30, 5).items;
    expect(items).toHaveLength(1);
    expect(items[0].name).not.toMatch(/dagger/i);
    expect(items[0].sensed).toBe(true);
  });
});

describe('landmarks: the names a pack gives its tiles reach the player', () => {
  const RUNESTONE = { ...TILES.FLOOR, type: 'test_runestone', name: 'Runestone', landmarkLabel: 'Runestone: Frost King' };
  let engine: GameEngine;

  beforeEach(() => {
    const map = GameMap.createBoxRoom(30, 30);
    const player = new Player({ id: 'hero', name: 'Valiant', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 }, speed: 100 });
    engine = new GameEngine({ map, player, floor: 1, manifest: cotwManifest });
    engine.map.setTile(6, 5, RUNESTONE);
    engine.map.setTile(20, 20, RUNESTONE);
    engine.map.setTile(25, 25, { ...RUNESTONE, landmarkLabel: 'Duergar Barrow' });
    engine.updateFov();
  });

  it('Look names the landmark on its tile', () => {
    engine.fov.revealTile(6, 5);
    expect(TileInspector.inspectTile(engine, 6, 5).terrain?.landmark).toBe('Runestone: Frost King');
    expect(TileInspector.inspectTile(engine, 5, 5).terrain?.landmark).toBeUndefined();
  });

  it('a floor lists each explored landmark once, and none the hero has not found', () => {
    engine.fov.revealTile(6, 5);
    engine.fov.revealTile(20, 20);
    expect(TileInspector.floorLandmarks(engine, 1)).toEqual([{ label: 'Runestone: Frost King', x: 6, y: 5 }]);
    engine.fov.revealTile(25, 25);
    expect(TileInspector.floorLandmarks(engine, 1).map((l) => l.label)).toEqual(['Runestone: Frost King', 'Duergar Barrow']);
    expect(TileInspector.floorLandmarks(engine, 7)).toEqual([]);
  });
});
