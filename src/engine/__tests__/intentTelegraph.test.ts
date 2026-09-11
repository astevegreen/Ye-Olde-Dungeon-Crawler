import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { computeDangerTiles, interruptWindUp } from '../ai/intent';
import { WindUpDeclareAction, WindUpExecuteAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { TILES } from '../grid/tile';

describe('Enemy Intent Telegraphing & Wind-Up System', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let boss: Monster;

  beforeEach(() => {
    map = new GameMap(15, 15);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 2 },
    });
    boss = new Monster({
      id: 'boss-ogre',
      name: 'Ogre Chieftain',
      position: { x: 6, y: 5 },
      stats: { hp: 120, maxHp: 120, attack: 15, defense: 5 },
      speed: 100,
      definitionId: 'ogre',
      aiType: 'brute',
    });
    map.addEntity(player);
    map.addEntity(boss);
    engine = new GameEngine({ map, player });
  });

  it('computes expected danger tiles for blast and cross patterns', () => {
    const blastTiles = computeDangerTiles({ x: 6, y: 5 }, { x: 5, y: 5 }, 'blast', map, 1, 1);
    expect(blastTiles.length).toBeGreaterThanOrEqual(5); // 3x3 circle contains center + cardinals
    expect(blastTiles.some((p) => p.x === 5 && p.y === 5)).toBe(true);

    const crossTiles = computeDangerTiles({ x: 6, y: 5 }, { x: 5, y: 5 }, 'cross', map, 1, 2);
    expect(crossTiles.some((p) => p.x === 5 && p.y === 5)).toBe(true);
    expect(crossTiles.some((p) => p.x === 7 && p.y === 5)).toBe(true);
    expect(crossTiles.some((p) => p.x === 3 && p.y === 5)).toBe(true);
    expect(crossTiles.some((p) => p.x === 5 && p.y === 7)).toBe(true);
    expect(crossTiles.some((p) => p.x === 5 && p.y === 3)).toBe(true);
  });

  it('stops line pattern rays when intersecting impenetrable walls', () => {
    map.setTile(3, 5, TILES.WALL);
    // Project ray from (6,5) West towards (1,5)
    const lineTiles = computeDangerTiles({ x: 6, y: 5 }, { x: 1, y: 5 }, 'line', map, 5);

    // Tiles should include (5,5), (4,5), (3,5) wall, but not continue to (2,5) or (1,5)
    expect(lineTiles.some((p) => p.x === 5 && p.y === 5)).toBe(true);
    expect(lineTiles.some((p) => p.x === 4 && p.y === 5)).toBe(true);
    expect(lineTiles.some((p) => p.x === 2 && p.y === 5)).toBe(false);
  });

  it('executes full wind-up telegraph: evasion allows player to dodge damage', () => {
    // 1. Boss declares heavy ground slam targeting (5,5)
    const danger = computeDangerTiles(boss.position, player.position, 'single', map);
    const declare = new WindUpDeclareAction(
      boss,
      { x: 5, y: 5 },
      'Ogre Sunder',
      'The Ogre Chieftain prepares a devastating Sunder!',
      { targetTiles: danger, multiplier: 3.0 }
    );
    declare.perform(engine);

    expect(boss.intent.type).toBe('windup');
    expect(boss.intent.targetTiles).toEqual(danger);

    // 2. Player steps North to (5,4) out of harm's way
    new MovementAction(player, 0, -1).perform(engine);
    expect(player.x).toBe(5);
    expect(player.y).toBe(4);

    // 3. Boss executes windup at original tile
    const execute = new WindUpExecuteAction(boss, { x: 5, y: 5 }, 'Ogre Sunder', 3.0, {
      targetTiles: danger,
    });
    const execRes = execute.perform(engine);

    expect(execRes.success).toBe(true);
    expect(player.hp).toBe(100); // No damage taken!
    expect(engine.messages.some((m) => m.includes('strikes the empty ground'))).toBe(true);
  });

  it('deals massive damage and pushes player when player fails to dodge', () => {
    const danger = [{ x: 5, y: 5 }];
    new WindUpDeclareAction(
      boss,
      { x: 5, y: 5 },
      'Ogre Sunder',
      'The Ogre Chieftain prepares a devastating Sunder!',
      { targetTiles: danger, multiplier: 2.5, pushImpulse: 2 }
    ).perform(engine);

    const hpBefore = player.hp;
    // Player remains stationary at (5,5)
    const execute = new WindUpExecuteAction(boss, { x: 5, y: 5 }, 'Ogre Sunder', 2.5, {
      targetTiles: danger,
      pushImpulse: 2,
    });
    execute.perform(engine);

    expect(player.hp).toBeLessThan(hpBefore);
    // Push impulse moves player West away from boss (6,5 -> 5,5 -> pushed to 3,5)
    expect(player.x).toBe(3);
    expect(engine.messages.some((m) => m.includes('slams into Adventurer for'))).toBe(true);
  });

  it('interrupts wind-up attack when boss is stunned or interrupted', () => {
    new WindUpDeclareAction(
      boss,
      { x: 5, y: 5 },
      'Ogre Sunder',
      'The Ogre Chieftain prepares a devastating Sunder!'
    ).perform(engine);

    expect(boss.intent.type).toBe('windup');

    // Boss gets stunned
    boss.statusManager.applyStatus({ type: 'stunned', duration: 1 });
    const interrupted = interruptWindUp(boss, engine, 'Stunned');

    expect(interrupted).toBe(true);
    expect(boss.intent.type).toBe('idle');
    expect(engine.messages.some((m) => m.includes('INTERRUPTED (Stunned)'))).toBe(true);
  });
});
