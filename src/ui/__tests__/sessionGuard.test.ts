import { describe, expect, it } from 'vitest';
import { MemoryStorage, ProfileManager, WaitAction, flightRecorder, loadReplayState, replayActionTrail } from '../../engine';
import { cotwManifest } from '../../content/cotw';
import { SessionGuard } from '../sessionGuard';

function playSomeTurns() {
  const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
  const { engine } = pm.createCharacter('Frozen', { manifest: cotwManifest });
  engine.changeFloor(2);
  for (let i = 0; i < 4; i++) engine.handlePlayerAction(new WaitAction(engine.player));
  return engine;
}

describe('SessionGuard', () => {
  it('reports a session that never exited cleanly, with its replay data and last input', () => {
    const storage = new MemoryStorage();
    const engine = playSomeTurns();
    new SessionGuard(storage, { buildId: 'abc1234' }).noteInput(engine, 'KeyZ');

    // Next launch.
    const record = new SessionGuard(storage, {}).takeUnfinished();
    expect(record?.lastInput).toBe('KeyZ');
    expect(record?.buildId).toBe('abc1234');
    expect(record?.floor).toBe(2);
    expect(record?.replay).not.toBeNull();
    // Taking it clears it.
    expect(new SessionGuard(storage, {}).takeUnfinished()).toBeNull();
  });

  it('does not report a session that ended normally, was hidden, or is old', () => {
    const engine = playSomeTurns();

    const ended = new MemoryStorage();
    const g1 = new SessionGuard(ended, {});
    g1.noteInput(engine, 'KeyA');
    g1.end();
    expect(new SessionGuard(ended, {}).takeUnfinished()).toBeNull();

    const hidden = new MemoryStorage();
    const g2 = new SessionGuard(hidden, {});
    g2.noteInput(engine, 'KeyA');
    g2.setVisible(false); // a phone evicting a background tab is not a freeze
    expect(new SessionGuard(hidden, {}).takeUnfinished()).toBeNull();

    const old = new MemoryStorage();
    new SessionGuard(old, {}).noteInput(engine, 'KeyA');
    expect(new SessionGuard(old, {}).takeUnfinished(Date.now() + 8 * 24 * 3600 * 1000)).toBeNull();
  });

  it('feeds a report, filed from the menu, that replays to where the session stopped', () => {
    const storage = new MemoryStorage();
    const engine = playSomeTurns();
    new SessionGuard(storage, {}).noteInput(engine, 'ArrowUp');
    const record = new SessionGuard(storage, {}).takeUnfinished()!;

    flightRecorder.restoreRecovered(record.replay, record.events);
    const pkg = flightRecorder.generatePackage(undefined, undefined, { scope: 'crash' });
    expect(pkg.reproduction?.floor).toBe(2);
    expect(pkg.markdownReport).toContain('recovered from an earlier session');

    const loaded = loadReplayState(JSON.stringify(pkg), cotwManifest);
    if (!loaded.ok) throw new Error(loaded.message);
    replayActionTrail(loaded.value.engine, loaded.value.trail);
    expect(loaded.value.engine.turnCount).toBe(engine.turnCount);
    expect(loaded.value.engine.prng.getState()).toBe(engine.prng.getState());
  });

  it("doesn't hand one game's replay data to another", () => {
    playSomeTurns();
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine: fresh } = pm.createCharacter('Fresh', { manifest: cotwManifest });
    expect(flightRecorder.getReplayData(fresh)).toBeNull();
    expect(flightRecorder.exportReplayJson(fresh)).toBeNull();
  });
});
