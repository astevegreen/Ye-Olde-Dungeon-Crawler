import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveThemeTokens, COTW_THEME_TOKENS } from '../theme';
import { WARCRAFT_THEME_TOKENS } from '../../content/warcraft/theme';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';
import { NPC } from '../../engine';
import { CanvasRenderer } from '../canvas-renderer';
import { InspectOverlay } from '../inspect-overlay';
import { MapOverlay } from '../map-overlay';
import { InventoryOverlay } from '../inventory-overlay';
import { ShopOverlay } from '../shop-overlay';
import { TargetingOverlay } from '../targeting-overlay';
import { HUDMessageLogRenderer } from '../hud';

function createMockCanvasContext() {
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
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    rect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
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

function createMockCanvas(ctx: CanvasRenderingContext2D) {
  return {
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
    width: 960,
    height: 600,
    style: { width: '960px', height: '600px', imageRendering: 'pixelated' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

function createTestEngine(customManifest?: any): GameEngine {
  const map = new GameMap(30, 30);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 5, y: 5 },
    stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
  });

  return new GameEngine({
    map,
    player,
    floor: 0,
    manifest: customManifest,
  });
}

describe('ThemeTokens and Canvas Renderer Integration', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => createMockCanvasContext(),
        width: 0,
        height: 0,
        style: {},
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('resolveThemeTokens()', () => {
    it('returns canonical COTW tokens when given undefined or empty object', () => {
      const tokensEmpty = resolveThemeTokens();
      expect(tokensEmpty.canvasBg).toBe(COTW_THEME_TOKENS.canvasBg);
      expect(tokensEmpty.hudBg).toBe(COTW_THEME_TOKENS.hudBg);
      expect(tokensEmpty.modalBg).toBe(COTW_THEME_TOKENS.modalBg);
      expect(tokensEmpty.healthBar).toBe(COTW_THEME_TOKENS.healthBar);
      expect(tokensEmpty.manaBar).toBe(COTW_THEME_TOKENS.manaBar);
      expect(tokensEmpty.accent).toBe(COTW_THEME_TOKENS.accent);
    });

    it('preserves complete custom theme tokens such as Warcraft Horde theme', () => {
      const resolved = resolveThemeTokens(WARCRAFT_THEME_TOKENS);
      expect(resolved.canvasBg).toBe(WARCRAFT_THEME_TOKENS.canvasBg);
      expect(resolved.hudBg).toBe(WARCRAFT_THEME_TOKENS.hudBg);
      expect(resolved.hudBorder).toBe(WARCRAFT_THEME_TOKENS.hudBorder);
      expect(resolved.modalBg).toBe(WARCRAFT_THEME_TOKENS.modalBg);
      expect(resolved.modalTitlebar).toBe(WARCRAFT_THEME_TOKENS.modalTitlebar);
      expect(resolved.accent).toBe(WARCRAFT_THEME_TOKENS.accent);
      expect(resolved.healthBar).toBe(WARCRAFT_THEME_TOKENS.healthBar);
      expect(resolved.manaBar).toBe(WARCRAFT_THEME_TOKENS.manaBar);
    });

    it('falls back intelligently for partial token overrides', () => {
      const partial = resolveThemeTokens({
        modalBg: '#112233',
        accent: '#ff00aa',
      });
      // Should use supplied accent and modalBg
      expect(partial.accent).toBe('#ff00aa');
      expect(partial.modalBg).toBe('#112233');
      // Remaining unspecified tokens fall back to defaults
      expect(partial.healthBar).toBe(COTW_THEME_TOKENS.healthBar);
    });

    it('respects flat borderStyle fallbacks', () => {
      const flat = resolveThemeTokens({
        borderStyle: 'flat',
        bg: '#0a0a0a',
        panel: '#1a1a1a',
        text: '#eaeaea',
      });
      expect(flat.canvasBg).toBe('#0a0a0a');
      expect(flat.hudBg).toBe('#0a0a0a');
      expect(flat.modalBg).toBe('#1a1a1a');
      expect(flat.hudText).toBe('#eaeaea');
    });
  });

  describe('CanvasRenderer theme reactivity', () => {
    it('initializes with default COTW theme tokens when engine has no custom theme', () => {
      const ctx = createMockCanvasContext();
      const canvas = createMockCanvas(ctx);
      const engine = createTestEngine();

      const renderer = new CanvasRenderer(canvas, engine);
      expect(renderer.theme.canvasBg).toBe(COTW_THEME_TOKENS.canvasBg);
      expect(renderer.theme.hudBg).toBe(COTW_THEME_TOKENS.hudBg);
      expect(renderer.theme.hudBorder).toBe(COTW_THEME_TOKENS.hudBorder);
    });

    it('reflects manifest theme tokens when engine is loaded with Warcraft theme', () => {
      const ctx = createMockCanvasContext();
      const canvas = createMockCanvas(ctx);
      const warcraftManifest = {
        id: 'warcraft-orcs',
        name: 'Warcraft: Orcs & Humans',
        version: '1.0.0',
        author: 'Blizzard Entertainment / Ported',
        description: 'Azeroth Dungeon Crawl',
        theme: WARCRAFT_THEME_TOKENS,
      };
      const engine = createTestEngine(warcraftManifest);

      const renderer = new CanvasRenderer(canvas, engine);
      expect(renderer.theme.canvasBg).toBe(WARCRAFT_THEME_TOKENS.canvasBg);
      expect(renderer.theme.hudBg).toBe(WARCRAFT_THEME_TOKENS.hudBg);
      expect(renderer.theme.hudBorder).toBe(WARCRAFT_THEME_TOKENS.hudBorder);
      expect(renderer.theme.modalTitlebar).toBe(WARCRAFT_THEME_TOKENS.modalTitlebar);
      expect(renderer.theme.accent).toBe(WARCRAFT_THEME_TOKENS.accent);
    });
  });

  describe('Canvas Overlays Theming', () => {
    it('renders HUDMessageLogRenderer with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
      });

      const hud = new HUDMessageLogRenderer();
      expect(() => hud.render(ctx, engine, 0, 500, 960, 100)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('renders TargetingOverlay with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
      });
      const mockCamera = {
        worldToScreen: () => ({ x: 100, y: 100 }),
      } as any;

      const targeting = new TargetingOverlay();
      targeting.openSpellbook(engine);
      expect(() => targeting.render(ctx, 960, 600, engine, mockCamera, 32, 0, 0)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('renders ShopOverlay with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
        town: { name: 'Orgrimmar' },
      });

      const npc = new NPC({
        id: 'npc_thrall',
        name: 'Thrall',
        position: { x: 5, y: 5 },
        dialogText: 'Greetings.',
        role: 'villager',
      });

      const shop = new ShopOverlay();
      shop.open(npc);
      expect(() => shop.render(ctx, engine, 960, 600)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('renders InventoryOverlay with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
      });

      const inventory = new InventoryOverlay();
      inventory.open(engine);
      expect(() => inventory.render(ctx, engine, 960, 600)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('renders InspectOverlay with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
      });

      const inspect = new InspectOverlay();
      inspect.open(engine);
      const mockCamera = {
        worldToScreen: () => ({ x: 100, y: 100 }),
      } as any;

      expect(() => inspect.render(ctx, 960, 600, engine, mockCamera, 32, 0, 0)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('renders MapOverlay with themed colors without throwing', () => {
      const ctx = createMockCanvasContext();
      const engine = createTestEngine({
        id: 'warcraft-orcs',
        name: 'Warcraft',
        theme: WARCRAFT_THEME_TOKENS,
      });

      const mapViewer = new MapOverlay();
      mapViewer.open(engine);
      expect(() => mapViewer.render(ctx, engine, 960, 600)).not.toThrow();
      expect(ctx.fillRect).toHaveBeenCalled();
    });
  });
});
