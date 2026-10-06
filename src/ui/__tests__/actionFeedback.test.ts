import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameMap, Player, TILES, ClimbStairsAction, ChannelRuneOfReturnAction, WaitAction } from '../../engine';
import type { Action, ActionResult } from '../../engine';
import { runAndExplain } from '../actionFeedback';

/**
 * Keys the chaos soak found answered with silence: Enter off the stairs and T with no
 * usable Rune of Return returned a reason that nothing logged.
 */
describe('runAndExplain', () => {
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    const map = new GameMap(8, 8);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 3, y: 3 } });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
  });

  const last = () => engine.messages[engine.messages.length - 1];

  it('says why climbing failed with no stairs underfoot', () => {
    const res = runAndExplain(engine, new ClimbStairsAction(player));
    expect(res.success).toBe(false);
    expect(last()).toBe('There are no stairs here to climb.');
  });

  it('says why channelling failed with no Rune of Return', () => {
    runAndExplain(engine, new ChannelRuneOfReturnAction(player));
    expect(last()).toBe('You have no Rune of Return.');
  });

  it("doesn't log a refusal twice when the action logged it already", () => {
    const loud: Action = {
      perform(eng): ActionResult {
        eng.log('Footsteps stir in the forge-smoke behind you.');
        return { success: false, cost: 0, message: 'Footsteps stir in the forge-smoke behind you.' };
      },
    } as Action;
    const before = engine.messages.length;
    runAndExplain(engine, loud);
    expect(engine.messages.length - before).toBe(1);
  });

  it('adds nothing when the action succeeds (a wait logs its own line, once)', () => {
    const before = engine.messages.length;
    const res = runAndExplain(engine, new WaitAction(player));
    expect(res.success).toBe(true);
    expect(engine.messages.slice(before).filter((m) => m === 'Adventurer waits a moment.')).toHaveLength(1);
  });
});
