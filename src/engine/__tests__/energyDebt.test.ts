import { describe, expect, it } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { WaitAction } from '../actions/wait';
import { MovementAction } from '../actions/movement';

/**
 * Slow x1.5, encumbrance, shallow water and surface move penalties cost more than 100. A
 * speed-100 actor always acts on exactly 100 energy, so `consumeEnergy` once floored the rest
 * at 0 and slowing down cost nothing; the extra is now a debt later ticks pay back.
 */
describe('energy debt: an action dearer than the energy banked costs time', () => {
  function setup(slowMonster: boolean) {
    const map = GameMap.createBoxRoom(30, 30);
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 2, y: 2 },
      stats: { hp: 500, maxHp: 500, attack: 0, defense: 0 },
      speed: 100,
    });
    const engine = new GameEngine({ map, player, floor: 1 });
    const monster = new Monster({
      id: 'm',
      name: 'Brute',
      position: { x: 3, y: 2 },
      stats: { hp: 500, maxHp: 500, attack: 5, defense: 0 },
      speed: 100,
      aiState: 'hunting',
    });
    engine.addEntity(monster);
    if (slowMonster) monster.statusManager.applyStatus({ type: 'slow', duration: 1000 });
    let monsterActions = 0;
    engine.actionPipeline.registerHook({
      id: 'count-monster',
      phase: 'post',
      actionType: '*',
      execute: (ctx) => {
        if (ctx.actor === monster) monsterActions += 1;
      },
    });
    return { engine, player, monster, actions: () => monsterActions };
  }

  it('a slowed speed-100 monster acts fewer times than an unslowed one', () => {
    const plain = setup(false);
    for (let i = 0; i < 9; i++) plain.engine.handlePlayerAction(new WaitAction(plain.player));
    const slowed = setup(true);
    for (let i = 0; i < 9; i++) slowed.engine.handlePlayerAction(new WaitAction(slowed.player));

    expect(plain.actions()).toBe(9);
    // Each slowed action costs 150 energy at speed 100: about 6 actions in 9 hero turns.
    expect(slowed.actions()).toBeLessThanOrEqual(7);
  });

  it('a speed-100 entity that spends 150 energy from 100 is left in debt', () => {
    const player = new Player({ id: 'p', position: { x: 0, y: 0 }, speed: 100 });
    player.gainEnergy(100);
    player.consumeEnergy(150);
    // One tick of +100 must not make it ready again: the extra 50 is a lost half-turn.
    player.gainEnergy(100);
    expect(player.canAct()).toBe(false);
  });

  it('a slowed hero stepping 10 times takes about 15 ticks of world time', () => {
    const map = GameMap.createBoxRoom(30, 30);
    const player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 500, maxHp: 500, attack: 0, defense: 0 },
      speed: 100,
    });
    const engine = new GameEngine({ map, player, floor: 1 });
    player.statusManager.applyStatus({ type: 'slow', duration: 1000 });
    const ticksBefore = engine.scheduler.ticks;
    let firstCost = 0;
    for (let i = 0; i < 10; i++) {
      const r = engine.handlePlayerAction(new MovementAction(player, i % 2 === 0 ? 1 : -1, 0));
      if (i === 0) firstCost = r.cost;
    }
    expect(firstCost).toBe(150);
    expect(engine.scheduler.ticks - ticksBefore).toBeGreaterThanOrEqual(14);
  });
});
