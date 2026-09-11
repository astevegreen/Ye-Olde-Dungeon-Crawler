import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { TownPortal, DEFAULT_TOWN_PORTAL_POS } from '../townPortal';
import { RunicConduit } from '../runicConduit';
import { ValkyrieSprintGauntlet } from '../valkyrieSprint';
import { DwarvenWinch } from '../dwarvenWinch';
import { ItemFactory } from '../../items/factory';
import { serializeGame, deserializeGame } from '../../storage/serializer';

describe('TownPortal Two-Way Return Portal', () => {
  function createTestEngine(floor = 0) {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 25, y: 17 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor });
    return { engine, player, map };
  }

  it('manages portal lifecycle correctly (open, ensureSpawned, close)', () => {
    const { map } = createTestEngine(0);
    const portal = new TownPortal();
    expect(portal.active).toBe(false);

    // Opening portal
    portal.open(5, { x: 12, y: 14 });
    expect(portal.active).toBe(true);
    expect(portal.destinationFloor).toBe(5);
    expect(portal.destinationPosition).toEqual({ x: 12, y: 14 });
    expect(portal.townPosition).toEqual(DEFAULT_TOWN_PORTAL_POS);

    // Spawning on map
    portal.ensureSpawnedInTown(map);
    expect(map.getTile(DEFAULT_TOWN_PORTAL_POS.x, DEFAULT_TOWN_PORTAL_POS.y)?.type).toBe('town_portal');

    // Closing
    portal.close();
    expect(portal.active).toBe(false);
  });

  it('teleports player from town back to dungeon depths and consumes portal', () => {
    const { engine, player, map } = createTestEngine(0);
    engine.storedFloors.set(5, new GameMap(30, 30, TILES.FLOOR));
    const portal = engine.townReturnManager.townPortal;
    portal.open(5, { x: 10, y: 10 });
    portal.ensureSpawnedInTown(map);

    expect(map.getTile(DEFAULT_TOWN_PORTAL_POS.x, DEFAULT_TOWN_PORTAL_POS.y)?.type).toBe('town_portal');

    // Use the portal
    const res = portal.teleportToDepths(engine);
    expect(res.success).toBe(true);
    expect(res.floor).toBe(5);
    expect(res.position).toEqual({ x: 10, y: 10 });

    // Portal deactivated and tile cleaned up
    expect(portal.active).toBe(false);
    expect(engine.currentFloor).toBe(5);
    expect(player.x).toBe(10);
    expect(player.y).toBe(10);
    expect(map.getTile(DEFAULT_TOWN_PORTAL_POS.x, DEFAULT_TOWN_PORTAL_POS.y)?.type).toBe('floor');
  });

  it('opens portal upon Runic Conduit (Floor 5) detonation and records recall position', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 10, y: 10 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 5 });
    const conduit = new RunicConduit(5, { x: 10, y: 10 });
    conduit.startRitual(engine);

    // Step on 3 nodes
    for (let i = 0; i < 3; i++) {
      const node = conduit.activeNode!;
      expect(node).toBeDefined();
      conduit.checkNodeStep(engine, node.x, node.y);
      if (i < 2) conduit.advanceTurn(engine);
    }

    // After detonation
    expect(engine.currentFloor).toBe(0);
    expect(player.deepestRecallFloor).toBe(5);
    expect(player.recallPosition).toEqual({ x: 10, y: 10 });
    expect(engine.townReturnManager.townPortal.active).toBe(true);
    expect(engine.townReturnManager.townPortal.destinationFloor).toBe(5);
    expect(engine.townReturnManager.townPortal.destinationPosition).toEqual({ x: 10, y: 10 });
  });

  it('opens portal upon Valkyrie Sprint (Floor 6) completion and records recall position', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 8, y: 8 },
      stats: { hp: 50, maxHp: 50, attack: 6, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 6 });
    const gauntlet = new ValkyrieSprintGauntlet();
    gauntlet.startGauntlet(engine);

    // Complete gauntlet
    gauntlet.completeGauntlet(engine);

    expect(engine.currentFloor).toBe(0);
    expect(player.deepestRecallFloor).toBe(6);
    expect(player.recallPosition).toEqual({ x: 8, y: 8 });
    expect(engine.townReturnManager.townPortal.active).toBe(true);
    expect(engine.townReturnManager.townPortal.destinationFloor).toBe(6);
  });

  it('opens portal upon Dwarven Winch (Floor 7) balanced ascent and records recall position', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({
      position: { x: 6, y: 6 },
      stats: { hp: 80, maxHp: 80, attack: 6, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor: 7 });
    const winch = new DwarvenWinch(7, { x: 6, y: 6 });

    // Load exact target ballast
    const evalRes = winch.evaluateBalance(player);
    winch.hopper.addItem(ItemFactory.createScrapCobblestone('exact-test-ballast', evalRes.targetWeight));

    // Pull lever
    const pullRes = winch.pullLever(engine);
    expect(pullRes.success).toBe(true);
    expect(pullRes.balanced).toBe(true);

    expect(engine.currentFloor).toBe(0);
    expect(player.deepestRecallFloor).toBe(7);
    expect(player.recallPosition).toEqual({ x: 6, y: 6 });
    expect(engine.townReturnManager.townPortal.active).toBe(true);
    expect(engine.townReturnManager.townPortal.destinationFloor).toBe(7);
  });

  it('preserves TownPortal active link and player recall state across save/load', () => {
    const { engine, player } = createTestEngine(0);
    engine.townReturnManager.openTownPortal(6, { x: 14, y: 18 });
    player.deepestRecallFloor = 6;
    player.recallPosition = { x: 14, y: 18 };
    player.tutorialFlags = { conduitSeen: true, sprintSeen: false, winchSeen: true, townPortalSeen: true };

    const mockProfile = {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 0,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    };

    const savedData = serializeGame(engine, mockProfile);
    const restored = deserializeGame(savedData);

    expect(restored.engine.townReturnManager.townPortal.active).toBe(true);
    expect(restored.engine.townReturnManager.townPortal.destinationFloor).toBe(6);
    expect(restored.engine.townReturnManager.townPortal.destinationPosition).toEqual({ x: 14, y: 18 });
    expect(restored.engine.player.deepestRecallFloor).toBe(6);
    expect(restored.engine.player.recallPosition).toEqual({ x: 14, y: 18 });
    expect(restored.engine.player.tutorialFlags.conduitSeen).toBe(true);
    expect(restored.engine.player.tutorialFlags.sprintSeen).toBe(false);
    expect(restored.engine.player.tutorialFlags.townPortalSeen).toBe(true);
  });
});
