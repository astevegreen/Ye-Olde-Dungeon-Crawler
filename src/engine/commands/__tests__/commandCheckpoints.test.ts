import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { PotionItem } from '../../items/consumables';
import { WaitAction } from '../../actions/wait';
import { flightRecorder } from '../../debug/flightRecorder';

/**
 * Review 2026-10-06 C4 (R-dbg-3/4/5/8, R-main-15): a command that changes state without a
 * player action is not in the replay trail, so it asks for a checkpoint; the replay then
 * starts from the state it left.
 */
function setup(seed = 9) {
  const player = new Player({ id: 'hero', position: { x: 2, y: 2 } });
  const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player, seed });
  for (const id of ['a', 'b']) {
    player.inventory.primaryPack.addItem(
      new PotionItem({ id: `pot-${id}`, name: `Healing ${id}`, definitionId: `heal-${id}`, potionType: 'health', potency: 1, identified: true, quantity: 5 } as never)
    );
  }
  flightRecorder.requestCheckpoint('test');
  engine.handlePlayerAction(new WaitAction(player));
  return { engine, player };
}

describe('a command outside the action pipeline checkpoints', () => {
  it.each([
    ['sort_pack', { mode: 'name' }],
    ['mark_junk', { itemId: 'pot-a' }],
    ['split_stack', { itemId: 'pot-a', amount: 2 }],
  ])('%s', (type, payload) => {
    const { engine } = setup();
    expect(engine.commandBus.dispatch({ type, payload }).success).toBe(true);

    expect(flightRecorder.getReplayData(engine)?.checkpoint.reason).toBe(`command: ${type}`);
    expect(flightRecorder.getReplayData(engine)?.trail).toEqual([]);
  });

  it('a command that is a player action is in the trail instead', () => {
    const { engine } = setup();
    engine.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: 'pot-b' } });

    const replay = flightRecorder.getReplayData(engine);
    expect(replay?.checkpoint.reason).toBe('test');
    expect(replay?.trail.map((e) => e.action)).toEqual(['WaitAction', 'DrinkPotionAction']);
  });

  it('a failed or read-only command does not', () => {
    const { engine } = setup();
    engine.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'pot-a', amount: 99 } });
    engine.commandBus.dispatch({ type: 'sage_advisory' });
    engine.commandBus.dispatch({ type: 'consolidate_coins' }); // no loose coins: nothing changed

    expect(flightRecorder.getReplayData(engine)?.checkpoint.reason).toBe('test');
  });

  it('splitting a stack spends no draw from the simulation PRNG (R-dbg-4)', () => {
    const plain = setup(21).engine;
    const split = setup(21).engine;
    split.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'pot-a', amount: 1 } });
    split.commandBus.dispatch({ type: 'split_stack', payload: { itemId: 'pot-a', amount: 1 } });

    expect(split.rng()).toBe(plain.rng());
    expect(split.player.inventory.findItemById('pot-a-split-1')).toBeTruthy();
    expect(split.player.inventory.findItemById('pot-a-split-2')).toBeTruthy();
  });
});
