import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player } from '../../engine';

describe('HUD status badge rendering', () => {
  let originalDocument: any;
  let fillCalls: { text: string; fillStyle: string }[] = [];
  let currentFillStyle = '#000000';

  function createMockContext(): CanvasRenderingContext2D {
    return new Proxy(
      {
        measureText: vi.fn(() => ({ width: 50 })),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        canvas: { width: 800, height: 600 },
        fillText: vi.fn((text: string) => {
          fillCalls.push({ text, fillStyle: currentFillStyle });
        }),
      } as any,
      {
        get(target: any, prop: string) {
          if (prop === 'fillStyle') return currentFillStyle;
          if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
            return vi.fn(() => ({ addColorStop: vi.fn() }));
          }
          if (prop in target) return target[prop];
          return vi.fn();
        },
        set(target: any, prop: string, value: any) {
          if (prop === 'fillStyle') currentFillStyle = value;
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

  beforeEach(() => {
    fillCalls = [];
    currentFillStyle = '#000000';
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

  it('renders custom manifest status effect with name and hudColor', () => {
    const manifest = {
      id: 'test_pack',
      name: 'Test Pack',
      version: '1.0.0',
      description: 'Test Pack Manifest',
      statusEffects: [
        { id: 'test:glow', name: 'Glow', hudColor: '#123456' },
      ],
    } as any;

    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    player.statusManager.applyStatus({ type: 'test:glow', duration: 10 });
    const engine = new GameEngine({ map, player, manifest });

    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    const glowCall = fillCalls.find((c) => c.text.includes('GLOW'));
    expect(glowCall).toBeDefined();
    expect(glowCall?.text).toBe('[GLOW 10t]');
    expect(glowCall?.fillStyle).toBe('#123456');

    renderer.destroy();
  });

  it('renders ambient status (duration >= 9999) without turns countdown', () => {
    const manifest = {
      id: 'test_pack',
      name: 'Test Pack',
      version: '1.0.0',
      description: 'Test Pack Manifest',
      statusEffects: [
        { id: 'test:glow', name: 'Glow', hudColor: '#123456' },
      ],
    } as any;

    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    player.statusManager.applyStatus({ type: 'test:glow', duration: 9999 });
    const engine = new GameEngine({ map, player, manifest });

    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    const glowCall = fillCalls.find((c) => c.text === '[GLOW]');
    expect(glowCall).toBeDefined();
    expect(glowCall?.fillStyle).toBe('#123456');

    renderer.destroy();
  });
});
