import { describe, it, expect, beforeEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Entity } from '../../entities/entity';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import {
  registerReciprocalPrimitives,
  executeReciprocalAction,
} from '../reciprocalPipeline';

describe('Reciprocal Ability Pipeline & Symmetrical Recoil', () => {
  let map: GameMap;
  let player: Player;
  let monster: Entity;
  let engine: GameEngine;

  beforeEach(() => {
    map = new GameMap(12, 12, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      intelligence: 10,
    });
    monster = new Entity({
      id: 'foe',
      name: 'Foe',
      type: 'monster',
      faction: 'hostile',
      position: { x: 6, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 4, defense: 1 },
    });
    map.addEntity(player);
    map.addEntity(monster);
    engine = new GameEngine({ map, player });
    registerReciprocalPrimitives();
  });

  it('displaces target across planes and casts initiator backward in reciprocal_plane_shift', () => {
    // Player at (5, 5), Monster at (6, 5). Target is shifted to liminal.
    // Recoil direction from monster is -1 (west), so player pushed backward to (4, 5).
    const actionResult = executeReciprocalAction(
      player,
      monster,
      [{ type: 'reciprocal_plane_shift', targetPlaneId: 'liminal', recoilDistance: 1 }],
      engine
    );

    expect(actionResult.success).toBe(true);
    expect(monster.planeId).toBe('liminal');
    expect(player.planeId).toBe('physical');
    expect(player.x).toBe(4);
    expect(player.y).toBe(5);
  });

  it('compels target locomotion and reverses vector onto caster on probabilistic failure', () => {
    // Case 1: 0% failure chance -> target moves toward (8, 5)
    executeReciprocalAction(
      player,
      monster,
      [{ type: 'forced_locomotion', targetPos: { x: 8, y: 5 }, failureChance: 0 }],
      engine
    );
    expect(monster.x).toBe(7); // Moved east toward (8, 5)
    expect(player.x).toBe(5); // Caster unmoved

    // Case 2: 100% failure chance -> vector reverses onto caster!
    executeReciprocalAction(
      player,
      monster,
      [{ type: 'forced_locomotion', targetPos: { x: 8, y: 5 }, failureChance: 1.0 }],
      engine
    );
    expect(player.x).toBe(6); // Caster was forced east toward (8, 5)
  });

  it('casts both target and initiator outward in mutual_banishment', () => {
    // Reset positions: player at (5, 5), monster at (7, 5)
    map.removeEntity(player);
    map.removeEntity(monster);
    player.setPosition(5, 5);
    monster.setPosition(7, 5);
    map.addEntity(player);
    map.addEntity(monster);

    executeReciprocalAction(
      player,
      monster,
      [{ type: 'mutual_banishment', distance: 2 }],
      engine
    );

    // Midpoint is around x=6. Monster pushed east (+2) -> (9, 5). Player pushed west (-2) -> (3, 5).
    expect(monster.x).toBe(9);
    expect(player.x).toBe(3);
  });

  it('applies status condition to target and somatic feedback to low-discipline caster', () => {
    // Player intelligence is 10, difficulty is 15 -> fails discipline check
    executeReciprocalAction(
      player,
      monster,
      [{ type: 'somatic_backfire', status: 'paralysis', duration: 4, difficulty: 15 }],
      engine
    );

    // Target receives full 4 turns paralysis
    expect(monster.statusManager.hasStatus('paralysis' as any)).toBe(true);
    expect(monster.statusManager.getStatus('paralysis' as any)?.duration).toBe(4);

    // Caster failed discipline check -> receives 2 turns somatic feedback
    expect(player.statusManager.hasStatus('paralysis' as any)).toBe(true);
    expect(player.statusManager.getStatus('paralysis' as any)?.duration).toBe(2);
  });
});
