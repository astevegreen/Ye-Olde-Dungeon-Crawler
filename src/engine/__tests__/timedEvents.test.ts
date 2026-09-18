import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { WaitAction } from '../actions/wait';
import type { TimedEventDefinition } from '../types/manifest';

/**
 * Turn-limited world events (ARCHITECTURE.md §3) — ticked every player turn via
 * `GameEngine`'s `'timed-events-tick'` environmental update, independent of the
 * action pipeline/modals, so the countdown runs while the player does anything else.
 */
function buildEngine(timedEvents: TimedEventDefinition[]) {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
  });
  const engine = new GameEngine({ map, player });
  (engine.manifest as any).timedEvents = timedEvents;
  return { engine, player };
}

const OATH_EVENT: TimedEventDefinition = {
  id: 'oath_climax',
  startFlag: 'oath_climax_started',
  turnLimit: 3,
  resolvedFlag: 'oath_resolved',
  expireConsequences: [
    { type: 'setFlag', flag: 'oath_defaulted', value: true },
    { type: 'modifyPermanentStat', stat: 'defense', delta: -2 },
  ],
  expireMessage: 'Hesitation costs you.',
};

describe('Timed world events', () => {
  it('does nothing before its start flag is set', () => {
    const { engine } = buildEngine([OATH_EVENT]);
    for (let i = 0; i < 10; i++) {
      engine.handlePlayerAction(new WaitAction(engine.player));
    }
    expect(engine.getWorldFlag('oath_resolved')).toBe(false);
    expect(engine.getWorldFlag('oath_defaulted')).toBe(false);
  });

  it('fires expireConsequences exactly turnLimit turns after the start flag is observed true, if unresolved', () => {
    const { engine, player } = buildEngine([OATH_EVENT]);
    const baseDefense = player.baseDefenseValue;

    engine.setWorldFlag('oath_climax_started', true);

    // Turn 1 (this is turn zero of the countdown — the tick that first observes the flag).
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.getWorldFlag('oath_resolved')).toBe(false);

    // Turn 2
    engine.handlePlayerAction(new WaitAction(player));
    expect(engine.getWorldFlag('oath_resolved')).toBe(false);

    // Turn 3: turnCount - startTurn (2) is not yet >= turnLimit (3)... one more turn needed.
    engine.handlePlayerAction(new WaitAction(player));

    // Turn 4: now turnCount - startTurn >= 3 -> expires.
    engine.handlePlayerAction(new WaitAction(player));

    expect(engine.getWorldFlag('oath_defaulted')).toBe(true);
    expect(engine.getWorldFlag('oath_resolved')).toBe(true);
    expect(player.baseDefenseValue).toBe(baseDefense - 2);
  });

  it('is skipped entirely if resolvedFlag is already set before the timer expires', () => {
    const { engine, player } = buildEngine([OATH_EVENT]);
    const baseDefense = player.baseDefenseValue;

    engine.setWorldFlag('oath_climax_started', true);
    engine.handlePlayerAction(new WaitAction(player)); // turn zero

    // Player resolves the oath manually (e.g. via a real choice/altar trigger)
    // before the countdown runs out.
    engine.setWorldFlag('oath_resolved', true);

    for (let i = 0; i < 10; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }

    // expireConsequences never applied: the flag was already resolved.
    expect(engine.getWorldFlag('oath_defaulted')).toBe(false);
    expect(player.baseDefenseValue).toBe(baseDefense);
  });

  it('never re-fires once it has expired', () => {
    const { engine, player } = buildEngine([OATH_EVENT]);
    engine.setWorldFlag('oath_climax_started', true);
    for (let i = 0; i < 6; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }
    const defenseAfterFirstExpiry = player.baseDefenseValue;
    expect(engine.getWorldFlag('oath_resolved')).toBe(true);

    for (let i = 0; i < 10; i++) {
      engine.handlePlayerAction(new WaitAction(player));
    }
    expect(player.baseDefenseValue).toBe(defenseAfterFirstExpiry);
  });

  it('tracks multiple independent timed events by id', () => {
    const secondEvent: TimedEventDefinition = {
      id: 'second_event',
      startFlag: 'second_started',
      turnLimit: 2,
      resolvedFlag: 'second_resolved',
      expireConsequences: [{ type: 'setFlag', flag: 'second_defaulted', value: true }],
    };
    const { engine, player } = buildEngine([OATH_EVENT, secondEvent]);

    engine.setWorldFlag('second_started', true);
    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));
    engine.handlePlayerAction(new WaitAction(player));

    expect(engine.getWorldFlag('second_resolved')).toBe(true);
    expect(engine.getWorldFlag('second_defaulted')).toBe(true);
    // The oath event was never started, so it stays untouched.
    expect(engine.getWorldFlag('oath_resolved')).toBe(false);
  });
});
