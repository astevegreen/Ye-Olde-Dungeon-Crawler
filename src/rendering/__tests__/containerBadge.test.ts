import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasRenderer } from '../canvas-renderer';
import { containerBadgeInks, drawChestBadge } from '../markers/containerBadge';
import type { ContainerState } from '../atlas/fixture-art';
import { resolveThemeTokens } from '../theme';
import { GameEngine, GameMap, TILES, Player, Container, Item } from '../../engine';

describe('Ground container badge rendering', () => {
  let originalDocument: any;

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

  /** The states the map's badges were drawn in, one render of a map holding `place`'s items. */
  function badgeStates(place: (map: GameMap) => void): string[] {
    const map = new GameMap(30, 30, TILES.FLOOR);
    const player = new Player({ id: 'player', name: 'Hero', position: { x: 5, y: 5 } });
    place(map);
    const engine = new GameEngine({ map, player });
    const renderer = new CanvasRenderer(createMockCanvas(), engine);
    const badge = vi.spyOn(renderer as any, 'drawContainerBadge');
    renderer.render();
    const states = badge.mock.calls.map((call) => call[3] as string);
    renderer.destroy();
    return states;
  }

  it('flags an unopened ground chest holding items as unopened', () => {
    const chest = makeChest();
    chest.addItem(new Item({ id: 'gem-1', name: 'Ruby', category: 'gem', weight: 50, bulk: 20 }));
    expect(badgeStates((map) => map.addItemAt(6, 5, chest))).toEqual(['unopened']);
  });

  it('flags an opened chest that still holds items as opened, never empty', () => {
    const chest = makeChest();
    chest.addItem(new Item({ id: 'rune-1', name: 'Rune of Return', category: 'quest', weight: 50, bulk: 20 }));
    chest.markOpened();
    expect(badgeStates((map) => map.addItemAt(6, 5, chest))).toEqual(['opened']);
  });

  it('flags a chest as empty once nothing is left in it', () => {
    const chest = makeChest();
    chest.markOpened();
    expect(badgeStates((map) => map.addItemAt(6, 5, chest))).toEqual(['empty']);
  });

  it('flags a loot pile by the chest in it that still holds items', () => {
    const chest = makeChest();
    chest.addItem(new Item({ id: 'sword-1', name: 'Shortsword', category: 'weapon', weight: 500, bulk: 300 }));
    chest.markOpened();
    const looseCoin = new Item({ id: 'loose-coin', name: 'Gold Coin', category: 'currency', weight: 5, bulk: 2 });
    expect(
      badgeStates((map) => {
        map.addItemAt(6, 5, looseCoin);
        map.addItemAt(6, 5, chest);
      })
    ).toEqual(['opened']);
  });
});

describe('the chest badge', () => {
  const theme = resolveThemeTokens(undefined);

  /** The colours the badge's pixels were filled in, after its dark plate. */
  function badgeInks(state: ContainerState): Set<string> {
    const fills: string[] = [];
    let fillStyle = '';
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      set fillStyle(v: string) {
        fillStyle = v;
      },
      get fillStyle() {
        return fillStyle;
      },
      fillRect: vi.fn(() => fills.push(fillStyle)),
    } as unknown as CanvasRenderingContext2D;
    drawChestBadge(ctx, 0, 0, 32, state, theme);
    return new Set(fills.slice(2));
  }

  const isGrey = (hex: string): boolean => hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);

  it('shows an unopened chest shut, with gold at its lock and a glint', () => {
    const ink = containerBadgeInks('unopened', theme);
    const used = badgeInks('unopened');
    expect(used).toContain(theme.gold);
    expect(used).toContain(ink.G);
    expect(used).not.toContain(ink.L);
  });

  it('shows an opened chest with its lid up and gold inside', () => {
    const ink = containerBadgeInks('opened', theme);
    const used = badgeInks('opened');
    expect(used).toContain(ink.L);
    expect(used).toContain(ink.d);
    expect(used).toContain(theme.gold);
  });

  it('shows an empty chest lid up, all grey, with no gold', () => {
    const used = badgeInks('empty');
    expect(used).toContain(containerBadgeInks('empty', theme).L);
    expect(used).not.toContain(theme.gold);
    for (const c of used) expect(isGrey(c), c).toBe(true);
  });

  it('draws its inks from the theme: a pack that changes the wood changes the chest', () => {
    const red = { ...theme, badgeWood: '#aa2020' };
    expect(containerBadgeInks('unopened', red).w).toBe('#aa2020');
    expect(containerBadgeInks('unopened', red).k).not.toBe(containerBadgeInks('unopened', theme).k);
  });
});
