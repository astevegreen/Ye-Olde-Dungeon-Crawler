import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { cotwManifest } from '../../content/cotw';

function engineInTown(seed: number): GameEngine {
  return new GameEngine({
    map: new GameMap(50, 35, TILES.FLOOR),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
    manifest: cotwManifest,
    seed,
    floor: 0,
  });
}

/** The lines logged while changing to `floor`. */
function arrivalLines(engine: GameEngine, floor: number): string[] {
  const last = engine.messages[engine.messages.length - 1];
  engine.changeFloor(floor);
  const from = engine.messages.lastIndexOf(last) + 1;
  return engine.messages.slice(from);
}

describe('the floor-arrival line', () => {
  it('says the hero climbed when they went up a floor', () => {
    const engine = engineInTown(7);
    engine.changeFloor(1);
    engine.changeFloor(2);
    const lines = arrivalLines(engine, 1);
    expect(lines.join('\n')).not.toMatch(/descend/i);
    expect(lines.join('\n')).toMatch(/Floor 1/);
  });

  it('comes before what the hero sees on arrival', () => {
    // Several seeds, so some arrivals have a monster in view.
    for (let seed = 1; seed <= 12; seed++) {
      const engine = engineInTown(seed);
      for (const floor of [1, 2, 3]) {
        const lines = arrivalLines(engine, floor);
        expect(lines[0], `seed ${seed}, floor ${floor}: ${lines.join(' | ')}`).toMatch(new RegExp(`Floor ${floor}`));
      }
    }
  });
});
