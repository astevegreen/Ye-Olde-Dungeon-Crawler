import { describe, it, expect, beforeEach } from 'vitest';
import { FlightRecorder } from '../flightRecorder';
import { sanitizePaths } from '../sanitizer';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { cotwManifest } from '../../../content/cotw';

describe('DiagnosticPackage & FlightRecorder Enhancements', () => {
  let recorder: FlightRecorder;

  beforeEach(() => {
    recorder = new FlightRecorder(150);
  });

  it('folds consecutive identical inputs and updates repeatCount', () => {
    recorder.recordInput('ArrowUp', 'MovementAction');
    recorder.recordInput('ArrowUp', 'MovementAction');
    recorder.recordInput('ArrowUp', 'MovementAction');

    const events = recorder.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Key 'ArrowUp' -> MovementAction (x3)");
    expect(events[0].details?.repeatCount).toBe(3);

    // Different input creates a new event
    recorder.recordInput('ArrowLeft', 'MovementAction');
    expect(recorder.getEvents()).toHaveLength(2);
    expect(recorder.getEvents()[1].summary).toBe("Key 'ArrowLeft' -> MovementAction");
  });

  it('does not fold inputs with unique indexed details', () => {
    recorder.recordInput('KeyA', 'Action', { index: 1 });
    recorder.recordInput('KeyA', 'Action', { index: 2 });
    expect(recorder.getEvents()).toHaveLength(2);
  });

  it('generates a concise markdown summary (< 1.5 KB) suitable for URLs and Discord', () => {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({
      id: 'p_test',
      name: 'Valkyrie',
      position: { x: 3, y: 5 },
      stats: { hp: 30, maxHp: 40, attack: 10, defense: 4 },
      mana: 15,
      maxMana: 25,
    });
    const engine = new GameEngine({ map, player, manifest: cotwManifest });

    const summary = recorder.generateSummary(engine, undefined, {
      userNotes: 'Encountered a strange glitch with shadows.',
      error: new Error('Visual glitch: tile shadow missing'),
    });

    expect(summary).toContain('Castle of the Winds');
    expect(summary).toContain('Valkyrie');
    expect(summary).toContain('HP `30/40`');
    expect(summary).toContain('Floor `1` at `(3, 5)`');
    expect(summary).toContain('PRNG State / Seed');
    expect(summary).toContain('Visual glitch: tile shadow missing');
    expect(summary).toContain('Encountered a strange glitch with shadows');
    expect(summary).toContain('Surrounding Area');
    expect(summary.length).toBeLessThan(1500);
  });

  it('generates valid JSON for flight log', () => {
    recorder.recordInput('Space', 'WaitAction');
    recorder.recordCombat('Hero', 'Bat', 4, true);

    const json = recorder.generateFlightLogJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe('input');
    expect(parsed[1].type).toBe('combat');
  });

  it('generates a complete structured DiagnosticPackage with ASCII map and PRNG seed', () => {
    const map = new GameMap(8, 8, TILES.FLOOR);
    map.setTile(2, 2, TILES.WALL);
    map.setTile(2, 3, TILES.DOOR_CLOSED);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player, manifest: cotwManifest });

    recorder.recordInput('KeyZ', 'CastSpell');

    const pkg = recorder.generatePackage(engine, undefined, {
      userNotes: 'Spell projectile halted',
      appVersion: '1.0.0',
      includeSnapshot: false,
    });

    expect(pkg.metadata).toBeDefined();
    expect(pkg.metadata.manifestId).toBe('cotw');
    expect(pkg.metadata.engineVersion).toBe('1.0.0');
    expect(pkg.metadata.turnCount).toBe(0);
    expect(pkg.metadata.floor).toBe(1);
    expect(pkg.metadata.prngState).toBeDefined();
    expect(pkg.summary).toContain('Hero');
    expect(pkg.asciiMap).toBeDefined();
    expect(pkg.asciiMap).toContain('@');
    expect(pkg.asciiMap).toContain('Floor');
    expect(pkg.asciiMap).toContain('Legend');
    expect(pkg.flightLog).toHaveLength(1);
    expect(pkg.flightLog[0].summary).toBe("Key 'KeyZ' -> CastSpell");
    expect(pkg.stateSnapshot).toBeUndefined();
  });

  it('scrubs sensitive user filesystem paths from strings, errors, and traces', () => {
    const winPath = 'Error at C:\\Users\\Alice\\games\\yodc\\src\\main.ts:10';
    expect(sanitizePaths(winPath)).toBe('Error at <user-dir>\\games\\yodc\\src\\main.ts:10');

    const winForwardPath = 'Error at C:/Users/Alice/games/yodc/src/main.ts:10';
    expect(sanitizePaths(winForwardPath)).toBe('Error at <user-dir>/games/yodc/src/main.ts:10');

    const fileUri = 'file:///C:/Users/Alice/dist/index.html:12:4';
    expect(sanitizePaths(fileUri)).toBe('file:///<user-dir>/dist/index.html:12:4');

    const unixMacPath = 'Stack at /Users/Bob/project/file.ts:25';
    expect(sanitizePaths(unixMacPath)).toBe('Stack at <user-dir>/project/file.ts:25');

    const unixLinuxPath = 'Crash at /home/charlie/project/file.ts:88';
    expect(sanitizePaths(unixLinuxPath)).toBe('Crash at <user-dir>/project/file.ts:88');
  });

  it('generates an ASCII map snapshot around the player with entities and legend', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    map.setTile(0, 0, TILES.WALL);
    map.setTile(1, 2, TILES.DOOR_CLOSED);
    const player = new Player({
      id: 'p_hero',
      name: 'Ragnar',
      position: { x: 3, y: 3 },
      stats: { hp: 25, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player, manifest: cotwManifest });

    const asciiMap = recorder.generateAsciiMap(engine, 3);
    expect(asciiMap).not.toBeNull();
    expect(asciiMap).toContain('Floor 1 @ (3, 3):');
    expect(asciiMap).toContain('@');
    expect(asciiMap).toContain('Legend:');
    expect(asciiMap).toContain('[@] Hero (Ragnar, HP: 25/30)');
  });
});
