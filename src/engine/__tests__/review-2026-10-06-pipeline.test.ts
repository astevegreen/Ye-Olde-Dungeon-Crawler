import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Item } from '../items/item';
import { PotionItem } from '../items/consumables';
import { WaitAction } from '../actions/wait';
import { MovementAction } from '../actions/movement';
import { ClimbStairsAction } from '../actions/stairs';
import { AutoRestManager } from '../actions/autoRest';
import { TrapInstance } from '../dungeon/traps';
import { flightRecorder } from '../debug/flightRecorder';
import { rebuildAction } from '../debug/replay';

/**
 * Whole-codebase review, 2026-10-06, area 2 (engine core, pipeline, replay trail). Each
 * test reproduces one finding from `.prompts/codebase-review-2026-10-06/areas/02-pipeline.md`
 * and is marked `it.fails` so the suite stays green until the bug is fixed.
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

    expect(result.pipelineError).toBe(true); // the stairs fail loudly (passes today)
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

describe('R-pipe-4 · the R-key rest (stepRestTurn) never enters the replay trail', () => {
  it('a 40-turn rest adds entries to the action trail', () => {
    const { engine, player } = build(50);
    player.hp = 10;
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player)); // opens the trail (checkpoint + 1 entry)
    const before = flightRecorder.getReplayData(engine)?.trail.length ?? 0;
    const turnsBefore = engine.turnCount;

    AutoRestManager.executeFullRest(engine, 40);

    expect(engine.turnCount).toBeGreaterThan(turnsBefore); // the world moved (passes today)
    expect(flightRecorder.getReplayData(engine)?.trail.length ?? 0).toBeGreaterThan(before);
  });
});

describe('R-pipe-5 · a free auto-pickup replays as a costed pickup', () => {
  it('the rebuilt PickUpAction keeps freeAction: true', () => {
    const { engine, player, map } = build(50);
    map.addItemAt(player.x, player.y, new Item({ id: 'junk1', name: 'Rock', category: 'misc', weight: 10, bulk: 1, identified: true }));
    flightRecorder.requestCheckpoint('review');

    engine.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: 'junk1', freeAction: true } });

    const trail = flightRecorder.getReplayData(engine)?.trail ?? [];
    const entry = trail[trail.length - 1];
    expect(entry?.params?.freeAction).toBe(true); // recorded (passes today)
    const rebuilt = rebuildAction(engine, entry) as { freeAction?: boolean } | null;
    expect(rebuilt?.freeAction).toBe(true); // but not rebuilt
  });
});

describe('R-pipe-6 · item actions taken while the engine is paused (menu open) cost no monster turns', () => {
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

describe('R-pipe-7 · a stun of N turns costs a monster only N-1 turns', () => {
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

describe('R-pipe-8 · a monster killed by a trap is never resolved (dormant: no production trap placement)', () => {
  it('a rat killed by a pit trap is removed from the map', () => {
    const { engine, map } = build(50);
    const rat = new Monster({ id: 'rat', name: 'Rat', position: { x: 8, y: 8 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 }, speed: 100, definitionId: 'rat', aiType: 'melee' });
    map.addEntity(rat);
    map.addTrap(new TrapInstance({ id: 't', type: 'pit', x: 9, y: 8, damage: 10 }));

    new MovementAction(rat, 1, 0).perform(engine);

    expect(rat.isAlive()).toBe(false); // the trap killed it (passes today)
    expect(map.getEntityById('rat')).toBeNull();
  });
});

describe('R-pipe-11 · cure_status "all" removes a status literally named "all"', () => {
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

describe('R-pipe-22 · a potion’s apply_status ignores the drinker’s immunities', () => {
  it('a hero immune to slow is not slowed by a potion that applies slow', () => {
    const { engine, player } = build(50);
    (player as unknown as { statusImmunities: string[] }).statusImmunities.push('slow');
    expect(player.isImmuneTo('slow')).toBe(true); // (passes today)
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
