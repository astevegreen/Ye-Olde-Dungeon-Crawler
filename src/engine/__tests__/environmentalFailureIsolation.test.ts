import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { WaitAction } from '../actions/wait';
import { flightRecorder } from '../debug/flightRecorder';

/**
 * Per-turn environmental updates run inside their own boundary (ARCHITECTURE.md §4).
 * A throwing surface tick, status tick, or spawner must not escape handlePlayerAction,
 * must be recorded, must mark the turn pipelineError, and must not skip the updates
 * that follow it.
 */
const FAULTY_STATUS = 'test_env_faulty_status';

function buildEngine(manifest?: any) {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 100, maxHp: 100, attack: 5, defense: 2 },
  });
  const fullManifest = manifest ? { id: 'test_manifest', name: 'Test Manifest', ...manifest } : undefined;
  return { engine: new GameEngine({ map, player, manifest: fullManifest }), player };
}

const envFailures = () =>
  flightRecorder.getEvents().filter((e) => (e.details as any)?.phase === 'environmental-update');

describe('Environmental update failure isolation (P-06)', () => {
  it('isolates a throwing surface tick and still runs later updates', () => {
    const { engine, player } = buildEngine();
    let substancesTicked = false;
    let floorRespawnTicked = false;
    (engine.surfaces as any).tick = () => {
      throw new Error('SURFACE_TICK_FAULT');
    };
    const realSubstanceTick = engine.substances.tickSubstances.bind(engine.substances);
    (engine.substances as any).tickSubstances = (...args: unknown[]) => {
      substancesTicked = true;
      return (realSubstanceTick as any)(...args);
    };
    (engine.floorManager as any).checkClearedFloorRespawn = () => {
      floorRespawnTicked = true;
      return [];
    };
    const before = envFailures().length;

    let result;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expect(result!.pipelineError).toBe(true);
    expect(substancesTicked).toBe(true);
    expect(floorRespawnTicked).toBe(true);
    const recorded = envFailures();
    expect(recorded.length).toBeGreaterThan(before);
    expect(recorded[recorded.length - 1].summary).toContain('SURFACE_TICK_FAULT');
  });

  it('isolates a throwing player status tick', () => {
    const { engine, player } = buildEngine({
      statusHandlers: {
        [FAULTY_STATUS]: {
          onTick: () => {
            throw new Error('PLAYER_STATUS_FAULT');
          },
        },
      },
    });
    player.statusManager.applyStatus({ type: FAULTY_STATUS, duration: 5 }, [], player, engine);

    let result;
    expect(() => {
      result = engine.handlePlayerAction(new WaitAction(player));
    }).not.toThrow();

    expect(result!.pipelineError).toBe(true);
    expect(envFailures().some((e) => e.summary.includes('PLAYER_STATUS_FAULT'))).toBe(true);
  });

  it('leaves a clean turn unmarked', () => {
    const { engine, player } = buildEngine();

    const result = engine.handlePlayerAction(new WaitAction(player));

    expect(result.success).toBe(true);
    expect(result.pipelineError).toBeFalsy();
  });
});
