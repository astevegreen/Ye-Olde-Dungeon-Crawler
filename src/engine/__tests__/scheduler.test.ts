import { describe, it, expect, beforeEach } from 'vitest';
import { EnergyScheduler } from '../scheduler';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { createTestKobold } from '../__fixtures__/testHelpers';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { WaitAction } from '../actions/wait';

describe('Scheduler System - Energy-Based Action Loop', () => {
  let scheduler: EnergyScheduler;
  let hero: Player;
  let goblin: Monster;

  beforeEach(() => {
    scheduler = new EnergyScheduler();

    hero = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 2, y: 2 },
      speed: 100,
    });

    goblin = new Monster({
      id: 'goblin-1',
      name: 'Goblin',
      position: { x: 5, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
    });

    scheduler.addEntity(hero);
    scheduler.addEntity(goblin);
  });

  it('accumulates energy and advances ticks accurately', () => {
    expect(hero.energy).toBe(0);
    expect(goblin.energy).toBe(0);
    expect(scheduler.ticks).toBe(0);

    // After 1 tick: both gain 100 energy (speed 100)
    const actor = scheduler.advanceToNextActor();

    expect(scheduler.ticks).toBe(1);
    expect(hero.energy).toBe(100);
    expect(goblin.energy).toBe(100);
    // Player is prioritized when energies tie
    expect(actor).toBe(hero);
  });

  it('schedules fast entities more frequently than normal entities', () => {
    scheduler.reset();

    const normalWarrior = new Player({
      id: 'warrior',
      position: { x: 0, y: 0 },
      speed: 100,
    });

    const speedyRogue = new Monster({
      id: 'rogue',
      name: 'Speedy Rogue',
      position: { x: 1, y: 1 },
      stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      speed: 200, // Twice as fast
    });

    scheduler.addEntity(normalWarrior);
    scheduler.addEntity(speedyRogue);

    // Tick 1:
    // Rogue gets +200 energy (total 200)
    // Warrior gets +100 energy (total 100)
    // Rogue has more energy -> rogue acts first
    const firstActor = scheduler.advanceToNextActor();
    expect(firstActor).toBe(speedyRogue);
    expect(speedyRogue.energy).toBe(200);

    // Rogue acts and consumes 100 energy (100 remains)
    speedyRogue.consumeEnergy(100);
    expect(speedyRogue.energy).toBe(100);

    // Rogue still has 100 energy, warrior has 100 energy.
    // Warrior (player) is prioritized or ready actor
    const secondActor = scheduler.advanceToNextActor();
    expect(secondActor).toBe(normalWarrior);

    // Warrior acts and consumes 100 energy
    normalWarrior.consumeEnergy(100);
    expect(normalWarrior.energy).toBe(0);

    // Rogue STILL has 100 energy without advancing any new tick!
    const thirdActor = scheduler.advanceToNextActor();
    expect(thirdActor).toBe(speedyRogue);
    expect(scheduler.ticks).toBe(1); // All 3 actions resolved within tick 1!
  });

  it('handles slow entities taking multiple ticks to act', () => {
    scheduler.reset();

    const fastScout = new Player({
      id: 'scout',
      position: { x: 0, y: 0 },
      speed: 100,
    });

    const slowZombie = new Monster({
      id: 'zombie',
      name: 'Zombie',
      position: { x: 1, y: 1 },
      stats: { hp: 20, maxHp: 20, attack: 4, defense: 0 },
      speed: 50, // Half speed
    });

    scheduler.addEntity(fastScout);
    scheduler.addEntity(slowZombie);

    // Tick 1: Scout gets 100 (ready), Zombie gets 50 (not ready)
    const actor1 = scheduler.advanceToNextActor();
    expect(actor1).toBe(fastScout);
    expect(scheduler.ticks).toBe(1);
    expect(slowZombie.energy).toBe(50);
    fastScout.consumeEnergy(100);

    // Tick 2: Scout gets +100 (100), Zombie gets +50 (100)
    const actor2 = scheduler.advanceToNextActor();
    expect(actor2).toBe(fastScout); // Player priority on tie
    expect(scheduler.ticks).toBe(2);
    expect(slowZombie.energy).toBe(100);
    fastScout.consumeEnergy(100);

    // Zombie now acts on its accumulated 100 energy
    const actor3 = scheduler.advanceToNextActor();
    expect(actor3).toBe(slowZombie);
    expect(scheduler.ticks).toBe(2);
  });

  it('orchestrates complete engine turn loop with monster AI counter-turns', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      speed: 100,
    });
    const enemy = createTestKobold('kobold-1', { x: 2, y: 4 });

    const engine = new GameEngine({ map, player });
    engine.addEntity(enemy);

    // Kobold is at (2, 4), Player is at (2, 2). Distance in Y is 2 tiles.
    // Player waits a turn. Enemy should move 1 step towards player to (2, 3).
    const waitAction = new WaitAction(player);
    const result = engine.handlePlayerAction(waitAction);

    expect(result.success).toBe(true);
    expect(engine.turnCount).toBe(1);
    expect(enemy.y).toBe(3); // Monster advanced 1 step towards player
    expect(enemy.x).toBe(2);
  });
});
