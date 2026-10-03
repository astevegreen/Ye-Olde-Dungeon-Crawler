import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage } from '../profile-manager';
import { serializeGame, deserializeGame } from '../serializer';
import { Monster } from '../../entities/monster';
import { cotwManifest } from '../../../content/cotw';

describe('the cleared-floor respawn timer across save/load', () => {
  it('a reload on a cleared floor does not respawn at once', () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine, profile } = pm.createCharacter('Clearer', { seed: 8 });
    engine.changeFloor(2);
    for (const m of engine.map.getAllEntities()) if (m instanceof Monster && m !== engine.companion) engine.removeEntity(m);
    // Cleared at floor turn 100; 10 turns later, well inside the 60-turn interval.
    engine.map.floorTurnCount = 100;
    engine.floorManager.checkClearedFloorRespawn(engine);
    expect(engine.map.isCleared).toBe(true);
    engine.map.floorTurnCount = 110;

    const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(engine, profile))), cotwManifest).engine;

    expect(loaded.floorManager.checkClearedFloorRespawn(loaded)).toHaveLength(0);
  });
});
