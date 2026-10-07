import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { ChannelRuneOfReturnAction, RuneOfReturnItem } from '../../magic/runeOfReturn';
import { ExecuteChoiceAction } from '../../actions/choiceAction';
import { WaitAction } from '../../actions/wait';
import { flightRecorder } from '../flightRecorder';
import { loadReplayState, rebuildAction } from '../replay';

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
