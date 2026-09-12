import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, TILES, MovementAction } from '../src/engine';
import { NPC } from '../src/engine/entities/npc';

describe('Door Interaction & Bump Resolution', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      name: 'Alden',
      position: { x: 5, y: 5 },
      strength: 15,
      dexterity: 16,
    });
    engine = new GameEngine({ map, player });
  });

  it('auto-resolves OpenDoorAction when player bumps orthogonally into a closed door', () => {
    // Closed door directly to the East (6, 5)
    map.setTile(6, 5, TILES.DOOR_CLOSED);
    expect(map.getTile(6, 5)?.isClosedDoor).toBe(true);

    const bumpAction = new MovementAction(player, 1, 0);
    const result = engine.handlePlayerAction(bumpAction);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    // Door should now be open
    const targetTile = map.getTile(6, 5);
    expect(targetTile?.isOpenDoor).toBe(true);
    // Player remains at (5, 5) after opening
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);

    // Next step into the now open door moves player onto tile
    const stepAction = new MovementAction(player, 1, 0);
    const stepResult = engine.handlePlayerAction(stepAction);
    expect(stepResult.success).toBe(true);
    expect(player.x).toBe(6);
    expect(player.y).toBe(5);
  });

  it('auto-resolves OpenDoorAction when player bumps diagonally into a closed door', () => {
    // Closed door diagonally to South-East (6, 6)
    map.setTile(6, 6, TILES.DOOR_CLOSED);
    expect(map.getTile(6, 6)?.isClosedDoor).toBe(true);

    const bumpAction = new MovementAction(player, 1, 1);
    const result = engine.handlePlayerAction(bumpAction);

    expect(result.success).toBe(true);
    expect(map.getTile(6, 6)?.isOpenDoor).toBe(true);
    expect(player.x).toBe(5);
    expect(player.y).toBe(5);
  });

  it('auto-resolves door opening when NPCs are in direct line-of-sight', () => {
    // Place a closed door to the North (5, 4)
    map.setTile(5, 4, TILES.DOOR_CLOSED);

    // Place an NPC in clear line of sight to the South (5, 8) and another to the East (9, 5)
    const elder = new NPC({
      id: 'elder-1',
      name: 'Elder Olof',
      role: 'sage',
      position: { x: 5, y: 8 },
    });
    const merchant = new NPC({
      id: 'merchant-1',
      name: 'Torvald',
      role: 'merchant',
      position: { x: 9, y: 5 },
    });
    engine.addEntity(elder);
    engine.addEntity(merchant);

    // Recalculate FOV so NPCs are visible in FOV
    engine.fov.update(map, player.x, player.y, 10);
    expect(engine.fov.isVisible(elder.x, elder.y)).toBe(true);
    expect(engine.fov.isVisible(merchant.x, merchant.y)).toBe(true);

    // Bumping the door must successfully open the door without triggering NPC dialog or failing
    const bumpNorth = new MovementAction(player, 0, -1);
    const result = engine.handlePlayerAction(bumpNorth);

    expect(result.success).toBe(true);
    expect(map.getTile(5, 4)?.isOpenDoor).toBe(true);
    expect(result.message).toContain('opens the door');
  });

  it('handles locked doors gracefully on bump', () => {
    // Closed locked door with high DC
    map.setTile(4, 5, {
      ...TILES.DOOR_CLOSED,
      locked: true,
      lockDifficulty: 99, // Impossible to pick without key
    });

    const bumpWest = new MovementAction(player, -1, 0);
    const result = engine.handlePlayerAction(bumpWest);

    expect(result.success).toBe(false);
    expect(result.message).toContain('locked');
    expect(map.getTile(4, 5)?.locked).toBe(true);
  });
});
