import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { HookDispatcher, type HookDescriptor } from '../hooks/hookDispatcher';
import { MeleeAttackAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { Item } from '../items/item';
import { TILES } from '../grid/tile';
import { createScaledItem } from '../dungeon/lootSpawner';
import type { ItemDefinition } from '../types/manifest';

describe('Event-Driven Hook Engine', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;
  let monster: Monster;

  beforeEach(() => {
    map = new GameMap(10, 10);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 2, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    monster = new Monster({
      id: 'target-goblin',
      name: 'Goblin',
      position: { x: 3, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 1 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
      xpValue: 20,
    });
    map.addEntity(player);
    map.addEntity(monster);
    engine = new GameEngine({ map, player });
  });

  it('triggers onHit hook from equipped weapon and applies bonus damage and log message', () => {
    const frostDamageHook: HookDescriptor = {
      event: 'onHit',
      chance: 1.0,
      description: 'Frostbite pierces deep!',
      action: { type: 'bonusDamage', amount: 8, element: 'cold' },
    };
    const frostSlowHook: HookDescriptor = {
      event: 'onHit',
      chance: 1.0,
      action: { type: 'applyStatus', status: 'slow', duration: 3 },
    };

    const sword = new Item({
      id: 'frost-blade',
      name: 'Frost Blade',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1000,
      bulk: 500,
      stats: { attackBonus: 2 },
      identified: true,
      hooks: [frostDamageHook, frostSlowHook],
    });

    player.inventory.paperdoll.equip(sword, 'mainHand');

    const initialMonsterHp = monster.hp;
    const action = new MeleeAttackAction(player, monster);
    const res = action.perform(engine);

    expect(res.success).toBe(true);
    expect(engine.messages.some((m) => m.includes('Frostbite pierces deep!'))).toBe(true);
    expect(monster.statusManager.hasStatus('slow')).toBe(true);
    expect(monster.hp).toBeLessThan(initialMonsterHp - 8);
  });

  it('triggers onKill hook and restores attacker HP on lethal strike', () => {
    const vampiricHook: HookDescriptor = {
      event: 'onKill',
      chance: 1.0,
      description: 'Dark essence restores your vitality!',
      action: { type: 'heal', amount: 15, target: 'self' },
    };

    const dagger = new Item({
      id: 'vamp-dagger',
      name: 'Vampire Dagger',
      category: 'weapon',
      slot: 'mainHand',
      weight: 400,
      bulk: 200,
      stats: { attackBonus: 50 },
      identified: true,
      hooks: [vampiricHook],
    });

    player.inventory.paperdoll.equip(dagger, 'mainHand');
    player.hp = 20; // Wounded

    const action = new MeleeAttackAction(player, monster);
    action.perform(engine);

    expect(monster.isAlive()).toBe(false);
    expect(player.hp).toBe(35);
    expect(engine.messages.some((m) => m.includes('Dark essence restores your vitality!'))).toBe(true);
  });

  it('evaluates conditions and only procs when condition matches', () => {
    const executionerHook: HookDescriptor = {
      event: 'onHit',
      chance: 1.0,
      predicate: {
        type: 'hasFlag',
        flag: 'executioner_active',
        value: true,
      },
      description: 'EXECUTE! Critical execution blow!',
      action: { type: 'bonusDamage', amount: 20 },
    };

    const axe = new Item({
      id: 'exec-axe',
      name: 'Executioner Axe',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1500,
      bulk: 800,
      stats: { attackBonus: 1 },
      identified: true,
      hooks: [executionerHook],
    });

    player.inventory.paperdoll.equip(axe, 'mainHand');

    // Predicate not met -> should NOT trigger
    new MeleeAttackAction(player, monster).perform(engine);
    expect(engine.messages.some((m) => m.includes('Critical execution blow!'))).toBe(false);

    // Set flag in worldState -> should trigger!
    engine.worldState.flags['executioner_active'] = true;
    new MeleeAttackAction(player, monster).perform(engine);
    expect(engine.messages.some((m) => m.includes('Critical execution blow!'))).toBe(true);
  });

  it('dispatches onMove hook when an entity moves', () => {
    const boots = new Item({
      id: 'oil-boots',
      name: 'Oil-Soaked Boots',
      category: 'boots',
      slot: 'feet',
      weight: 800,
      bulk: 600,
      identified: true,
      hooks: [
        {
          event: 'onMove',
          chance: 1.0,
          description: 'You leave a burning wake behind you.',
          action: { type: 'spawnSurface', surfaceType: 'oil_slick' },
        },
      ],
    });
    player.inventory.paperdoll.equip(boots, 'feet');

    const move = new MovementAction(player, 0, 1);
    move.perform(engine);

    expect(engine.surfaces.getSurface(2, 3)).toBe('oil_slick');
    expect(engine.messages.some((m) => m.includes('You leave a burning wake behind you.'))).toBe(true);
  });

  // Primitives are the engine's own set, none of which dispatches again, so a spy on
  // executePrimitive stands in for a re-dispatching or throwing one.
  it('enforces re-entrancy depth cap to prevent infinite recursion cascades', () => {
    monster.hooks = [{ event: 'onDamageTaken', chance: 1.0, action: { type: 'heal', amount: 1, target: 'self' } }];
    let executions = 0;
    const spy = vi.spyOn(HookDispatcher, 'executePrimitive').mockImplementation((_action, ctx) => {
      executions += 1;
      // Hard stop so a missing cap fails the assertion below instead of overflowing the stack.
      if (executions >= 10) return;
      HookDispatcher.dispatch('onDamageTaken', ctx);
    });

    try {
      HookDispatcher.dispatch('onDamageTaken', { engine, defender: monster, damage: 5 });
    } finally {
      spy.mockRestore();
    }

    expect(executions).toBe(3);
  });

  it('restores re-entrancy depth when a primitive throws, so later hooks still fire', () => {
    monster.hp = 20;
    monster.hooks = [{ event: 'onTurnStart', chance: 1.0, action: { type: 'heal', amount: 4, target: 'self' } }];
    const spy = vi.spyOn(HookDispatcher, 'executePrimitive').mockImplementation(() => {
      throw new Error('PRIMITIVE_FAULT');
    });
    try {
      // More throwing dispatches than the depth cap: a leaked depth increment would disable all hooks.
      for (let i = 0; i < 3; i++) {
        expect(() => HookDispatcher.dispatch('onTurnStart', { engine, attacker: monster })).toThrow('PRIMITIVE_FAULT');
      }
    } finally {
      spy.mockRestore();
    }

    const summary = HookDispatcher.dispatch('onTurnStart', { engine, attacker: monster });

    expect(monster.hp).toBe(24);
    expect(summary.executedHooks).toBe(1);
  });

  it('fires the hooks of a weapon made from its definition, as loot and shops make it', () => {
    const def: ItemDefinition = {
      id: 'frost_blade',
      name: 'Frost Blade',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1000,
      bulk: 500,
      identified: true,
      hooks: [{ event: 'onHit', chance: 1.0, action: { type: 'applyStatus', status: 'slow', duration: 3 } }],
    };
    player.inventory.paperdoll.equip(createScaledItem(def, 'frost-1', 1, () => 0.5), 'mainHand');

    new MeleeAttackAction(player, monster).perform(engine);

    expect(monster.statusManager.hasStatus('slow')).toBe(true);
  });
});

describe('onTurnStart monster hooks', () => {
  function setup(hooks: HookDescriptor[], monsterAt = { x: 3, y: 2 }) {
    const map = new GameMap(12, 12);
    map.fill(TILES.FLOOR);
    const player = new Player({ position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 1, defense: 50 } });
    const monster = new Monster({
      id: 'hooked',
      name: 'Hooked',
      position: monsterAt,
      stats: { hp: 10, maxHp: 30, attack: 1, defense: 1 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'immobile_turret',
      aiState: 'hunting',
      xpValue: 1,
      hooks,
    });
    map.addEntity(player);
    map.addEntity(monster);
    const engine = new GameEngine({ map, player });
    return { engine, player, monster };
  }

  it('fires at the start of an awake monster\'s turn', () => {
    const { engine, monster } = setup([{ event: 'onTurnStart', action: { type: 'heal', amount: 4, target: 'self' } }]);

    monster.takeTurn(engine);

    expect(monster.hp).toBe(14);
  });

  it('does not fire for a sleeping monster', () => {
    const { engine, monster } = setup([{ event: 'onTurnStart', action: { type: 'heal', amount: 4, target: 'self' } }]);
    monster.aiState = 'sleeping';

    monster.takeTurn(engine);

    expect(monster.hp).toBe(10);
  });

  it('aims a "target" hook at the hero the monster can see', () => {
    const { engine, player, monster } = setup(
      [{ event: 'onTurnStart', action: { type: 'applyStatus', status: 'slow', duration: 4, target: 'target' } }],
      { x: 6, y: 2 }
    );

    monster.takeTurn(engine);

    expect(player.statusManager.hasStatus('slow')).toBe(true);
    expect(monster.statusManager.hasStatus('slow')).toBe(false);
  });

  it('skips a "target" hook when the monster sees no one, rather than turning it on itself', () => {
    const { engine, player, monster } = setup(
      [{ event: 'onTurnStart', action: { type: 'applyStatus', status: 'slow', duration: 4, target: 'target' } }],
      { x: 11, y: 11 }
    );
    for (let x = 0; x < 12; x++) engine.map.setTile(x, 6, TILES.WALL);

    monster.takeTurn(engine);

    expect(player.statusManager.hasStatus('slow')).toBe(false);
    expect(monster.statusManager.hasStatus('slow')).toBe(false);
  });
});
