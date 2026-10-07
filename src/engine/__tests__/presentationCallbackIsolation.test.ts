import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { WaitAction } from '../actions/wait';
import { DeathResolver } from '../combat/deathResolver';

/**
 * R-pipe-17: only actions, monster turns and environmental updates ran inside a failure
 * boundary. A presentation callback the engine calls inline (onGameEvent, onFloorChanged,
 * onVisualEffect, onDiscoveryEvent, onMessageLogged), the stunned hero's forced pass and the
 * turn's FOV updates threw straight out, some mid-resolution: a throwing `entity_killed`
 * subscriber stopped a death after the XP and before the corpse left the map.
 */

function setup() {
  const map = GameMap.createBoxRoom(14, 14);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 } });
  const goblin = new Monster({ id: 'goblin', name: 'Goblin', position: { x: 9, y: 9 }, stats: { hp: 5, maxHp: 5, attack: 1, defense: 0 } });
  goblin.faction = 'hostile';
  map.addEntity(goblin);
  const engine = new GameEngine({ map, player, floor: 1 });
  return { engine, player, goblin, map };
}

const boom = () => {
  throw new Error('presentation fell over');
};

describe('R-pipe-17 · presentation callbacks and the forced pass are isolated', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a throwing entity_killed subscriber does not stop the death halfway', () => {
    const { engine, player, goblin, map } = setup();
    engine.onGameEvent = boom;
    const failures = engine.actionPipeline.caughtExceptionCount;

    expect(() => DeathResolver.resolveDeath(engine, player, goblin)).not.toThrow();

    expect(map.getEntityById('goblin')).toBeFalsy();
    expect(engine.actionPipeline.caughtExceptionCount).toBeGreaterThan(failures);
  });

  it('a throwing onFloorChanged does not undo or fail the floor change', () => {
    const { engine } = setup();
    engine.onFloorChanged = boom;
    expect(() => engine.changeFloor(2)).not.toThrow();
    expect(engine.currentFloor).toBe(2);
  });

  it('a throwing onVisualEffect or onDiscoveryEvent does not escape', () => {
    const { engine } = setup();
    engine.onVisualEffect = boom;
    engine.onDiscoveryEvent = boom;
    expect(() => engine.recordVisualEffects([{ type: 'flash', x: 1, y: 1 } as never])).not.toThrow();
    expect(() => engine.emitDiscovery({ type: 'close_call', text: 'x', icon: '!' })).not.toThrow();
  });

  it('a throwing onMessageLogged neither escapes nor loops on its own failure line', () => {
    const { engine } = setup();
    const calls = vi.fn(boom);
    engine.onMessageLogged = calls;
    expect(() => engine.log('hello')).not.toThrow();
    expect(calls.mock.calls.length).toBeLessThanOrEqual(2);
    expect(engine.messages).toContain('hello');
  });

  it('a stunned hero\'s forced pass that throws still passes the turn', () => {
    const { engine, player } = setup();
    player.statusManager.applyStatus({ type: 'stunned', duration: 3 });
    vi.spyOn(WaitAction.prototype, 'perform').mockImplementation(boom);
    const turn = engine.turnCount;

    expect(() => engine.handlePlayerAction(new WaitAction(player))).not.toThrow();
    expect(engine.turnCount).toBe(turn + 1);
  });

  it('a turn\'s FOV update that throws doesn\'t stop the monsters moving', () => {
    const { engine, player } = setup();
    const real = engine.updateFov.bind(engine);
    let once = true;
    vi.spyOn(engine, 'updateFov').mockImplementation(() => {
      if (once) {
        once = false;
        throw new Error('fov fell over');
      }
      real();
    });
    const turn = engine.turnCount;

    expect(() => engine.handlePlayerAction(new WaitAction(player))).not.toThrow();
    expect(engine.turnCount).toBe(turn + 1);
  });
});
