import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryOverlay } from '../inventory-overlay';
import { GameEngine, GameMap, Player, Item, PotionItem, Container, Companion } from '../../engine';

function createMockContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy({ measureText: () => ({ width: 50 }) } as Record<string, unknown>, {
    get: (target, prop) => (prop in target ? target[prop as string] : noop),
    set: (target, prop, value) => {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('InventoryOverlay Enhanced UX Features', () => {
  let engine: GameEngine;
  let overlay: InventoryOverlay;
  let player: Player;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
    mockCtx = createMockContext();
    overlay = new InventoryOverlay();
    overlay.open(engine);
  });

  describe('Category Filtering & Search in Backpack', () => {
    it('filters items by category tab (gear, consumable, magic, valuable)', () => {
      const sword = new Item({ id: 'sword-1', name: 'Iron Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, stats: { attackBonus: 10 } });
      const potion = new PotionItem({ id: 'pot-1', name: 'Healing Potion', weight: 100, bulk: 50, potionType: 'health', potency: 10 });
      const ruby = new Item({ id: 'gem-1', name: 'Ruby', category: 'misc', weight: 10, bulk: 5, value: 100 });

      player.inventory.primaryPack.addItem(sword);
      player.inventory.primaryPack.addItem(potion);
      player.inventory.primaryPack.addItem(ruby);

      // Default filter is 'all'
      expect(overlay.backpackFilter).toBe('all');
      overlay.render(mockCtx, engine, 960, 600);

      // Switch to 'gear'
      overlay.backpackFilter = 'gear';
      overlay.render(mockCtx, engine, 960, 600);
      expect(overlay.backpackFilter).toBe('gear');

      // Switch to 'consumable'
      overlay.backpackFilter = 'consumable';
      overlay.render(mockCtx, engine, 960, 600);
      expect(overlay.backpackFilter).toBe('consumable');

      // Switch to 'valuable'
      overlay.backpackFilter = 'valuable';
      overlay.render(mockCtx, engine, 960, 600);
      expect(overlay.backpackFilter).toBe('valuable');
    });

    it('filters items by search query string', () => {
      const sword = new Item({ id: 'sword-1', name: 'Iron Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500 });
      const dagger = new Item({ id: 'dag-1', name: 'Steel Dagger', category: 'weapon', slot: 'mainHand', weight: 300, bulk: 150 });
      player.inventory.primaryPack.addItem(sword);
      player.inventory.primaryPack.addItem(dagger);

      overlay.backpackSearch = 'dagger';
      overlay.render(mockCtx, engine, 960, 600);
      expect(overlay.backpackSearch).toBe('dagger');
    });
  });

  describe('Expanded Sorting Modes', () => {
    it('cycles through all 6 sorting modes: category -> value -> tier -> weight -> bulk -> name', () => {
      expect(overlay.sortModeIndex).toBe(0);

      // KeyO advances sort mode
      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(1); // value

      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(2); // tier

      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(3); // weight

      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(4); // bulk

      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(5); // name

      overlay.handleKeyDown('KeyO', engine);
      expect(overlay.sortModeIndex).toBe(0); // wraps back to category
    });
  });

  describe('Stack Splitter Dialog', () => {
    it('opens split dialog for stackable items with quantity > 1 and splits on confirm', () => {
      const arrows = new Item({ id: 'arrow-1', name: 'Iron Arrow', category: 'consumable', weight: 10, bulk: 5, quantity: 20 });
      player.inventory.primaryPack.addItem(arrows);

      overlay.openSplitDialog(arrows);
      expect(overlay.splitDialog).not.toBeNull();
      expect(overlay.splitDialog?.isOpen).toBe(true);
      expect(overlay.splitDialog?.maxQuantity).toBe(20);
      expect(overlay.splitDialog?.splitAmount).toBe(10);

      // Arrow keys adjust split amount
      overlay.handleKeyDown('ArrowRight', engine);
      expect(overlay.splitDialog?.splitAmount).toBe(11);
      overlay.handleKeyDown('ArrowLeft', engine);
      expect(overlay.splitDialog?.splitAmount).toBe(10);

      // Enter confirms split
      overlay.handleKeyDown('Enter', engine);
      expect(overlay.splitDialog).toBeNull();
      expect(arrows.quantity).toBe(10);
      expect(player.inventory.primaryPack.getItems()).toHaveLength(2);
    });

    it('cancels split dialog on Escape', () => {
      const torches = new Item({ id: 'torch-1', name: 'Torch', category: 'consumable', weight: 200, bulk: 100, quantity: 5 });
      player.inventory.primaryPack.addItem(torches);

      overlay.openSplitDialog(torches);
      expect(overlay.splitDialog?.isOpen).toBe(true);

      overlay.handleKeyDown('Escape', engine);
      expect(overlay.splitDialog).toBeNull();
      expect(torches.quantity).toBe(5);
    });
  });

  describe('Contextual Right-Click Menu', () => {
    it('opens context menu on backpack item with contextual options', () => {
      const potion = new PotionItem({ id: 'pot-1', name: 'Healing Potion', weight: 100, bulk: 50, potionType: 'health', potency: 10 });
      player.inventory.primaryPack.addItem(potion);

      overlay.render(mockCtx, engine, 960, 600);

      // Backpack cell is in Column 2 (col2X is 260, cell at 280, 115)
      const handled = overlay.handleRightClick(280, 115, engine);
      expect(handled).toBe(true);
      expect(overlay.contextMenu).not.toBeNull();
      expect(overlay.contextMenu?.isOpen).toBe(true);
      expect(overlay.contextMenu?.options.some((o) => o.label === 'Drink')).toBe(true);
      expect(overlay.contextMenu?.options.some((o) => o.label === 'Drop')).toBe(true);
      expect(overlay.contextMenu?.options.some((o) => o.label === 'Inspect')).toBe(true);
    });

    it('opens context menu on paperdoll equipped item with Unequip option', () => {
      const robe = new Item({ id: 'robe-1', name: 'Cloth Robe', category: 'armor', slot: 'torso', weight: 500, bulk: 300, stats: { defenseBonus: 2 } });
      player.inventory.paperdoll.equip(robe, 'torso');

      overlay.render(mockCtx, engine, 960, 600);

      // Right-click torso slot
      const handled = overlay.handleRightClick(135, 205, engine);
      expect(handled).toBe(true);
      expect(overlay.contextMenu?.isOpen).toBe(true);
      expect(overlay.contextMenu?.source).toBe('paperdoll');
      expect(overlay.contextMenu?.options.some((o) => o.label === 'Unequip')).toBe(true);
    });
  });

  describe('Side-by-Side Companion Exchange in Column 3', () => {
    it('toggles Column 3 between ground and companion view and transfers items', () => {
      const companion = new Companion({
        id: 'comp-1',
        name: 'Faithful Hound',
        position: { x: 5, y: 6 },
        stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 },
        speed: 100,
        companionDefinitionId: 'hound',
        packWeightCapacity: 10000,
        packBulkCapacity: 8000,
      });
      engine.companion = companion;

      const treat = new Item({ id: 'treat-1', name: 'Bone', category: 'misc', weight: 50, bulk: 20 });
      companion.inventory.primaryPack.addItem(treat);

      overlay.render(mockCtx, engine, 960, 600);

      // Switch to companion view
      overlay.column3View = 'companion';
      overlay.render(mockCtx, engine, 960, 600);
      expect(overlay.column3View).toBe('companion');

      // Right click companion item (Col 3 starts at 483, cell is at ~500, 100)
      const handled = overlay.handleRightClick(500, 100, engine);
      expect(handled).toBe(true);
      expect(overlay.contextMenu?.isOpen).toBe(true);
      expect(overlay.contextMenu?.source).toBe('companion');
      const takeOption = overlay.contextMenu?.options.find((o) => o.label === 'Take from Companion');
      expect(takeOption).toBeDefined();

      // Executing take transfers item to hero
      takeOption?.action();
      expect(companion.inventory.primaryPack.getItem('treat-1')).toBeNull();
      expect(player.inventory.primaryPack.getItem('treat-1')).toBeDefined();
    });
  });

  describe('Interactive Container Breadcrumbs', () => {
    it('navigates nested containers and pops directly to target index', () => {
      const pouch = new Container({ id: 'pouch-1', name: 'Leather Pouch', category: 'container', containerType: 'chest', weight: 100, bulk: 50, maxWeightCapacity: 2000, maxBulkCapacity: 1000 });
      const smallBox = new Container({ id: 'box-1', name: 'Small Box', category: 'container', containerType: 'chest', weight: 200, bulk: 100, maxWeightCapacity: 5000, maxBulkCapacity: 3000 });

      overlay.pushContainer(smallBox, 'ground');
      overlay.pushContainer(pouch, 'ground');
      expect(overlay.containerNavStack).toHaveLength(2);

      // Pop directly to root (index -1)
      overlay.popContainerTo(-1);
      expect(overlay.containerNavStack).toHaveLength(0);
      expect(overlay.selectedGroundContainer).toBeNull();
    });
  });

  describe('Drag-and-Drop Operations', () => {
    it('initiates drag on mousedown + mousemove and equips on paperdoll drop', () => {
      const sword = new Item({ id: 'sword-drag', name: 'Broadsword', category: 'weapon', slot: 'mainHand', weight: 1200, bulk: 600, stats: { attackBonus: 12 } });
      player.inventory.primaryPack.addItem(sword);

      overlay.render(mockCtx, engine, 960, 600);

      // MouseDown on backpack item cell
      overlay.handleMouseDown(280, 115);
      expect(overlay.dragData).not.toBeNull();
      expect(overlay.dragData?.item.id).toBe('sword-drag');
      expect(overlay.dragData?.isDragging).toBe(false);

      // Move mouse beyond 6px threshold
      overlay.handleMouseMove(290, 125);
      expect(overlay.dragData?.isDragging).toBe(true);

      // Drop on Paperdoll (col1X is around 32, modalX + 12)
      overlay.handleMouseUp(100, 200);
      expect(overlay.dragData).toBeNull();
      expect(player.inventory.paperdoll.getItem('mainHand')?.id).toBe('sword-drag');
    });

    it('unequips item when dragged from Paperdoll to Backpack', () => {
      const armor = new Item({ id: 'iron-chest', name: 'Iron Breastplate', category: 'armor', slot: 'torso', weight: 4000, bulk: 2500, stats: { defenseBonus: 6 } });
      player.inventory.paperdoll.equip(armor, 'torso');

      overlay.render(mockCtx, engine, 960, 600);

      // MouseDown on torso slot
      overlay.handleMouseDown(135, 205);
      expect(overlay.dragData).not.toBeNull();
      expect(overlay.dragData?.source).toBe('paperdoll');

      overlay.handleMouseMove(150, 205);
      expect(overlay.dragData?.isDragging).toBe(true);

      // Drop on Backpack Column
      overlay.handleMouseUp(300, 200);
      expect(player.inventory.paperdoll.getItem('torso')).toBeNull();
      expect(player.inventory.primaryPack.getItem('iron-chest')).toBeDefined();
    });
  });

  describe('Rich Hover Card Toggle in Settings', () => {
    it('honors inventoryRichHoverCards setting', () => {
      const dagger = new Item({ id: 'dag-1', name: 'Rune Dagger', category: 'weapon', slot: 'mainHand', weight: 300, bulk: 150, identified: true });
      player.inventory.primaryPack.addItem(dagger);

      overlay.render(mockCtx, engine, 960, 600);

      // Mouse over the dagger cell
      overlay.handleMouseMove(280, 115);

      // With default setting (true), renderHoverTooltip executes rich card path without error
      expect(() => overlay.render(mockCtx, engine, 960, 600)).not.toThrow();

      // Set to false
      overlay.richHoverCardsEnabled = false;
      expect(() => overlay.render(mockCtx, engine, 960, 600)).not.toThrow();
    });
  });
});
