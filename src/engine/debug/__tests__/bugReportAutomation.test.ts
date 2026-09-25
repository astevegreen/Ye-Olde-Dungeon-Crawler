import { describe, it, expect, beforeEach } from 'vitest';
import { FlightRecorder, flightRecorder } from '../flightRecorder';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { MovementAction } from '../../actions/movement';
import { WaitAction } from '../../actions/wait';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { loadReplayState, replayActionTrail } from '../replay';
import { cotwManifest } from '../../../content/cotw';

function fingerprint(engine: GameEngine): string {
  return JSON.stringify({
    x: engine.player.x,
    y: engine.player.y,
    hp: engine.player.hp,
    turn: engine.turnCount,
    floor: engine.currentFloor,
    prng: engine.prng.getState(),
    mobs: engine.map
      .getAllEntities()
      .map((m) => `${m.id}@${m.x},${m.y}:${m.hp}`)
      .sort(),
  });
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

describe('Bug report scoping', () => {
  let recorder: FlightRecorder;

  beforeEach(() => {
    recorder = new FlightRecorder(150);
  });

  // The events below are the ones the game actually records: engine.ts logs every
  // player action as state/'action', changeFloor logs 'floor_transition', loot
  // spawning logs 'loot_spawn', combat.ts and spell-actions.ts log combat/spell.
  function recordRealisticSession(): void {
    recorder.recordState('action', 'Player performed MovementAction (Success)', { action: 'MovementAction' });
    recorder.recordCombat('Hero', 'Goblin', 8, false);
    recorder.recordState('action', 'Player performed MeleeAttackAction (Success)', { action: 'MeleeAttackAction' });
    recorder.recordSpell('Hero', 'lightning', { x: 6, y: 5 });
    recorder.recordState('action', 'Player performed PickUpAction (Success)', { action: 'PickUpAction' });
    recorder.recordState('floor_transition', 'Transitioned from Floor 1 to Floor 2', { prevFloor: 1, targetFloor: 2 });
    recorder.recordState('loot_spawn', 'Floor 2 Loot Spawned (3 items/chests)', { floor: 2, count: 3 });
    recorder.recordWarning('Autosave failed');
  }

  it('keeps combat, spells and positioning for combat reports, and drops item handling', () => {
    recordRealisticSession();
    const summaries = recorder.getScopedFlightLog('combat').map((e) => e.summary);
    expect(summaries.some((s) => s.includes('Goblin'))).toBe(true);
    expect(summaries.some((s) => s.includes('lightning'))).toBe(true);
    expect(summaries.some((s) => s.includes('MeleeAttackAction'))).toBe(true);
    expect(summaries.some((s) => s.includes('PickUpAction'))).toBe(false);
    expect(summaries.some((s) => s.includes('Autosave failed'))).toBe(true);
  });

  it('keeps item actions and loot for item reports, and drops combat', () => {
    recordRealisticSession();
    const log = recorder.getScopedFlightLog('items');
    expect(log.some((e) => e.summary.includes('PickUpAction'))).toBe(true);
    expect(log.some((e) => e.details?.category === 'loot_spawn')).toBe(true);
    expect(log.some((e) => e.type === 'combat')).toBe(false);
  });

  it('keeps floor transitions for map reports', () => {
    recordRealisticSession();
    const log = recorder.getScopedFlightLog('map');
    expect(log.some((e) => e.details?.category === 'floor_transition')).toBe(true);
    expect(log.some((e) => e.summary.includes('MovementAction'))).toBe(true);
    expect(log.some((e) => e.type === 'spell')).toBe(false);
  });

  it('returns no events when the log is excluded (maxEvents 0), not the whole buffer', () => {
    recordRealisticSession();
    expect(recorder.getScopedFlightLog('crash', 0)).toEqual([]);
    expect(recorder.getScopedFlightLog('visual', 0)).toEqual([]);
    expect(recorder.getRecentEvents(0)).toEqual([]);
  });

  it('returns the whole log for crash reports', () => {
    recordRealisticSession();
    expect(recorder.getScopedFlightLog('crash')).toHaveLength(8);
  });
});

describe('Bug report package', () => {
  let engine: GameEngine;

  beforeEach(() => {
    const map = new GameMap(15, 15, TILES.FLOOR);
    const player = new Player({
      id: 'p_test',
      name: 'TesterHero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 8 },
    });
    engine = new GameEngine({ map, player, manifest: cotwManifest });
  });

  it('omits the map and save for visual reports', () => {
    const pkg = flightRecorder.generatePackage(engine, undefined, { scope: 'visual', category: 'Visual & UI', subject: 'Button alignment' });
    expect(pkg.stateSnapshot).toBeUndefined();
    expect(pkg.asciiMap).toBeUndefined();
    expect(pkg.reproduction?.replay).toBeUndefined();
    expect(pkg.metadata.category).toBe('Visual & UI');
    expect(pkg.metadata.scope).toBe('visual');
  });

  it('carries the save for crash reports', () => {
    const pkg = flightRecorder.generatePackage(engine, undefined, { scope: 'crash', error: new Error('Simulated failure') });
    expect(pkg.stateSnapshot).toBeDefined();
    expect(pkg.markdownReport).toContain('Simulated failure');
  });

  it('names the build it came from', () => {
    const pkg = flightRecorder.generatePackage(engine, undefined, { appVersion: '0.1.0', buildId: 'abc1234' });
    expect(pkg.metadata.buildId).toBe('abc1234');
    expect(pkg.summary).toContain('abc1234');
    expect(pkg.markdownReport).toContain('abc1234');
  });

  it('lists each player action once, with its parameters', () => {
    engine.handlePlayerAction(new MovementAction(engine.player, 1, 0));
    engine.handlePlayerAction(new WaitAction(engine.player));
    const actions = flightRecorder.getRecentActionSequence(2);
    expect(actions).toEqual(['MovementAction dx=1 dy=0', 'WaitAction']);
  });
});

describe('Bug report replay', () => {
  it('reproduces the reported state from checkpoint + trail', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Replayer', { manifest: cotwManifest });
    engine.changeFloor(3);
    for (let i = 0; i < 60; i++) {
      const [dx, dy] = DIRS[(i * 7) % 8];
      engine.handlePlayerAction(i % 5 === 0 ? new WaitAction(engine.player) : new MovementAction(engine.player, dx, dy));
    }
    const reported = fingerprint(engine);

    const pkg = flightRecorder.generatePackage(engine, profile, { scope: 'crash' });
    const replay = pkg.reproduction?.replay;
    expect(replay?.checkpoint.reason).toBe('floor entry');
    expect(replay?.trail).toHaveLength(60);

    // Round-trip through the text a tester would paste.
    const loaded = loadReplayState(JSON.stringify(pkg), cotwManifest);
    if (!loaded.ok) throw new Error(loaded.message);
    expect(loaded.value.source).toBe('replay-checkpoint');
    const result = replayActionTrail(loaded.value.engine, loaded.value.trail);
    expect(result).toEqual({ replayed: 60, total: 60 });
    expect(fingerprint(loaded.value.engine)).toBe(reported);
  });

  it('loads replay data out of a copied Markdown report', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Markdown', { manifest: cotwManifest });
    engine.changeFloor(2);
    engine.handlePlayerAction(new WaitAction(engine.player));
    const markdown = flightRecorder.generateReport(engine, profile, { scope: 'map' });
    expect(markdown).toContain('## 5. Replay Data');

    const loaded = loadReplayState(markdown, cotwManifest);
    expect(loaded.ok && loaded.value.trail).toHaveLength(1);
  });

  it('takes a new checkpoint after a triage change, since the trail cannot replay it', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Triage', { manifest: cotwManifest });
    engine.changeFloor(1);
    engine.handlePlayerAction(new WaitAction(engine.player));
    engine.diagnostics.restoreVitals();
    engine.handlePlayerAction(new WaitAction(engine.player));
    const replay = flightRecorder.getReplayData();
    expect(replay?.checkpoint.reason).toBe('F2 triage: restoreVitals');
    expect(replay?.trail).toHaveLength(1);
  });

  it('reports what it cannot rebuild instead of replaying past it', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Stops', { manifest: cotwManifest });
    const result = replayActionTrail(engine, [
      { seq: 1, turn: 0, floor: 0, action: 'WaitAction', params: {} },
      { seq: 2, turn: 1, floor: 0, action: 'SomePackAction', params: {} },
      { seq: 3, turn: 2, floor: 0, action: 'WaitAction', params: {} },
    ]);
    expect(result.replayed).toBe(1);
    expect(result.stoppedAt?.seq).toBe(2);
    expect(result.stoppedAt?.reason).toContain('no replay builder');
  });

  it('rejects text with nothing loadable in it', () => {
    const loaded = loadReplayState('just some words', cotwManifest);
    expect(loaded.ok).toBe(false);
  });
});
