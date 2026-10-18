import { describe, it, expect } from 'vitest';
import { GameStateManager } from '../gameStateManager';
import { GameEngine } from '../../engine';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { MemoryStorage } from '../../storage/profile-manager';
import { Leaderboard } from '../../hallOfFame/leaderboard';
import { cotwManifest } from '../../../content/cotw';

describe('the death log line', () => {
  it("names the pack's hall of fame and writes the score as the death screen does", () => {
    const gameState = new GameStateManager(new Leaderboard(new MemoryStorage()));
    const engine = new GameEngine({
      map: new GameMap(20, 20, TILES.FLOOR),
      player: new Player({ id: 'hero', name: 'Ulfr', position: { x: 5, y: 5 } }),
      manifest: cotwManifest,
      floor: 0,
      gameState,
    });
    gameState.updateFloor(30);

    const entry = gameState.triggerDeath(engine);

    expect(entry.score).toBeGreaterThanOrEqual(1000);
    const line = engine.messages[engine.messages.length - 1];
    expect(line).toBe(`Your name is etched in the ${cotwManifest.branding!.hallOfFameName} with ${entry.score.toLocaleString()} points.`);
  });
});
