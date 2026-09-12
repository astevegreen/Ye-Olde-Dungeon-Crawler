import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntentOverlay } from '../intentOverlay';
import { Camera } from '../camera';
import { CanvasFXRunner } from '../fxRunner';
import { CanvasRenderer } from '../canvas-renderer';
import { FovManager } from '../../engine';
import { Visibility } from '../../engine';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { TILES } from '../../engine';
import { Player } from '../../engine';
import { Monster } from '../../engine';
import { WindUpDeclareAction, WindUpExecuteAction } from '../../engine';
import { computeDangerTiles } from '../../engine';

function createMockContext(): CanvasRenderingContext2D {
  return new Proxy(
    {
      measureText: vi.fn(() => ({ width: 50 })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      canvas: { width: 800, height: 600 },
    } as any,
    {
      get(target: any, prop: string) {
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          return vi.fn(() => ({ addColorStop: vi.fn() }));
        }
        if (prop in target) return target[prop];
        return vi.fn();
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  );
}

function createMockCanvas(): HTMLCanvasElement {
  const ctx = createMockContext();
  return {
    getContext: vi.fn(() => ctx),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
    width: 800,
    height: 600,
    style: {},
  } as unknown as HTMLCanvasElement;
}

let originalDocument: any;

beforeEach(() => {
  originalDocument = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return createMockCanvas();
      }
      return {};
    },
  };
});

afterEach(() => {
  (globalThis as any).document = originalDocument;
});

describe('Render & Engine Defensive Resilience Tests', () => {
  describe('FovManager undefined coordinate resilience', () => {
    it('safely handles undefined, null, or NaN coordinates in getVisibility', () => {
      const fov = new FovManager(20, 20);
      expect(fov.getVisibility(undefined as any, undefined as any)).toBe(Visibility.Unexplored);
      expect(fov.getVisibility(5, undefined as any)).toBe(Visibility.Unexplored);
      expect(fov.getVisibility(undefined as any, 5)).toBe(Visibility.Unexplored);
      expect(fov.getVisibility(NaN, NaN)).toBe(Visibility.Unexplored);
      expect(fov.getVisibility(-1, -1)).toBe(Visibility.Unexplored);
      expect(fov.getVisibility(100, 100)).toBe(Visibility.Unexplored);
    });

    it('safely ignores undefined or NaN coordinates in setVisibility without throwing', () => {
      const fov = new FovManager(20, 20);
      expect(() => {
        fov.setVisibility(undefined as any, undefined as any, Visibility.Visible);
        fov.setVisibility(5, undefined as any, Visibility.Visible);
        fov.setVisibility(NaN, 5, Visibility.Visible);
      }).not.toThrow();
    });
  });

  describe('Camera undefined target resilience', () => {
    it('safely handles undefined or malformed target in update', () => {
      const camera = new Camera(20, 15);
      expect(() => {
        camera.update(undefined as any, 50, 50);
        camera.update(null as any, 50, 50);
        camera.update({} as any, 50, 50);
        camera.update({ x: undefined as any, y: 5 }, 50, 50);
      }).not.toThrow();
    });

    it('returns null for worldToScreen or screenToWorld with undefined or NaN', () => {
      const camera = new Camera(20, 15);
      expect(camera.worldToScreen(undefined as any, 5, 32)).toBeNull();
      expect(camera.worldToScreen(5, NaN, 32)).toBeNull();
      expect(camera.screenToWorld(undefined as any, 5, 32)).toBeNull();
      expect(camera.screenToWorld(5, NaN, 32)).toBeNull();
    });
  });

  describe('IntentOverlay undefined target resilience', () => {
    it('safely renders without throwing when monster has malformed or missing windup coordinates', () => {
      const map = new GameMap(30, 30, TILES.FLOOR);
      const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
      const engine = new GameEngine({ map, player });

      const monster = new Monster({
        id: 'kobold_test',
        name: 'Kobold',
        position: { x: 7, y: 7 },
        stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      });
      map.addEntity(monster);

      const overlay = new IntentOverlay();
      const ctx = createMockContext();
      const camera = new Camera(25, 18);

      // Scenario 1: Intent is windup with undefined targetTile and undefined targetTiles
      monster.intent = { type: 'windup', turnsRemaining: 1 };
      expect(() => {
        overlay.render(ctx, engine, camera, 32, 0, 0);
      }).not.toThrow();

      // Scenario 2: targetTiles array contains undefined
      monster.intent = {
        type: 'windup',
        targetTiles: [undefined as any, null as any],
        turnsRemaining: 1,
      };
      expect(() => {
        overlay.render(ctx, engine, camera, 32, 0, 0);
      }).not.toThrow();

      // Scenario 3: targetTile is object without numeric x/y
      monster.intent = {
        type: 'windup',
        targetTile: {} as any,
        targetTiles: [{} as any],
        turnsRemaining: 1,
      };
      expect(() => {
        overlay.render(ctx, engine, camera, 32, 0, 0);
      }).not.toThrow();

      // Scenario 4: Valid targetTile renders properly
      monster.intent = {
        type: 'windup',
        targetTile: { x: 5, y: 5 },
        targetTiles: [{ x: 5, y: 5 }],
        abilityName: 'Power Slash',
        turnsRemaining: 1,
      };
      expect(() => {
        overlay.render(ctx, engine, camera, 32, 0, 0);
      }).not.toThrow();
    });
  });

  describe('CanvasFXRunner malformed descriptor resilience', () => {
    it('safely creates and renders effects with missing epicenter or empty paths', () => {
      const runner = new CanvasFXRunner({ mode: 'smooth' });
      const camera = new Camera(25, 18);
      const ctx = createMockContext();

      // Burst missing epicenter
      expect(() => {
        runner.playEffects([
          {
            type: 'burst',
            epicenter: undefined as any,
            radius: 2,
            color: '#ff0000',
            durationMs: 100,
          },
        ]);
      }).not.toThrow();

      // Projectile with path containing undefined entries
      expect(() => {
        runner.playEffects([
          {
            type: 'projectile',
            path: [undefined as any, { x: 5, y: 5 }, null as any],
            color: '#00ff00',
            stepDelayMs: 20,
          },
        ]);
      }).not.toThrow();

      // Chain link missing from / to
      expect(() => {
        runner.playEffects([
          {
            type: 'chain_link',
            from: undefined as any,
            to: undefined as any,
            color: '#ffff00',
            durationMs: 100,
          },
        ]);
      }).not.toThrow();

      // Calling render does not throw
      expect(() => {
        runner.render(ctx, camera, 32, 0, 0);
      }).not.toThrow();

      runner.destroy();
    });
  });

  describe('WindUp Action coordinate sanitation', () => {
    it('WindUpDeclareAction sanitizes undefined or empty target coordinates', () => {
      const map = new GameMap(30, 30, TILES.FLOOR);
      const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
      const engine = new GameEngine({ map, player });

      const monster = new Monster({
        id: 'kobold_test',
        name: 'Kobold',
        position: { x: 7, y: 7 },
        stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      });

      const declareAction = new WindUpDeclareAction(
        monster,
        undefined as any,
        'Heavy Swing',
        'Warning!',
        { targetTiles: [undefined as any] }
      );

      const res = declareAction.perform(engine);
      expect(res.success).toBe(true);
      expect(monster.intent?.type).toBe('windup');
      expect(monster.intent?.targetTiles).toEqual([]);

      const executeAction = new WindUpExecuteAction(
        monster,
        undefined as any,
        'Heavy Swing',
        2.0
      );

      const execRes = executeAction.perform(engine);
      expect(execRes.success).toBe(true);
    });

    it('computeDangerTiles safely returns empty array if origin or target is malformed', () => {
      const map = new GameMap(30, 30, TILES.FLOOR);
      expect(computeDangerTiles(undefined as any, { x: 5, y: 5 }, 'blast', map)).toEqual([]);
      expect(computeDangerTiles({ x: 5, y: 5 }, undefined as any, 'line', map)).toEqual([]);
      expect(computeDangerTiles({ x: NaN, y: 5 }, { x: 5, y: 5 }, 'cross', map)).toEqual([]);
    });
  });

  describe('CanvasRenderer full render cycle resilience', () => {
    it('renders without throwing when world contains monsters with undefined intent properties', () => {
      const map = new GameMap(30, 30, TILES.FLOOR);
      const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
      const engine = new GameEngine({ map, player });

      const kobold = new Monster({
        id: 'kobold_1',
        name: 'Kobold',
        position: { x: 6, y: 5 },
        stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      });
      // Malformed intent
      kobold.intent = {
        type: 'windup',
        targetTile: undefined,
        targetTiles: [undefined as any],
        turnsRemaining: 1,
      };
      map.addEntity(kobold);

      const canvas = createMockCanvas();
      const renderer = new CanvasRenderer(canvas, engine);

      expect(() => {
        renderer.render();
      }).not.toThrow();

      renderer.destroy();
    });
  });
});
