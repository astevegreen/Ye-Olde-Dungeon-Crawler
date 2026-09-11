import { describe, it, expect } from 'vitest';
import { StatusManager } from '../statusManager';
import { Player } from '../../entities/player';
import { createTestSkeleton } from '../../__fixtures__/testHelpers';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';

describe('Status Affliction System', () => {
  function setupEngine() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player });
    return { engine, player, map };
  }

  it('applies and ticks status durations down each turn', () => {
    const mgr = new StatusManager();
    mgr.applyStatus({ type: 'slow', duration: 3 });

    expect(mgr.hasStatus('slow')).toBe(true);
    expect(mgr.getStatus('slow')?.duration).toBe(3);

    const { engine, player } = setupEngine();
    const tick1 = mgr.tick(player, engine);
    expect(tick1.expired).toHaveLength(0);
    expect(mgr.getStatus('slow')?.duration).toBe(2);

    mgr.tick(player, engine);
    expect(mgr.getStatus('slow')?.duration).toBe(1);

    const tick3 = mgr.tick(player, engine);
    expect(tick3.expired).toContain('slow');
    expect(mgr.hasStatus('slow')).toBe(false);
  });

  it('inflicts periodic poison damage and respects immunity', () => {
    const { engine, player } = setupEngine();

    // 1. Player is poisoned for 2 turns with potency 4
    player.statusManager.applyStatus({ type: 'poison', duration: 2, potency: 4 });
    expect(player.statusManager.hasStatus('poison')).toBe(true);
    expect(player.hp).toBe(30);

    const res1 = player.statusManager.tick(player, engine);
    expect(res1.damageTaken).toBe(4);
    expect(player.hp).toBe(26);

    const res2 = player.statusManager.tick(player, engine);
    expect(res2.damageTaken).toBe(4);
    expect(player.hp).toBe(22);
    expect(res2.expired).toContain('poison');
    expect(player.statusManager.hasStatus('poison')).toBe(false);

    // 2. Skeleton is immune to poison
    const skeleton = createTestSkeleton('skel-1', { x: 1, y: 1 });
    const applied = skeleton.statusManager.applyStatus(
      { type: 'poison', duration: 4 },
      skeleton.statusImmunities
    );
    expect(applied).toBe(false);
    expect(skeleton.statusManager.hasStatus('poison')).toBe(false);
  });

  it('modifies action energy costs with slow (1.5x) and haste (0.75x)', () => {
    const { player } = setupEngine();
    const baseCost = 100;

    // Normal cost
    expect(player.getActionCost(baseCost)).toBe(100);

    // Slowed (1.5x)
    player.statusManager.applyStatus({ type: 'slow', duration: 5 });
    expect(player.getActionCost(baseCost)).toBe(150);

    player.statusManager.removeStatus('slow');

    // Hasted (0.75x)
    player.statusManager.applyStatus({ type: 'haste', duration: 5 });
    expect(player.getActionCost(baseCost)).toBe(75);
  });

  it('prevents movement while paralyzed', () => {
    const { player } = setupEngine();
    expect(player.canMove()).toBe(true);

    player.statusManager.applyStatus({ type: 'paralysis', duration: 2 });
    expect(player.canMove()).toBe(false);
  });

  it('reduces field of view radius to 1 when blinded', () => {
    const { engine, player } = setupEngine();
    expect(engine.fovRadius).toBe(8);

    player.statusManager.applyStatus({ type: 'blindness', duration: 3 });
    engine.updateFov();

    // Tile at distance 2 should not be visible under blindness
    expect(engine.fov.isVisible(player.x + 2, player.y)).toBe(false);
    // Immediate neighbor is visible (radius 1)
    expect(engine.fov.isVisible(player.x + 1, player.y)).toBe(true);

    player.statusManager.removeStatus('blindness');
    engine.updateFov();
    expect(engine.fov.isVisible(player.x + 2, player.y)).toBe(true);
  });
});
