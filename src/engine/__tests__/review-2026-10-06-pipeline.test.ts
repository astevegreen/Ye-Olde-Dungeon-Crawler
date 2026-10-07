import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Item } from '../items/item';
import { PotionItem } from '../items/consumables';
import { DrinkPotionAction } from '../actions/spell-actions';
import { WaitAction } from '../actions/wait';
import { MovementAction } from '../actions/movement';
import { ClimbStairsAction } from '../actions/stairs';
import { AutoRestManager } from '../actions/autoRest';
import { TrapInstance } from '../dungeon/traps';
import { flightRecorder } from '../debug/flightRecorder';
import { rebuildAction } from '../debug/replay';

/**
 * Whole-codebase review, 2026-10-06, area 2 (engine core, pipeline, replay trail): regression
 * guards for the findings fixed since. R-pipe-3: a floor whose generation throws leaves the
 * hero where they stood. R-pipe-4: a rest enters the replay trail. R-pipe-5: a free
 * auto-pickup replays as free. R-pipe-6: item actions taken from a paused menu cost the
 * monster turns they cost outside it. R-pipe-7: a stun or paralysis of N turns costs a
 * monster N turns. R-pipe-8: a monster a trap kills is removed from the map (generated floors
 * hide traps through `manifest.trapPlacement`). R-pipe-11: cure_status "all" purges every
 * affliction. R-pipe-16: a hero killed by the world's advance before an action takes no
 * action. R-pipe-22: a potion's apply_status respects the drinker's immunities.
 */

function build(hp = 50, floor = 1) {
  const map = new GameMap(14, 14, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 }, stats: { hp, maxHp: 50, attack: 5, defense: 0 } });
  const engine = new GameEngine({ map, player, floor, seed: 11 });
  return { engine, player, map };
}

function addOrc(engine: GameEngine, x: number, y: number, hp = 30): Monster {
  const orc = new Monster({
    id: 'orc',
    name: 'Orc',
    position: { x, y },
    stats: { hp, maxHp: hp, attack: 3, defense: 0 },
    speed: 100,
    definitionId: 'orc',
    aiType: 'melee',
    aiState: 'hunting',
    xpValue: 10,
  });
  engine.addEntity(orc);
  return orc;
}

const orcAttacks = (engine: GameEngine) => engine.messages.filter((m) => m.startsWith('Orc attacks')).length;

describe('R-pipe-3 · a floor whose generation throws leaves the hero where they stood', () => {
  it('the hero stays on the old map, in the scheduler, and can still move', () => {
    const base = build(50).engine;
    const map = new GameMap(14, 14, TILES.FLOOR);
    map.setTile(2, 2, TILES.STAIRS_DOWN);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 0 } });
    const engine = new GameEngine({
      map,
      player,
      floor: 1,
      seed: 11,
      // An unregistered layout strategy: generating floor 2 throws.
      manifest: { ...base.manifest, quest: { ...base.manifest.quest, defaultGenerator: 'no-such-generator' } },
    });
    const orc = addOrc(engine, 10, 10);

    const result = engine.handlePlayerAction(new ClimbStairsAction(player));

    expect(result.pipelineError).toBe(true); // the stairs fail loudly
    expect(engine.currentFloor).toBe(1);
    expect(engine.map).toBe(map);
    expect(map.getEntityById('hero')).toBe(player);
    expect(engine.scheduler.getEntities()).toContain(player);
    expect(engine.scheduler.getEntities()).toContain(orc);
    const move = engine.handlePlayerAction(new MovementAction(player, 1, 0));
    expect(move.success).toBe(true);
    expect({ x: player.x, y: player.y }).toEqual({ x: 3, y: 2 });
  });
});

describe('R-pipe-4 · a rest (stepRestTurn) enters the replay trail', () => {
  it('a 40-turn rest adds entries to the action trail', () => {
    const { engine, player } = build(50);
    player.hp = 10;
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player)); // opens the trail (checkpoint + 1 entry)
    const before = flightRecorder.getReplayData(engine)?.trail.length ?? 0;
    const turnsBefore = engine.turnCount;

    AutoRestManager.executeFullRest(engine, 40);

    expect(engine.turnCount).toBeGreaterThan(turnsBefore); // the world moved
    expect(flightRecorder.getReplayData(engine)?.trail.length ?? 0).toBeGreaterThan(before);
  });
});

describe('R-pipe-5 · a free auto-pickup replays as a free pickup', () => {
  it('the rebuilt PickUpAction keeps freeAction: true', () => {
    const { engine, player, map } = build(50);
    map.addItemAt(player.x, player.y, new Item({ id: 'junk1', name: 'Rock', category: 'misc', weight: 10, bulk: 1, identified: true }));
    flightRecorder.requestCheckpoint('review');

    engine.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: 'junk1', freeAction: true } });

    const trail = flightRecorder.getReplayData(engine)?.trail ?? [];
    const entry = trail[trail.length - 1];
    expect(entry?.params?.freeAction).toBe(true); // recorded
    const rebuilt = rebuildAction(engine, entry) as { freeAction?: boolean } | null;
    expect(rebuilt?.freeAction).toBe(true); // and rebuilt
  });
});

describe('R-pipe-6 · item actions taken while the engine is paused (menu open) still cost monster turns', () => {
  it('three potions drunk from an open menu cost as many orc attacks as three drunk outside it', () => {
    const attacksAfter = (paused: boolean) => {
      const { engine, player } = build(30);
      addOrc(engine, 3, 2);
      player.hp = 10;
      const potions = [0, 1, 2].map((i) => new PotionItem({ id: `pot${i}`, name: `Healing ${i}`, definitionId: `heal${i}`, potionType: 'health', potency: 1, identified: true }));
      for (const p of potions) player.addItem(p);
      player.energy = 100;
      if (paused) engine.setPaused(true);
      for (const p of potions) engine.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: p.id } });
      if (paused) engine.setPaused(false);
      engine.handlePlayerAction(new WaitAction(player));
      return orcAttacks(engine);
    };

    expect(attacksAfter(true)).toBe(attacksAfter(false));
  });

  it('the menu is still paused afterwards: the world does not idle on', () => {
    const { engine, player } = build(30);
    player.addItem(new PotionItem({ id: 'pot', name: 'Healing', definitionId: 'heal', potionType: 'health', potency: 1, identified: true }));
    engine.setPaused(true);

    engine.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: 'pot' } });

    expect(engine.isPaused).toBe(true);
  });
});

describe('R-pipe-7 · a stun of N turns costs a monster N turns', () => {
  const attacksOverFive = (status?: 'stunned' | 'paralysis', turns = 0) => {
    const { engine, player } = build(100);
    const orc = addOrc(engine, 3, 2);
    if (status) orc.statusManager.applyStatus(status, turns);
    for (let t = 0; t < 5; t++) engine.handlePlayerAction(new WaitAction(player));
    return orcAttacks(engine);
  };

  it('an orc stunned for 1 turn loses one attack over five rounds', () => {
    expect(attacksOverFive('stunned', 1)).toBe(attacksOverFive() - 1);
  });

  it('a stun or paralysis of N turns costs the orc N attacks, as it costs the hero N turns', () => {
    const free = attacksOverFive();
    for (const n of [2, 3]) {
      expect(attacksOverFive('stunned', n)).toBe(free - n);
      expect(attacksOverFive('paralysis', n)).toBe(free - n);
    }
  });
});

describe('R-pipe-8 · a monster killed by a trap is resolved and leaves the map', () => {
  it('a rat killed by a pit trap is removed from the map', () => {
    const { engine, map } = build(50);
    const rat = new Monster({ id: 'rat', name: 'Rat', position: { x: 8, y: 8 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 }, speed: 100, definitionId: 'rat', aiType: 'melee' });
    map.addEntity(rat);
    map.addTrap(new TrapInstance({ id: 't', type: 'pit', x: 9, y: 8, damage: 10 }));

    new MovementAction(rat, 1, 0).perform(engine);

    expect(rat.isAlive()).toBe(false); // the trap killed it
    expect(map.getEntityById('rat')).toBeNull();
  });
});

describe('R-pipe-11 · cure_status "all" purges every affliction, not a status named "all"', () => {
  it('a potion whose cure_status is "all" purges poison', () => {
    const { engine, player } = build(50);
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 2 }, [], player, engine);
    player.statusManager.applyStatus({ type: 'blindness', duration: 5 }, [], player, engine);
    player.statusManager.applyStatus({ type: 'haste', duration: 5 }, [], player, engine);
    const draught = new PotionItem({
      id: 'draught',
      name: 'Draught of Thawed Blood',
      definitionId: 'draught_of_thawed_blood',
      potionType: 'custom',
      identified: true,
      effects: [
        { type: 'cure_status', status: 'all' },
        { type: 'apply_status', status: 'slow', duration: 4 },
      ],
    } as never);
    player.addItem(draught);

    engine.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: draught.id } });

    expect(player.statusManager.hasStatus('poison')).toBe(false);
    expect(player.statusManager.hasStatus('blindness')).toBe(false);
    expect(player.statusManager.hasStatus('haste')).toBe(true); // not an affliction
    expect(player.statusManager.hasStatus('slow')).toBe(true); // the draught's own slow, after the purge
  });
});

describe('R-pipe-16 · when the world advance before an action kills the hero, the action does not run', () => {
  it('a potion queued behind a lethal monster round is not drunk by the corpse', () => {
    const { engine, player } = build(1);
    for (const [i, [x, y]] of [[3, 2], [1, 2], [2, 3]].entries()) {
      engine.addEntity(new Monster({ id: `brute${i}`, name: 'Brute', position: { x, y }, stats: { hp: 30, maxHp: 30, attack: 40, defense: 0 }, speed: 100, definitionId: 'brute', aiType: 'melee', aiState: 'hunting' }));
    }
    const potion = new PotionItem({ id: 'pot', name: 'Healing', definitionId: 'heal', potionType: 'health', potency: 1, identified: true });
    player.addItem(potion);
    player.energy = 0; // a deferred turn: the brutes move before the hero can

    const result = engine.handlePlayerAction(new DrinkPotionAction(player, potion));

    expect(engine.gameState.runStatus).toBe('fallen'); // the brutes' round killed the hero
    expect(result).toMatchObject({ success: false, cost: 0, message: 'You have perished.' });
    expect(player.inventory.getAllCarriedItems().some((i) => i.id === 'pot')).toBe(true);
  });
});

describe('R-pipe-22 · a potion’s apply_status respects the drinker’s immunities', () => {
  it('a hero immune to slow is not slowed by a potion that applies slow', () => {
    const { engine, player } = build(50);
    (player as unknown as { statusImmunities: string[] }).statusImmunities.push('slow');
    expect(player.isImmuneTo('slow')).toBe(true);
    const paste = new PotionItem({
      id: 'paste',
      name: 'Birch-Tar Paste',
      definitionId: 'birch_tar_paste',
      potionType: 'custom',
      identified: true,
      effects: [{ type: 'apply_status', status: 'slow', duration: 4 }],
    } as never);
    player.addItem(paste);

    engine.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: paste.id } });

    expect(player.statusManager.hasStatus('slow')).toBe(false);
  });
});
