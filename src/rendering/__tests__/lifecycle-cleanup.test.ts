import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../input-handler';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine } from '../../engine/engine';
import { GameMap } from '../../engine/grid/map';
import { TILES } from '../../engine/grid/tile';
import { Player } from '../../engine/entities/player';

class MockEventTarget {
  public listeners: Map<string, Set<(e: any) => void>> = new Map();

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string; [key: string]: any }) {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of Array.from(list)) {
        listener(event);
      }
    }
  }

  getListenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function createMockCanvas(eventTarget: MockEventTarget): HTMLCanvasElement {
  const dummyCtx: any = new Proxy(
    {
      measureText: vi.fn(() => ({ width: 50 })),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    },
    {
      get(target: any, prop: string) {
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          return vi.fn(() => ({ addColorStop: vi.fn() }));
        }
        if (prop in target) {
          return target[prop];
        }
        return vi.fn();
      },
      set(target: any, prop: string, value: any) {
        target[prop] = value;
        return true;
      },
    }
  );

  return {
    getContext: () => dummyCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: (type: string, fn: any) => eventTarget.addEventListener(type, fn),
    removeEventListener: (type: string, fn: any) => eventTarget.removeEventListener(type, fn),
    width: 800,
    height: 600,
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;
}

describe('Scene & Listener Lifecycle Cleanup', () => {
  let mockWindow: MockEventTarget;
  let originalWindow: any;
  let originalDocument: any;

  beforeEach(() => {
    mockWindow = new MockEventTarget();
    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;
    (globalThis as any).window = mockWindow;
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return createMockCanvas(new MockEventTarget());
        }
        return {};
      },
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  it('InputHandler unbinds keydown listener when destroyed', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'p', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
    const engine = new GameEngine({ map, player });

    expect(mockWindow.getListenerCount('keydown')).toBe(0);

    const handler = new InputHandler(engine, () => {});
    expect(mockWindow.getListenerCount('keydown')).toBe(1);

    handler.destroy();
    expect(mockWindow.getListenerCount('keydown')).toBe(0);
    expect(handler.enabled).toBe(false);
  });

  it('prevents listener stacking across 10 successive scene transitions', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'p', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
    const engine = new GameEngine({ map, player });

    let activeHandler: InputHandler | null = null;
    let actionCalls = 0;

    for (let i = 0; i < 10; i++) {
      // Destroy previous scene handler
      if (activeHandler) {
        activeHandler.destroy();
      }

      // Create new scene handler
      activeHandler = new InputHandler(engine, () => {
        actionCalls++;
      });
      expect(mockWindow.getListenerCount('keydown')).toBe(1);
    }

    // Fire one keydown event
    mockWindow.dispatchEvent({
      type: 'keydown',
      code: 'KeyW',
      preventDefault: () => {},
    });

    // Only the active handler processed the action, exactly once!
    expect(actionCalls).toBe(1);

    // Clean up
    activeHandler?.destroy();
    expect(mockWindow.getListenerCount('keydown')).toBe(0);
  });

  it('CanvasRenderer unbinds canvas click listener and unhooks engine callbacks on destroy', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'p', name: 'Hero', position: { x: 1, y: 1 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
    const engine = new GameEngine({ map, player });

    const canvasTarget = new MockEventTarget();
    const mockCanvas = createMockCanvas(canvasTarget);

    expect(canvasTarget.getListenerCount('click')).toBe(0);
    expect(engine.onNpcInteract).toBeUndefined();

    const renderer = new CanvasRenderer(mockCanvas, engine);
    expect(canvasTarget.getListenerCount('click')).toBe(1);
    expect(engine.onNpcInteract).toBeDefined();
    expect(engine.onFloorChanged).toBeDefined();

    renderer.destroy();
    expect(canvasTarget.getListenerCount('click')).toBe(0);
    expect(engine.onNpcInteract).toBeUndefined();
    expect(engine.onFloorChanged).toBeUndefined();
  });
});
