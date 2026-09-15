import { describe, it, expect } from 'vitest';
import { flightRecorder, registerSerializeGameFn } from '../flightRecorder';
import { serializeGame } from '../../storage/serializer';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';

function buildEngine(): GameEngine {
  return new GameEngine({
    map: new GameMap(8, 8, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } }),
  });
}

describe('FlightRecorder.generateReport snapshot failure path', () => {
  it('still returns a report, noting the snapshot failure, when no serializer is registered', () => {
    const engine = buildEngine();
    registerSerializeGameFn(null as any);
    try {
      let report = '';
      expect(() => {
        report = flightRecorder.generateReport(engine);
      }).not.toThrow();
      expect(report).toContain('## 5. Reproducible State Snapshot');
      expect(report).toContain('Failed to serialize game state snapshot: serializeGame is not registered');
    } finally {
      registerSerializeGameFn(serializeGame);
    }
  });

  it('embeds the JSON snapshot when the serializer is registered', () => {
    const report = flightRecorder.generateReport(buildEngine());
    expect(report).toContain('```json');
    expect(report).not.toContain('Failed to serialize game state snapshot');
  });
});
