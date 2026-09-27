import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { GameEngine, GameMap, TILES, Player, Container, Item } from '../../engine';

describe('Ground container badge rendering', () => {
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

  function makeChest(id = 'test-chest'): Container {
    return new Container({
      id,
      name: 'Ironbound Chest',
      category: 'container',
      containerType: 'chest',
      weight: 8000,
      bulk: 12000,
      maxWeightCapacity: 50000,
      maxBulkCapacity: 35000,
    });
  }

  it('renders a gold star on an unopened ground chest holding items', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    const chest = makeChest();
    chest.addItem(new Item({ id: 'gem-1', name: 'Ruby', category: 'gem', weight: 50, bulk: 20 }));
    map.addItemAt(6, 5, chest);

    const engine = new GameEngine({ map, player });
    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    const starCall = fillCalls.find((c) => c.text === '★');
    expect(starCall).toBeDefined();
    expect(starCall?.fillStyle).toBe('#facc15');

    const checkCall = fillCalls.find((c) => c.text === '✓');
    expect(checkCall).toBeUndefined();

    renderer.destroy();
  });

  it('renders an amber dot on an opened chest that still contains items (never a checkmark)', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    const chest = makeChest();
    chest.addItem(new Item({ id: 'rune-1', name: 'Rune of Return', category: 'quest', weight: 50, bulk: 20 }));
    chest.markOpened();
    map.addItemAt(6, 5, chest);

    const engine = new GameEngine({ map, player });
    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    const dotCall = fillCalls.find((c) => c.text === '•');
    expect(dotCall).toBeDefined();
    expect(dotCall?.fillStyle).toBe('#f59e0b');

    // Must NOT have a checkmark indicating empty
    const checkCall = fillCalls.find((c) => c.text === '✓');
    expect(checkCall).toBeUndefined();

    renderer.destroy();
  });

  it('renders a grey checkmark once the chest is completely empty', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    const chest = makeChest();
    chest.markOpened();
    map.addItemAt(6, 5, chest);

    const engine = new GameEngine({ map, player });
    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    const checkCall = fillCalls.find((c) => c.text === '✓');
    expect(checkCall).toBeDefined();
    expect(checkCall?.fillStyle).toBe('#94a3b8');

    const starCall = fillCalls.find((c) => c.text === '★');
    expect(starCall).toBeUndefined();

    renderer.destroy();
  });

  it('handles multi-item loot piles with containers accurately', () => {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    const chest = makeChest();
    chest.addItem(new Item({ id: 'sword-1', name: 'Shortsword', category: 'weapon', weight: 500, bulk: 300 }));
    chest.markOpened();
    const looseCoin = new Item({ id: 'loose-coin', name: 'Gold Coin', category: 'currency', weight: 5, bulk: 2 });
    map.addItemAt(6, 5, looseCoin);
    map.addItemAt(6, 5, chest);

    const engine = new GameEngine({ map, player });
    const canvas = createMockCanvas();
    const renderer = new CanvasRenderer(canvas, engine);
    renderer.render();

    // Since the chest inside the pile still has items, it must show amber dot, never a checkmark
    const dotCall = fillCalls.find((c) => c.text === '•');
    expect(dotCall).toBeDefined();
    expect(dotCall?.fillStyle).toBe('#f59e0b');

    const checkCall = fillCalls.find((c) => c.text === '✓');
    expect(checkCall).toBeUndefined();

    renderer.destroy();
  });
});
