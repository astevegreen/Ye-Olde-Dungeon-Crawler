import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { MovementAction } from '../actions/movement';
import { WaitAction } from '../actions/wait';
import { TrapInstance } from '../dungeon/traps';
import { DeathResolver } from '../combat/deathResolver';
import { TILES } from '../grid/tile';

/**
 * The death screen names what killed the hero. With no creature behind it (fire, acid,
 * poison, a trap) it said "Slain by Mortal Wounds"; 19 of the 5 Oct soak's deaths read so.
 */
describe('what the death screen says killed the hero', () => {
  let engine: GameEngine;
  let player: Player;
  let goblin: Monster;

  beforeEach(() => {
    const map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 2, maxHp: 50, attack: 10, defense: 2 } });
    goblin = new Monster({
      id: 'test-goblin',
      name: 'Goblin',
      position: { x: 8, y: 8 },
      stats: { hp: 30, maxHp: 30, attack: 4, defense: 1 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
    });
    map.addEntity(player);
    map.addEntity(goblin);
    engine = new GameEngine({ map, player });
  });

  const slainBy = () => engine.gameState.killerName;

  it('stepping into fire', () => {
    engine.surfaces.setSurface(4, 3, 'fire', 5);
    new MovementAction(player, 1, 0).perform(engine);
    expect(player.isAlive()).toBe(false);
    expect(slainBy()).toBe('searing fire');
    expect(engine.gameState.causeOfDeath).toBe(`Slain by searing fire on Floor ${engine.currentFloor}`);
  });

  it('standing in lingering fire', () => {
    engine.surfaces.setSurface(3, 3, 'fire', 5);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('lingering fire');
  });

  it('a firestorm', () => {
    engine.surfaces.setGas(3, 3, 'fire_storm', 3);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('a firestorm');
  });

  it('acid', () => {
    engine.surfaces.setSurface(3, 3, 'acid_pool', 5);
    engine.surfaces.tick(engine);
    expect(slainBy()).toBe('acid');
  });

  it("poison's tick, through the engine's own turn", () => {
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 3 }, [], player, engine);
    engine.handlePlayerAction(new WaitAction(player));
    expect(player.isAlive()).toBe(false);
    expect(slainBy()).toBe('poison');
  });

  it('a pit trap', () => {
    new TrapInstance({ id: 't1', type: 'pit', x: 3, y: 3, damage: 5 }).trigger(player, engine);
    expect(slainBy()).toBe('a pit trap');
  });

  it('a creature is still named', () => {
    player.takeDamage(2);
    DeathResolver.resolveDeath(engine, goblin, player);
    expect(slainBy()).toBe('Goblin');
  });

  it('nothing named is still Mortal Wounds', () => {
    player.takeDamage(2);
    DeathResolver.resolveDeath(engine, undefined, player);
    expect(slainBy()).toBe('Mortal Wounds');
  });

  it("a status's cause is used once: a later death it didn't cause isn't blamed on it", () => {
    player.pendingDeathCause = 'poison';
    DeathResolver.resolveDeath(engine, goblin, player);
    expect(slainBy()).toBe('Goblin');
    expect(player.pendingDeathCause).toBeUndefined();
  });
});
