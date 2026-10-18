import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { ChannelRuneOfReturnAction, RuneOfReturnItem } from '../../magic/runeOfReturn';
import { ExecuteChoiceAction } from '../../actions/choiceAction';
import { WaitAction } from '../../actions/wait';
import { flightRecorder } from '../flightRecorder';
import { loadReplayState, rebuildAction, replayActionTrail } from '../replay';
import { AutoRestManager } from '../../actions/autoRest';

/**
 * Whole-codebase review, 2026-10-06, area 10 (replay): regression guards. Two player actions
 * reached `handlePlayerAction`, so they were recorded in the trail, but `replay.ts` had no
 * builder for them, so a replay stopped at the first one. R-dbg-1: a Rune of Return channel
 * is now rebuilt. R-dbg-2: a dialog choice stays out of the trail, and a checkpoint taken
 * once it resolves carries its outcome (owner decision 10; ARCHITECTURE.md §2). R-dbg-10: a
 * replay of a god-mode session loads an invulnerable hero.
 */

function lastEntry(engine: GameEngine) {
  const trail = flightRecorder.getReplayData(engine)?.trail ?? [];
  return trail[trail.length - 1];
}

describe('R-dbg-1 · ChannelRuneOfReturnAction has a replay builder', () => {
  it('a recorded Rune of Return channel can be rebuilt', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
    player.hasDiscoveredRune = true;
    player.hp = 50;
    player.inventory.primaryPack.addItem(new RuneOfReturnItem({ id: 'rune-1', name: 'Rune of Return' } as never));
    const engine = new GameEngine({ map, player, floor: 3 });
    flightRecorder.requestCheckpoint('review');

    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    const entry = lastEntry(engine);
    expect(entry?.action).toBe('ChannelRuneOfReturnAction'); // recorded
    expect(rebuildAction(engine, entry)).not.toBeNull();
  });
});

// Owner decision 10: a dialog choice is stripped from the trail, and a checkpoint is taken
// once it resolves, so the replay starts from the state the choice left.
describe('R-dbg-2 · ExecuteChoiceAction stays out of the trail, and a checkpoint carries its outcome (§2)', () => {
  const choice = {
    id: 'review_choice',
    title: 'A fork',
    description: 'Left or right?',
    options: [{ id: 'left', label: 'Left', consequences: [{ type: 'setFlag', flag: 'went_left', value: true }] }],
  };
  const setup = () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 1 });
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player));
    return { engine, player };
  };

  it('a dialog choice is not in the trail; the next action starts a checkpoint that holds its outcome', () => {
    const { engine, player } = setup();

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice as never, 'left'));
    engine.handlePlayerAction(new WaitAction(player));

    const replay = flightRecorder.getReplayData(engine);
    expect(replay?.checkpoint.reason).toBe('dialog choice');
    expect(replay?.trail.map((e) => e.action)).toEqual(['WaitAction']);
    expect(JSON.stringify(replay?.checkpoint.save)).toContain('went_left');
  });

  it('a report filed straight after the choice already has the checkpoint', () => {
    const { engine, player } = setup();

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice as never, 'left'));

    const replay = flightRecorder.getReplayData(engine);
    expect(replay?.checkpoint.reason).toBe('dialog choice');
    expect(replay?.trail).toEqual([]);
  });
});

describe('R-dbg-10 · a replay of a god-mode session loads an invulnerable hero', () => {
  it('the checkpoint carries god mode and loading the replay restores it', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
    const engine = new GameEngine({ map, player, floor: 1 });
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player));
    engine.diagnostics.toggleGodMode();
    engine.handlePlayerAction(new WaitAction(player));

    const json = flightRecorder.exportReplayJson(engine);
    expect(json).not.toBeNull();
    const loaded = loadReplayState(json!);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.engine.player.isInvulnerable).toBe(true);
  });

  it('a mortal session replays mortal', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 1 });
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player));

    const loaded = loadReplayState(flightRecorder.exportReplayJson(engine)!);
    expect(loaded.ok && loaded.value.engine.player.isInvulnerable).toBe(false);
  });
});

// The save holds the compendium twice (under `profile` and at the top level); the
// checkpoint's writer took the second copy for a cycle and wrote "[Circular]", which won on load.
describe('a replay checkpoint keeps the bestiary and mastery perks', () => {
  it("a checkpoint loads back with the hero's compendium", () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 1, seed: 1 });
    engine.compendium.recordEncounter('goblin', 'Goblin', 1);
    flightRecorder.requestCheckpoint('review');
    engine.handlePlayerAction(new WaitAction(player));

    const rd = flightRecorder.getReplayData(engine)!;
    const save = rd.checkpoint.save as Record<string, unknown>;
    expect(save.compendium).toEqual(engine.compendium.serialize());
    expect(save.compendiumCategoryPerks).toEqual(engine.compendium.serializeCategoryPerks());

    const loaded = loadReplayState(JSON.stringify(rd));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.engine.compendium.serialize()).toEqual(engine.compendium.serialize());
  });
});

// A full rest settles the Void Debt after its last trailed rest turn; the replay rebuilt only
// the turns, each worth one point of debt, so it kept nearly all of it.
describe('a replay of a full rest ends with the debt the live run has', () => {
  it('the settle reaches the replay through a checkpoint', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const engine = new GameEngine({ map, player, floor: 1, seed: 1 });
    engine.handlePlayerAction(new WaitAction(player));
    player.accrueVoidDebt(10);
    player.hp = player.maxHp - 1;
    player.mana = player.maxMana;
    flightRecorder.requestCheckpoint('overcast aftermath');

    expect(AutoRestManager.executeFullRest(engine, 100).interrupted).toBe(false);
    expect(player.voidDebt).toBe(0);

    const loaded = loadReplayState(JSON.stringify(flightRecorder.getReplayData(engine)));
    if (!loaded.ok) throw new Error(loaded.message);
    replayActionTrail(loaded.value.engine, loaded.value.trail);
    expect(loaded.value.engine.player.voidDebt).toBe(0);
    expect(loaded.value.engine.player.hp).toBe(player.hp);
  });
});
