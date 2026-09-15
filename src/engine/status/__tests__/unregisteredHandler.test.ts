import { describe, it, expect } from 'vitest';
import { StatusManager } from '../statusManager';
import { StatusHandlerRegistry } from '../statusHandlers';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';

/**
 * ARCHITECTURE.md registry-contract audit: applyStatus()/tick() accepting a status type
 * with no registered StatusHandler was flagged as a possible silent failure. Investigated
 * and deliberately left unchanged (not a bug fix) — `StatusType` is documented as "an open
 * string to allow manifest-defined status effects" (status/types.ts), and the engine itself
 * relies on handler-less, duration-9999 "flag" statuses as an intentional pattern: see
 * src/engine/actors/energyModel.ts's `tissue_necrosis`/`neural_decay`/`loss_of_divine_wards`
 * corruption afflictions, which have no StatusHandler and are read entirely via
 * `hasStatus()` checks elsewhere (healing efficiency, damage multipliers, resistance
 * removal — see energyModel.test.ts). There is no runtime signal that distinguishes a
 * deliberate handler-less flag status from a typo'd content status type, so making this
 * throw (or even warn) at the engine layer would either break that mechanic or spam the
 * flight recorder for entirely normal gameplay. This test documents the current, retained
 * behavior so it stays a visible, deliberate decision rather than an unexamined gap.
 */
describe('Status types with no registered StatusHandler (documented, not changed)', () => {
  function setupEngine() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player });
    return { engine, player };
  }

  const UNREGISTERED_STATUS = 'no_such_status_handler';

  it('StatusHandlerRegistry genuinely has no entry for the type used below', () => {
    expect(StatusHandlerRegistry.get(UNREGISTERED_STATUS)).toBeUndefined();
  });

  it('applyStatus() still accepts an unregistered status type and hasStatus() reflects it', () => {
    const mgr = new StatusManager();
    expect(mgr.applyStatus(UNREGISTERED_STATUS, 5)).toBe(true);
    expect(mgr.hasStatus(UNREGISTERED_STATUS)).toBe(true);
  });

  it('tick() decrements duration with no damage/message from a missing onTick, and a generic expiry message', () => {
    const mgr = new StatusManager();
    const { engine, player } = setupEngine();
    mgr.applyStatus(UNREGISTERED_STATUS, 1);

    const result = mgr.tick(player, engine);

    expect(result.damageTaken).toBe(0);
    expect(result.killed).toBe(false);
    expect(result.expired).toContain(UNREGISTERED_STATUS);
    expect(result.messages.some((m) => m.includes('has worn off'))).toBe(true);
  });

  it('a permanent (duration 9999) handler-less status persists indefinitely and stays queryable via hasStatus() — the corruption-flag pattern this design intentionally supports', () => {
    const mgr = new StatusManager();
    const { engine, player } = setupEngine();
    mgr.applyStatus(UNREGISTERED_STATUS, 9999);

    for (let i = 0; i < 50; i++) {
      mgr.tick(player, engine);
    }

    expect(mgr.hasStatus(UNREGISTERED_STATUS)).toBe(true);
  });
});
