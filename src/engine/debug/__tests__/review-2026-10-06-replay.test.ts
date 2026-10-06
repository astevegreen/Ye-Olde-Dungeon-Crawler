import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { ChannelRuneOfReturnAction, RuneOfReturnItem } from '../../magic/runeOfReturn';
import { ExecuteChoiceAction } from '../../actions/choiceAction';
import { flightRecorder } from '../flightRecorder';
import { rebuildAction } from '../replay';

/**
 * Whole-codebase review, 2026-10-06, area 10 (replay). Two player actions reach
 * `handlePlayerAction` (so they are recorded in the trail) but `replay.ts` has no builder for
 * them, so a replay stops at the first one. Marked `it.fails` until the builders exist.
 */

function lastEntry(engine: GameEngine) {
  const trail = flightRecorder.getReplayData(engine)?.trail ?? [];
  return trail[trail.length - 1];
}

describe('R-dbg-1 · ChannelRuneOfReturnAction has no replay builder', () => {
  it.fails('a recorded Rune of Return channel can be rebuilt', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
    player.hasDiscoveredRune = true;
    player.hp = 50;
    player.inventory.primaryPack.addItem(new RuneOfReturnItem({ id: 'rune-1', name: 'Rune of Return' } as never));
    const engine = new GameEngine({ map, player, floor: 3 });
    flightRecorder.requestCheckpoint('review');

    engine.handlePlayerAction(new ChannelRuneOfReturnAction(player));

    const entry = lastEntry(engine);
    expect(entry?.action).toBe('ChannelRuneOfReturnAction'); // recorded (passes today)
    expect(rebuildAction(engine, entry)).not.toBeNull();
  });
});

describe('R-dbg-2 · ExecuteChoiceAction is in the trail (contrary to §2) and has no replay builder', () => {
  it.fails('a recorded dialog choice can be rebuilt', () => {
    const map = new GameMap(14, 14, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player, floor: 1 });
    const choice = {
      id: 'review_choice',
      title: 'A fork',
      description: 'Left or right?',
      options: [{ id: 'left', label: 'Left', consequences: [{ type: 'logMessage', message: 'You go left.' }] }],
    };
    flightRecorder.requestCheckpoint('review');

    engine.handlePlayerAction(new ExecuteChoiceAction(player, choice as never, 'left'));

    const entry = lastEntry(engine);
    expect(entry?.action).toBe('ExecuteChoiceAction'); // recorded (passes today)
    expect(rebuildAction(engine, entry)).not.toBeNull();
  });
});
