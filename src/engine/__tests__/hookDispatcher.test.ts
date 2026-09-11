import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { HookDispatcher, type HookDescriptor } from '../hooks/hookDispatcher';
import { MeleeAttackAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { Item } from '../items/item';
import { TILES } from '../grid/tile';

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
    HookDispatcher.registerGlobalHook({
      event: 'onMove',
      chance: 1.0,
      description: 'You leave a burning wake behind you.',
      action: { type: 'spawnSurface', surfaceType: 'oil_slick' },
    });

    const move = new MovementAction(player, 0, 1);
    move.perform(engine);

    expect(engine.surfaces.getSurface(2, 3)).toBe('oil_slick');
    expect(engine.messages.some((m) => m.includes('You leave a burning wake behind you.'))).toBe(true);
    HookDispatcher.clearGlobalHooks();
  });

  it('enforces re-entrancy depth cap to prevent infinite recursion cascades', () => {
    HookDispatcher.registerGlobalHook({
      event: 'onDamageTaken',
      chance: 1.0,
      action: { type: 'bonusDamage', amount: 2 },
    });

    // Inflicting damage should hit max depth 3 and stop cleanly without throwing
    HookDispatcher.dispatch('onDamageTaken', {
      engine,
      defender: player,
      damage: 5,
    });

    HookDispatcher.clearGlobalHooks();
  });
});
