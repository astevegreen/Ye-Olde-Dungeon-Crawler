import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { WaitAction } from '../../actions/wait';
import { getTimedEventCountdowns } from '../timedEvents';
import type { TimedEventDefinition } from '../../types/manifest';

const EVENT: TimedEventDefinition = {
  id: 'ritual',
  label: 'THE RITUAL',
  startFlag: 'ritual_started',
  turnLimit: 5,
  resolvedFlag: 'ritual_resolved',
  expireConsequences: [],
};

function buildEngine(def: TimedEventDefinition = EVENT) {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
  const engine = new GameEngine({ map: new GameMap(10, 10, TILES.FLOOR), player });
  (engine.manifest as { timedEvents?: TimedEventDefinition[] }).timedEvents = [def];
  const wait = () => engine.handlePlayerAction(new WaitAction(player));
  return { engine, wait };
}

describe('getTimedEventCountdowns', () => {
  it('is empty until the start flag is set', () => {
    const { engine } = buildEngine();
    expect(getTimedEventCountdowns(engine)).toEqual([]);
  });

  it('tracks the engine tick turn for turn, and disappears when the event expires', () => {
    const { engine, wait } = buildEngine();
    engine.setWorldFlag('ritual_started', true);
    expect(getTimedEventCountdowns(engine)).toEqual([{ id: 'ritual', label: 'THE RITUAL', turnsRemaining: 5 }]);

    const seen: number[] = [];
    while (!engine.getWorldFlag('ritual_resolved') && seen.length < 20) {
      wait();
      seen.push(getTimedEventCountdowns(engine)[0]?.turnsRemaining ?? -1);
    }
    // One fewer each turn, and gone (-1) on the tick where the engine expires it.
    expect(seen).toEqual([5, 4, 3, 2, 1, -1]);
  });

  it('hides unlabelled events', () => {
    const { engine } = buildEngine({ ...EVENT, label: undefined });
    engine.setWorldFlag('ritual_started', true);
    expect(getTimedEventCountdowns(engine)).toEqual([]);
  });
});
