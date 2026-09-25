import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../../storage/profile-manager';
import { cotwManifest } from '../../../content/cotw';
import { flightRecorder } from '../flightRecorder';
import { TILES } from '../../grid/tile';

function newGame() {
  const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
  return pm.createCharacter('Triage', { manifest: cotwManifest }).engine;
}

describe('engine.diagnostics triage operations', () => {
  it('teleports to a standable tile at or beside the stairs, including in town', () => {
    for (const floor of [0, 2]) {
      const engine = newGame();
      engine.diagnostics.jumpToFloor(floor);
      const pos = engine.diagnostics.teleportToStairs('down');
      expect(pos, `floor ${floor}`).not.toBeNull();
      expect(engine.player.x).toBe(pos!.x);
      expect(engine.player.y).toBe(pos!.y);
      expect(engine.map.isPassable(pos!.x, pos!.y)).toBe(true);
    }
  });

  it('clamps floor jumps at town', () => {
    const engine = newGame();
    engine.diagnostics.jumpToFloor(2);
    expect(engine.diagnostics.jumpToFloor(-5)).toBe(0);
  });

  it('records each operation in the flight log', () => {
    const engine = newGame();
    engine.diagnostics.restoreVitals();
    const last = flightRecorder.getRecentEvents(1)[0];
    expect(last.details?.category).toBe('triage');
    expect(last.details?.operation).toBe('restoreVitals');
  });

  it('reveals secrets without awarding renown', () => {
    const engine = newGame();
    engine.diagnostics.jumpToFloor(1);
    engine.map.setTile(1, 1, TILES.SECRET_DOOR);
    const worldBefore = JSON.stringify(engine.worldState);
    expect(engine.diagnostics.revealSecrets().doors).toBeGreaterThan(0);
    expect(engine.map.getTile(1, 1)?.type).toBe('door_closed');
    // SearchAction records the secret_door_found milestone in world state; triage must not.
    expect(JSON.stringify(engine.worldState)).toBe(worldBefore);
  });
});
