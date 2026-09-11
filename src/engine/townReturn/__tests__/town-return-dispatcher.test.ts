import { describe, it, expect } from 'vitest';
import { TownReturnDispatcher } from '../../dungeon/townReturnDispatcher';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';

describe('TownReturnDispatcher', () => {
  it('suppresses shortcuts for floors 1 through 4', () => {
    expect(TownReturnDispatcher.getShortcutTypeForFloor(1, 25)).toBeNull();
    expect(TownReturnDispatcher.getShortcutTypeForFloor(2, 25)).toBeNull();
    expect(TownReturnDispatcher.getShortcutTypeForFloor(3, 25)).toBeNull();
    expect(TownReturnDispatcher.getShortcutTypeForFloor(4, 25)).toBeNull();
  });

  it('cycles shortcuts across floor depths using the 3-tier modulo sequence', () => {
    // Floor 5: (5-5)%3 = 0 -> runic_conduit
    expect(TownReturnDispatcher.getShortcutTypeForFloor(5, 25)).toBe('runic_conduit');
    // Floor 6: (6-5)%3 = 1 -> valkyrie_sprint
    expect(TownReturnDispatcher.getShortcutTypeForFloor(6, 25)).toBe('valkyrie_sprint');
    // Floor 7: (7-5)%3 = 2 -> dwarven_winch
    expect(TownReturnDispatcher.getShortcutTypeForFloor(7, 25)).toBe('dwarven_winch');
    // Floor 8: (8-5)%3 = 0 -> runic_conduit
    expect(TownReturnDispatcher.getShortcutTypeForFloor(8, 25)).toBe('runic_conduit');
    // Floor 9: (9-5)%3 = 1 -> valkyrie_sprint
    expect(TownReturnDispatcher.getShortcutTypeForFloor(9, 25)).toBe('valkyrie_sprint');
    // Floor 10: (10-5)%3 = 2 -> dwarven_winch
    expect(TownReturnDispatcher.getShortcutTypeForFloor(10, 25)).toBe('dwarven_winch');
    // Floor 11: (11-5)%3 = 0 -> runic_conduit
    expect(TownReturnDispatcher.getShortcutTypeForFloor(11, 25)).toBe('runic_conduit');
  });

  it('suppresses standard 3-tier shortcuts on maxFloor (boss lair)', () => {
    expect(TownReturnDispatcher.getShortcutTypeForFloor(25, 25)).toBeNull();
    expect(TownReturnDispatcher.getShortcutTypeForFloor(37, 37)).toBeNull();
    expect(TownReturnDispatcher.getShortcutTypeForFloor(50, 50)).toBeNull();
  });

  it('spawns fixture tile and ballast items for Dwarven Winch on Floor 7', () => {
    const map = new GameMap(30, 30, TILES.WALL);
    // Carve main room and secondary room
    for (let y = 5; y <= 10; y++) {
      for (let x = 5; x <= 10; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }
    for (let y = 15; y <= 20; y++) {
      for (let x = 15; x <= 20; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    const rooms = [
      { id: 'room-1', x1: 5, y1: 5, x2: 10, y2: 10, width: 6, height: 6, centerX: 7, centerY: 7 },
      { id: 'room-2', x1: 15, y1: 15, x2: 20, y2: 20, width: 6, height: 6, centerX: 17, centerY: 17 },
    ];

    const playerSpawn = { x: 7, y: 7 };
    const stairsDown = { x: 8, y: 8 };

    const fixture = TownReturnDispatcher.spawnShortcutFixture(map, 7, 25, rooms, playerSpawn, stairsDown);
    expect(fixture).not.toBeNull();
    expect(fixture?.type).toBe('dwarven_winch');

    const tile = map.getTile(fixture!.position.x, fixture!.position.y);
    expect(tile?.type).toBe('dwarven_winch');

    // Verify ballast cobblestones were spawned nearby
    const groundItems = map.getAllGroundItems();
    expect(groundItems.length).toBeGreaterThan(0);
    const hasBallast = groundItems.some((pile) =>
      pile.items.some((i) => i.name.includes('Cobblestone Ballast'))
    );
    expect(hasBallast).toBe(true);
  });
});
