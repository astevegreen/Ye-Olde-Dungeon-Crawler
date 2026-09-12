import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player } from '../../engine';
import { COTW_MANIFEST } from '../../content/cotw';
import { InspectOverlay } from '../inspect-overlay';

describe('InspectOverlay UI Rendering & Input Interaction', () => {
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
