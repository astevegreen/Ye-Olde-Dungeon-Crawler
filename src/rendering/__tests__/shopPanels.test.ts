import { describe, it, expect, vi } from 'vitest';
import { GameEngine, GameMap, Player, NPC } from '../../engine';
import { resolveThemeTokens } from '../theme';
import {
  renderTempleServices,
  renderSageServices,
  renderBankerServices,
  renderTrainerServices,
  renderTownspersonDialog,
  renderFooter,
  type ClickZone,
  type ShopPanelBounds,
  type ShopPanelContext,
} from '../shop';

/**
 * Covers the shop panels extracted out of `ShopOverlay` (Task 4.3).
 *
 * `ShopOverlay` had no test file at all before this, so the extraction of
 * ~440 lines of vendor-screen rendering was invisible to the suite: the
 * action rewiring (`this.executeX(engine)` -> `actions.x()`) could have been
 * wired to the wrong callback and every gate would still have passed.
 *
 * Each panel is a plain function taking an explicit context, which is what
 * makes this testable at all — that testability is the point of the split.
 */
function mockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 40 })),
    drawImage: vi.fn(),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1.0,
  } as unknown as CanvasRenderingContext2D;
}

function testEngine(): GameEngine {
  return new GameEngine({
    map: new GameMap(30, 30),
    player: new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    }),
    floor: 0,
  });
}

const BOUNDS: ShopPanelBounds = { modalX: 20, modalY: 20, modalW: 600, modalH: 480, startY: 80 };

function harness() {
  const zones: ClickZone[] = [];
  const panel: ShopPanelContext = {
    theme: resolveThemeTokens(undefined),
    addClickZone: (z) => zones.push(z),
  };
  return { zones, panel, ctx: mockCtx(), engine: testEngine() };
}

describe('extracted shop panels', () => {
  it('renders every vendor panel without throwing, and draws text', () => {
    const npc = new NPC({
      id: 'villager',
      name: 'Villager',
      position: { x: 6, y: 5 },
      role: 'villager',
      dialogText: 'Good morrow.',
    });

    const cases: Array<[string, () => void]> = [
      ['temple', () => {
        const h = harness();
        renderTempleServices(h.ctx, h.engine, BOUNDS, h.panel, {
          cleanseCurses: vi.fn(), healRestore: vi.fn(),
        });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
      ['sage', () => {
        const h = harness();
        renderSageServices(h.ctx, h.engine, BOUNDS, h.panel, {
          identify: vi.fn(), runAdvisory: vi.fn(), close: vi.fn(), openCompendium: vi.fn(),
        });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
      ['banker', () => {
        const h = harness();
        renderBankerServices(h.ctx, h.engine, BOUNDS, { coinItems: [], coinWeightGrams: 0 }, h.panel, {
          compactCoins: vi.fn(),
        });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
      ['trainer', () => {
        const h = harness();
        renderTrainerServices(h.ctx, h.engine, BOUNDS, h.panel, {
          bondCompanion: vi.fn(), reviveCompanion: vi.fn(),
          switchArchetype: vi.fn(), teachRallyHowl: vi.fn(),
        });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
      ['townsperson', () => {
        const h = harness();
        renderTownspersonDialog(h.ctx, h.engine, BOUNDS, { activeNpc: npc }, h.panel, {
          close: vi.fn(), openRuneTree: vi.fn(),
        });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
      ['footer', () => {
        const h = harness();
        renderFooter(h.ctx, h.engine, BOUNDS, {
          coins: { platinum: 1, gold: 2, silver: 3, copper: 4 },
          totalCp: 1234, coinWeightGrams: 500,
          statusMessage: 'Trade complete.', statusColor: '#38bdf8',
        }, h.panel, { close: vi.fn() });
        expect(h.ctx.fillText).toHaveBeenCalled();
      }],
    ];

    for (const [name, run] of cases) {
      expect(() => run(), `${name} panel threw`).not.toThrow();
    }
  });

  it('wires each temple click zone to its own service action', () => {
    // Clicking every zone and counting totals would pass even if the two
    // actions were swapped, so assert per zone: the cleanse button must fire
    // cleanse and nothing else.
    const h = harness();
    const cleanseCurses = vi.fn();
    const healRestore = vi.fn();
    renderTempleServices(h.ctx, h.engine, BOUNDS, h.panel, { cleanseCurses, healRestore });

    expect(h.zones).toHaveLength(2);

    h.zones[0].action();
    expect(cleanseCurses).toHaveBeenCalledTimes(1);
    expect(healRestore).not.toHaveBeenCalled();

    h.zones[1].action();
    expect(healRestore).toHaveBeenCalledTimes(1);
    expect(cleanseCurses).toHaveBeenCalledTimes(1);
  });

  it('wires each trainer click zone to its own service action', () => {
    const h = harness();
    const bondCompanion = vi.fn();
    const reviveCompanion = vi.fn();
    const switchArchetype = vi.fn();
    const teachRallyHowl = vi.fn();
    renderTrainerServices(h.ctx, h.engine, BOUNDS, h.panel, {
      bondCompanion, reviveCompanion, switchArchetype, teachRallyHowl,
    });

    // Every registered zone must resolve to exactly one distinct action.
    const all = [bondCompanion, reviveCompanion, switchArchetype, teachRallyHowl];
    for (const zone of h.zones) {
      all.forEach((fn) => fn.mockClear());
      zone.action();
      const fired = all.filter((fn) => fn.mock.calls.length > 0);
      expect(fired).toHaveLength(1);
    }
  });

  it('wires the banker click zone to coin compaction', () => {
    const h = harness();
    const compactCoins = vi.fn();
    renderBankerServices(h.ctx, h.engine, BOUNDS, { coinItems: [], coinWeightGrams: 0 }, h.panel, {
      compactCoins,
    });

    expect(h.zones).toHaveLength(1);
    h.zones[0].action();
    expect(compactCoins).toHaveBeenCalledTimes(1);
  });

  it('renders the footer status message through the supplied data', () => {
    const h = harness();
    renderFooter(h.ctx, h.engine, BOUNDS, {
      coins: { platinum: 0, gold: 0, silver: 0, copper: 0 },
      totalCp: 0, coinWeightGrams: 0,
      statusMessage: 'Cursed item cleansed!', statusColor: '#f87171',
    }, h.panel, { close: vi.fn() });

    const drawn = (h.ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(drawn).toContain('Cursed item cleansed!');
  });
});
