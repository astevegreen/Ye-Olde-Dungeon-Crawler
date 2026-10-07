import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player } from '../../engine';
import { cotwManifest } from '../../content/cotw';
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
    engine = new GameEngine({ map, player, floor: 1, manifest: cotwManifest });
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

describe('Look card markup', () => {
  it('describes the terrain, who stands there and what lies there, escaped and in roles', async () => {
    const { lookCardHtml } = await import('../inspect-overlay');
    const map = GameMap.createBoxRoom(12, 12);
    const player = new Player({ id: 'hero', name: '<Ann>', position: { x: 5, y: 5 }, stats: { hp: 30, maxHp: 40, attack: 5, defense: 1 }, speed: 100 });
    const engine = new GameEngine({ map, player, floor: 1, manifest: cotwManifest });
    engine.updateFov();
    const html = lookCardHtml(engine, {
      x: 5,
      y: 5,
      visibility: 'visible',
      terrain: { name: 'Stone Floor', type: 'floor', passable: true, transparent: true, landmark: 'Runestone <Frost King>' },
      traps: [{ id: 't', name: 'Pit', type: 'pit', revealed: true }],
      entity: { name: '<Ann>', type: 'player', hp: 30, maxHp: 40, speed: 100, speedTier: 'Normal', statusEffects: [] },
      items: [{ id: 'i1', name: 'Rock', category: 'misc', weight: 800, bulk: 100 }],
    });
    expect(html).toContain('&lt;Ann&gt;');
    expect(html).toContain('Passable');
    expect(html).toContain('Landmark: Runestone &lt;Frost King&gt;');
    expect(html).toContain('Trap: Pit');
    expect(html).toContain('width: 75%');
    expect(html).toContain('On the ground (1)');
    expect(html).toContain('In sight');
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });
});
