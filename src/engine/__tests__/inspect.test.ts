import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { COTW_MANIFEST } from '../../content/cotw';
import { createTestOgre } from '../__fixtures__/testHelpers';
import { ItemFactory } from '../items/factory';
import { TileInspector } from '../inspect/inspector';
import { InspectOverlay } from '../../rendering/inspect-overlay';
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
    engine = new GameEngine({ map, player, floor: 1, manifest: COTW_MANIFEST });
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
    expect(inspection.entity?.statusEffects).toContain('slow (3t)');
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

  it('InspectOverlay navigates within explored bounds and freezes turn energy', () => {
    const overlay = new InspectOverlay();
    overlay.open(engine);

    expect(overlay.isOpen).toBe(true);
    expect(overlay.cursorX).toBe(5);
    expect(overlay.cursorY).toBe(5);

    const startEnergy = engine.player.energy;
    const startTurns = engine.turnCount;

    // Move cursor East (tile 6, 5 is visible)
    overlay.moveCursor(1, 0, engine);
    expect(overlay.cursorX).toBe(6);
    expect(overlay.cursorY).toBe(5);

    // Move cursor into completely unexplored tile (e.g. 0, 0 in default map)
    overlay.cursorX = 1;
    overlay.cursorY = 1;
    // Attempt to move further into darkness
    if (!engine.fov.isExplored(0, 0)) {
      overlay.moveCursor(-1, -1, engine);
      expect(overlay.cursorX).toBe(1);
      expect(overlay.cursorY).toBe(1);
    }

    // Verify engine was never ticked
    expect(engine.player.energy).toBe(startEnergy);
    expect(engine.turnCount).toBe(startTurns);

    overlay.close();
    expect(overlay.isOpen).toBe(false);
  });
});
