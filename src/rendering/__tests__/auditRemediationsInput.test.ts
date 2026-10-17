import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, TILES, Player, OpenDoorAction } from '../../engine';
import { MouseVectorOverlay } from '../mouseVectorOverlay';
import { Camera } from '../camera';
import { ChordBuffer } from '../../ui/input/chordBuffer';

describe('Adversarial Audit Remediations: input', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map, player });
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
