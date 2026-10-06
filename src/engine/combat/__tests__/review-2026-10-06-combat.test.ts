import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { Item } from '../../items/item';
import { ScrollItem } from '../../items/consumables';
import { WaitAction } from '../../actions/wait';
import { MovementAction } from '../../actions/movement';
import { MeleeAttackAction, WindUpExecuteAction } from '../../actions/combat';
import { ReadScrollAction } from '../../actions/spell-actions';
import { applyConsequences } from '../../actions/choiceAction';
import { TrapInstance } from '../../dungeon/traps';
import { applyImpulse } from '../impulse';
import { cotwManifest } from '../../../content/cotw';

/**
 * Whole-codebase review, 2026-10-06, area 3 (combat / magic / status). Each test below
 * reproduces one finding from `.prompts/codebase-review-2026-10-06/areas/03-combat.md`
 * and is marked `it.fails` so the suite stays green until the bug is fixed, at which point
 * the test flips and the `fails` marker should be removed.
 */

function make(playerHp = 100, size = 14) {
  const map = new GameMap(size, size, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: playerHp, maxHp: 100, attack: 10, defense: 0 },
  });
  map.addEntity(player);
  const engine = new GameEngine({ map, player, seed: 7 });
  return { map, player, engine };
}

function mon(id: string, x: number, y: number, hp = 30, extra: Record<string, unknown> = {}): Monster {
  return new Monster({
    id,
    name: id,
    position: { x, y },
    stats: { hp, maxHp: hp, attack: 10, defense: 0 },
    speed: 100,
    definitionId: id,
    aiType: 'melee',
    ...extra,
  } as never);
}

function weapon(opts: Record<string, unknown>): Item {
  return new Item({
    id: 'w',
    name: 'Test Blade',
    unidentifiedName: 'Blade',
    category: 'weapon',
    slot: 'mainHand',
    weight: 100,
    bulk: 100,
    stats: { attackBonus: 3 },
    identified: true,
    ...opts,
  } as never);
}

describe('R-cmbt-1 · a paralysed hero killed by a status tick is never resolved (engine.ts paralysis branch)', () => {
  it.fails('a poisoned, paralysed hero at 2 HP who waits ends the run as fallen', () => {
    const { player, engine } = make(2);
    player.statusManager.applyStatus({ type: 'paralysis', duration: 3 }, [], player, engine);
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 3 }, [], player, engine);

    engine.handlePlayerAction(new WaitAction(player));

    expect(player.isAlive()).toBe(false);
    expect(engine.gameState.runStatus).toBe('fallen');
  });
});

describe('R-cmbt-2 · the damagePlayer choice consequence ignores a kill', () => {
  it.fails('a 15 HP consequence on a 5 HP hero ends the run as fallen', () => {
    const { player, engine } = make(5);

    applyConsequences([{ type: 'damagePlayer', amount: 15 }] as never, engine, player);

    expect(player.isAlive()).toBe(false);
    expect(engine.gameState.runStatus).toBe('fallen');
  });
});

describe('R-cmbt-3 · a chasm plunge removes the target before the death can be refused (Einherjar)', () => {
  it('a hero whose last stand refuses the death is still on the map afterwards', () => {
    const { map, player, engine } = make(50);
    (player as unknown as { perkModifiers: unknown[] }).perkModifiers.push({
      id: 'perk:einherjar',
      name: 'Einherjar',
      alignment: 'positive',
      category: 'blessed',
      lastStandPerFloor: true,
    });
    map.setTile(4, 3, TILES.CHASM);
    const brute = mon('brute', 2, 3, 100);
    map.addEntity(brute);

    applyImpulse(engine, brute, player, 1, 0, 2);

    expect(player.isAlive()).toBe(true); // the last stand held (this part passes today)
    expect(map.getEntityById(player.id)).toBe(player); // but the hero is off the map
  });
});

describe('R-cmbt-4 · a telegraphed wind-up ability declares an element and ignores it', () => {
  it.fails('a fire wind-up does nothing to a fire-immune hero', () => {
    const { map, player, engine } = make();
    (player as unknown as { elementalResistances: Record<string, string> }).elementalResistances.fire = 'immune';
    const shaman = mon('shaman', 6, 3);
    map.addEntity(shaman);

    new WindUpExecuteAction(shaman, { x: 3, y: 3 }, 'Hellfire Surge', 2.2, {
      targetTiles: [{ x: 3, y: 3 }],
      element: 'fire',
    }).perform(engine);

    expect(100 - player.hp).toBe(0);
  });
});

describe('R-cmbt-5 · an elemental bonusDamage hook ignores the target affinity', () => {
  it.fails('a fire bonusDamage hook adds nothing against a fire-immune monster', () => {
    const lost = (withHook: boolean) => {
      const { map, player, engine } = make();
      const w = weapon(
        withHook ? { hooks: [{ event: 'onHit', chance: 1, action: { type: 'bonusDamage', amount: 9, element: 'fire' } }] } : {}
      );
      player.inventory.primaryPack.addItem(w);
      player.inventory.equipFromPack(w.id);
      const imp = mon('imp', 4, 3, 200, { resistances: { fire: 'immune' } });
      map.addEntity(imp);
      new MeleeAttackAction(player, imp).perform(engine);
      return 200 - imp.hp;
    };

    expect(lost(true)).toBe(lost(false));
  });
});

describe('R-cmbt-6 · poison ticks ignore poison immunity', () => {
  it.fails('a poison-immune hero takes no damage from a poison tick', () => {
    const { player, engine } = make();
    (player as unknown as { elementalResistances: Record<string, string> }).elementalResistances.poison = 'immune';
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 4 }, [], player, engine);

    engine.handlePlayerAction(new WaitAction(player));

    expect(100 - player.hp).toBe(0);
  });
});

describe('R-cmbt-7 · a hero killed by their own action while poisoned dies twice', () => {
  it('a poisoned hero stepping on a lethal pit trap triggers exactly one death', () => {
    const { map, player, engine } = make(3);
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 2 }, [], player, engine);
    map.addTrap(new TrapInstance({ id: 't', type: 'pit', x: 4, y: 3, damage: 10 }));
    let deaths = 0;
    engine.gameState.onStateChanged = () => {
      deaths += 1;
    };

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.isAlive()).toBe(false);
    expect(deaths).toBe(1);
    expect(engine.gameState.killerName).toBe('a pit trap');
  });
});

describe('R-cmbt-8 · an ice-slide death carries no cause', () => {
  it.fails('a hero killed by a wall splat after sliding on ice is not "Slain by Mortal Wounds"', () => {
    const { map, player, engine } = make(1);
    map.setTile(6, 3, TILES.WALL);
    engine.surfaces.setSurface(4, 3, 'ice_sheet', 5);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(player.isAlive()).toBe(false);
    expect(engine.gameState.killerName).not.toBe('Mortal Wounds');
  });
});

describe('R-cmbt-11 · reading a Scroll of Identify with nothing to identify burns the scroll', () => {
  it.fails('the scroll stays in the pack when the cast fails for lack of a target', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player, manifest: cotwManifest });
    const scroll = new ScrollItem({ id: 'scroll-id', name: 'Scroll of Identify', spellId: 'identify', identified: true });
    player.inventory.primaryPack.addItem(scroll);

    const res = new ReadScrollAction(player, scroll).perform(engine);

    expect(res.success).toBe(false); // nothing to identify: the cast fails (passes today)
    expect(player.inventory.findItemById(scroll.id)).toBe(scroll); // the scroll should still be there
  });
});

describe('R-cmbt-13 · an affix block runs on a defender a hook already killed: the kill resolves twice', () => {
  it('one blow that kills through its hook emits one entity_killed event', () => {
    const { map, player, engine } = make();
    const w = weapon({
      elementalAffix: { element: 'cold', bonusDamage: 5, name: 'of Cold' },
      hooks: [{ event: 'onHit', chance: 1, action: { type: 'bonusDamage', amount: 50, element: 'fire' } }],
    });
    player.inventory.primaryPack.addItem(w);
    player.inventory.equipFromPack(w.id);
    const goblin = mon('goblin', 4, 3, 20, { xpValue: 10 });
    map.addEntity(goblin);
    const killed: string[] = [];
    engine.onGameEvent = (e) => {
      if (e.type === 'entity_killed') killed.push(String(e.targetId));
    };

    new MeleeAttackAction(player, goblin).perform(engine);

    expect(killed).toEqual(['goblin']);
  });
});

describe('R-cmbt-14 · an attacker killed by melee reflection keeps attacking', () => {
  it.fails('a rat slain by the reflected share of its own bite does not poison the hero', () => {
    const { map, player, engine } = make();
    const hide = new Item({
      id: 'h',
      name: 'Mirror Hide',
      unidentifiedName: 'x',
      category: 'armor',
      slot: 'torso',
      weight: 100,
      bulk: 100,
      stats: { defenseBonus: 0 },
      identified: true,
      wornEffects: { reflectMeleePercent: 5 },
    } as never);
    player.inventory.primaryPack.addItem(hide);
    player.inventory.equipFromPack(hide.id);
    const rat = mon('rat', 4, 3, 1, { onHitAffliction: { type: 'poison', chance: 1, duration: 5, potency: 2 } });
    map.addEntity(rat);

    new MeleeAttackAction(rat, player).perform(engine);

    expect(rat.isAlive()).toBe(false); // the reflection killed it (passes today)
    expect(player.statusManager.hasStatus('poison')).toBe(false);
  });
});

describe('R-cmbt-15 · paralysed turns skip every environmental update', () => {
  it.fails('a lingering fire under a paralysed hero still burns and still decays', () => {
    const { player, engine } = make(100);
    engine.surfaces.setSurface(3, 3, 'fire', 5);
    player.statusManager.applyStatus({ type: 'paralysis', duration: 3 }, [], player, engine);

    for (let i = 0; i < 3; i++) engine.handlePlayerAction(new WaitAction(player));

    const remaining = engine.surfaces.getCell(3, 3)?.surface?.duration ?? 0;
    expect(100 - player.hp).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(5);
  });
});
