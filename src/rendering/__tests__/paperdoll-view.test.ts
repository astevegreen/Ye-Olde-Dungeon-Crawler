import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaperdollView } from '../paperdoll-view';
import { InventoryOverlay } from '../inventory-overlay';
import { GameEngine } from '../../engine/engine';
import { GameMap } from '../../engine/grid/map';
import { Player } from '../../engine/entities/player';
import { Item } from '../../engine/items/item';
import { resolveThemeTokens } from '../theme';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px monospace',
    textAlign: 'left',
    textBaseline: 'top',
    globalAlpha: 1.0,
  } as unknown as CanvasRenderingContext2D;
}

describe('PaperdollView & 4-Column Stationary Layout', () => {
  let engine: GameEngine;
  let theme: ReturnType<typeof resolveThemeTokens>;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({
      id: 'test-hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player });
    theme = resolveThemeTokens();
    mockCtx = createMockContext();
  });

  describe('PaperdollView Rendering', () => {
    it('renders anatomical paperdoll layout and all 14 equipment slot boxes', () => {
      const view = new PaperdollView();
      const doll = engine.player.inventory.paperdoll;

      view.render(mockCtx, doll, 12, 36, 220, 390, theme, {});

      // Verify header text rendered
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'CHARACTER PAPERDOLL',
        expect.any(Number),
        expect.any(Number)
      );

      // Verify slot borders stroked (14 equipment slots + header)
      expect(mockCtx.strokeRect).toHaveBeenCalled();
      const strokeCalls = (mockCtx.strokeRect as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      expect(strokeCalls.length).toBeGreaterThanOrEqual(14);
    });

    it('hit-tests slot positions accurately via getSlotAtPosition()', () => {
      const view = new PaperdollView();
      const doll = engine.player.inventory.paperdoll;

      // Head slot anchor is layout: { x: 93, y: 16, width: 34, height: 34 }
      // With origin at (12, 36), content origin is (12, 36 + 26) = (12, 62)
      // Head slot bounding box is x: 12 + 93 = 105, y: 62 + 16 = 78, w: 34, h: 34
      const hit = view.getSlotAtPosition(110, 85, 12, 36, doll);
      expect(hit).toBeDefined();
      expect(hit?.slotId).toBe('head');

      // Click outside all slots
      const miss = view.getSlotAtPosition(0, 0, 12, 36, doll);
      expect(miss).toBeNull();
    });

    it('displays equipped item and badges (+X enchantment and cursed [C])', () => {
      const view = new PaperdollView();
      const doll = engine.player.inventory.paperdoll;

      const enchBlade = new Item({
        id: 'blade-plus-3',
        name: 'Frostblade',
        category: 'weapon',
        weight: 1200,
        bulk: 500,
        enchantmentLevel: 3,
      });
      doll.equip(enchBlade, 'mainHand');

      view.render(mockCtx, doll, 12, 36, 220, 390, theme, {});

      // Verify +3 enchantment badge is rendered
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '+3',
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe('InventoryOverlay Integration & Elimination of Floating Tooltips', () => {
    it('initializes with PaperdollView and stationary ItemInspector', () => {
      const overlay = new InventoryOverlay();
      expect(overlay.paperdollView).toBeInstanceOf(PaperdollView);
      expect(overlay.inspector).toBeDefined();
    });

    it('renders 4 columns and does NOT render any floating hover tooltips', () => {
      const overlay = new InventoryOverlay();
      overlay.open(engine);

      // Select an item into inspector
      const testItem = new Item({
        id: 'test-helm',
        name: 'Bronze Helm',
        category: 'helmet',
        weight: 1000,
        bulk: 500,
      });
      overlay.inspector.select(testItem, 'backpack');

      overlay.render(mockCtx, engine, 960, 600);

      // Verify titlebar rendered
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('EQUIPMENT, INVENTORY & GROUND LOOT'),
        expect.any(Number),
        expect.any(Number)
      );

      // Verify stationary ITEM INSPECTOR pane rendered
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        'ITEM INSPECTOR',
        expect.any(Number),
        expect.any(Number)
      );

      // Confirm renderTooltip was removed and does not exist on overlay
      expect((overlay as unknown as Record<string, unknown>)['renderTooltip']).toBeUndefined();
      expect(overlay.hoveredItem).toBe(testItem); // backwards-compatible getter returns inspector item
    });

    it('handles keyboard navigation: Tab cycles panels and Arrow keys navigate', () => {
      const overlay = new InventoryOverlay();
      overlay.open(engine);

      expect(overlay.inspector.focusedPanel).toBe('paperdoll');

      overlay.handleKeyDown('Tab', engine);
      expect(overlay.inspector.focusedPanel).toBe('backpack');

      overlay.handleKeyDown('Tab', engine);
      expect(overlay.inspector.focusedPanel).toBe('ground');

      overlay.handleKeyDown('Tab', engine);
      expect(overlay.inspector.focusedPanel).toBe('inspector');

      overlay.handleKeyDown('Tab', engine);
      expect(overlay.inspector.focusedPanel).toBe('paperdoll');
    });

    it('handles KeyE to equip from backpack and unequip from paperdoll', () => {
      const overlay = new InventoryOverlay();
      overlay.open(engine);
      const p = engine.player;

      const dagger = new Item({
        id: 'test-dagger',
        name: 'Steel Dagger',
        category: 'weapon',
        weight: 400,
        bulk: 200,
      });
      p.inventory.primaryPack.addItem(dagger);

      // Select dagger in backpack
      overlay.inspector.select(dagger, 'backpack');
      expect(p.inventory.paperdoll.getItem('mainHand')).toBeNull();

      // Press KeyE -> should equip dagger
      overlay.handleKeyDown('KeyE', engine);
      expect(p.inventory.paperdoll.getItem('mainHand')?.id).toBe('test-dagger');

      // Select equipped dagger in paperdoll
      overlay.inspector.select(p.inventory.paperdoll.getItem('mainHand'), 'paperdoll', 'mainHand');

      // Press KeyE -> should unequip dagger
      overlay.handleKeyDown('KeyE', engine);
      expect(p.inventory.paperdoll.getItem('mainHand')).toBeNull();
      expect(p.inventory.primaryPack.getItem('test-dagger')).toBeDefined();
    });

    it('handles right click quick unequip on paperdoll slot and quick equip on backpack row', () => {
      const overlay = new InventoryOverlay();
      overlay.open(engine);
      const p = engine.player;

      const robe = new Item({
        id: 'linen-robe',
        name: 'Linen Robe',
        category: 'armor',
        weight: 600,
        bulk: 400,
      });
      p.inventory.paperdoll.equip(robe, 'torso');

      // Render to populate rightClickZones
      overlay.render(mockCtx, engine, 960, 600);

      // Torso slot anchor is at x: 93, y: 104 in Col 1 (Col 1 x is modalX + 12 = 32)
      // Content Y is 66 + 26 = 92. So torso is at x: 32 + 93 = 125, y: 92 + 104 = 196
      const handled = overlay.handleRightClick(135, 205, engine);
      expect(handled).toBe(true);

      // Item should be unequipped to pack
      expect(p.inventory.paperdoll.getItem('torso')).toBeNull();
      expect(p.inventory.primaryPack.getItem('linen-robe')).toBeDefined();
    });
  });
});
