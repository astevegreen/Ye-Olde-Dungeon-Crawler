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
  it.fails('three potions drunk from an open menu cost as many orc attacks as three drunk outside it', () => {
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
});

describe('R-pipe-7 · a stun of N turns costs a monster only N-1 turns', () => {
  it.fails('an orc stunned for 1 turn loses one attack over five rounds', () => {
    const { engine, player } = build(100);
    const orc = addOrc(engine, 3, 2);
    orc.statusManager.applyStatus('stunned', 1);

    for (let t = 0; t < 5; t++) engine.handlePlayerAction(new WaitAction(player));

    expect(orcAttacks(engine)).toBeLessThanOrEqual(4);
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
  it.fails('a potion whose cure_status is "all" purges poison', () => {
    const { engine, player } = build(50);
    player.statusManager.applyStatus({ type: 'poison', duration: 5, potency: 2 }, [], player, engine);
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
  });
});

describe('R-pipe-22 · a potion’s apply_status ignores the drinker’s immunities', () => {
  it.fails('a hero immune to slow is not slowed by a potion that applies slow', () => {
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
