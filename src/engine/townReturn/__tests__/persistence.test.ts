import { describe, it, expect } from 'vitest';
import { compactTiles, decompactTiles } from '../../storage/compaction';
import type { TileType } from '../../types';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { ItemFactory } from '../../items/factory';
import { serializeGame, deserializeGame } from '../../storage/serializer';

describe('Town Return Persistence & Compaction', () => {
  it('compacts and decompacts new shortcut and portal tile types correctly', () => {
    const width = 5;
    const height = 1;
    const row: TileType[] = [
      'runic_conduit',
      'conduit_node',
      'valkyrie_sprint',
      'dwarven_winch',
      'gateway_valhalla',
    ];

    const rle = compactTiles([row]);
    expect(rle).toBe('1R1N1V1X1G');

    const restored = decompactTiles(rle, width, height);
    expect(restored[0]).toEqual(row);
  });

  it('preserves winch hopper cargo and shortcut tiles across save/load round-trip', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    map.setTile(5, 5, TILES.RUNIC_CONDUIT);
    map.setTile(6, 5, TILES.DWARVEN_WINCH);
    map.setTile(7, 5, TILES.GATEWAY_VALHALLA);

    const player = new Player({ position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 7 });

    // Populate winch hopper on Floor 7 with cobblestone ballast
    const winch = engine.townReturnManager.getOrCreateWinch(7, { x: 6, y: 5 });
    const stone = ItemFactory.createScrapCobblestone('ballast-save-test', 3800);
    winch.hopper.addItem(stone);
    expect(winch.getHopperWeight()).toBe(103800);

    // Save
    const mockProfile = {
      id: player.id,
      name: player.name,
      level: 1,
      floor: 7,
      lastSaved: Date.now(),
      hp: player.hp,
      maxHp: player.maxHp,
      strength: player.strength,
    };
    const savedData = serializeGame(engine, mockProfile);

    // Deserialize
    const restored = deserializeGame(savedData);
    expect(restored.engine.currentFloor).toBe(7);

    // Verify map tiles
    expect(restored.engine.map.getTile(5, 5)?.type).toBe('runic_conduit');
    expect(restored.engine.map.getTile(6, 5)?.type).toBe('dwarven_winch');
    expect(restored.engine.map.getTile(7, 5)?.type).toBe('gateway_valhalla');

    // Verify winch hopper state
    const restoredWinch = restored.engine.townReturnManager.getOrCreateWinch(7, { x: 6, y: 5 });
    expect(restoredWinch.getHopperWeight()).toBe(103800);
    expect(restoredWinch.hopper.hasItem('ballast-save-test')).toBe(true);
    expect(restoredWinch.hopper.hasItem('winch-base-counterweight-f7')).toBe(true);
  });
});
