import { describe, expect, it, vi } from 'vitest';
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

describe('R-dbg-15 · Restore Vitals reports what it restored', () => {
  it('fills the hero despite a worn healing multiplier, and says so', () => {
    const engine = newGame();
    const p = engine.player;
    p.hp = 1;
    vi.spyOn(p, 'heal').mockImplementation(() => 0); // a multiplier that heals nothing
    const restored = engine.diagnostics.restoreVitals();
    expect(p.hp).toBe(p.maxHp);
    expect(restored.hp).toBe(p.maxHp - 1);
  });

  it('claims nothing for a dead hero', () => {
    const engine = newGame();
    engine.player.hp = 0;
    expect(engine.diagnostics.restoreVitals().hp).toBe(0);
    expect(engine.player.hp).toBe(0);
  });
});

describe('R-dbg-11 · a triage operation that throws still leaves a checkpoint', () => {
  it('records and requests the checkpoint before the throw goes on', () => {
    const engine = newGame();
    const requested = vi.spyOn(flightRecorder, 'requestCheckpoint');
    vi.spyOn(engine.map, 'getAllEntities').mockImplementation(() => {
      throw new Error('death hook blew up');
    });
    expect(() => engine.diagnostics.killVisibleMonsters()).toThrow('death hook blew up');
    expect(requested).toHaveBeenCalledWith('F2 triage: killVisibleMonsters');
    vi.restoreAllMocks();
  });
});
