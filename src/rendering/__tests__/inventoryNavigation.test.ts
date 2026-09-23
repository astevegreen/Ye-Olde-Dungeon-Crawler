import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryOverlay } from '../inventory-overlay';
import { GameEngine, GameMap, Player, Item } from '../../engine';

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

describe('InventoryOverlay keyboard navigation & selection', () => {
  let engine: GameEngine;
  let overlay: InventoryOverlay;
  let items: Item[];
  const press = (code: string) => overlay.handleKeyDown(code, engine);

  beforeEach(() => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
    items = Array.from({ length: 10 }, (_, i) => {
      const item = new Item({ id: `rock-${i}`, name: `Rock ${i}`, category: 'misc', weight: 10, bulk: 10, identified: false, unidentifiedName: `Odd Rock ${i}` });
      player.inventory.primaryPack.addItem(item);
      return item;
    });
    overlay = new InventoryOverlay();
    overlay.open(engine);
    overlay.render(createMockContext(), engine, 960, 600);
    overlay.inspector.setFocus('backpack', 0);
    overlay.inspector.select(items[0], 'backpack');
  });

  const cols = () => (overlay as unknown as { gridColumns: { backpack: number } }).gridColumns.backpack;

  it('draws the backpack as a multi-column grid', () => {
    expect(cols()).toBeGreaterThan(1);
  });

  it('Left/Right step one cell and Up/Down step one grid row', () => {
    press('ArrowRight');
    expect(overlay.inspector.focusedIndex).toBe(1);
    press('ArrowDown');
    expect(overlay.inspector.focusedIndex).toBe(1 + cols());
    expect(overlay.inspector.selectedItem).toBe(items[1 + cols()]);
    press('ArrowUp');
    expect(overlay.inspector.focusedIndex).toBe(1);
    press('ArrowLeft');
    expect(overlay.inspector.focusedIndex).toBe(0);
  });

  it('Up from the top row stays put instead of wrapping', () => {
    press('ArrowUp');
    expect(overlay.inspector.focusedIndex).toBe(0);
  });

  it('Escape deselects first, then closes', () => {
    press('Escape');
    expect(overlay.inspector.selectedItem).toBeNull();
    expect(overlay.isOpen).toBe(true);
    press('Escape');
    expect(overlay.isOpen).toBe(false);
  });

  it('clicking empty space clicks off the selection', () => {
    overlay.handleClick(1, 1);
    expect(overlay.inspector.selectedItem).toBeNull();
    expect(overlay.isOpen).toBe(true);
  });

  it('[Y] with no identify source explains what it needs', () => {
    const log = vi.spyOn(engine, 'log');
    press('KeyY');
    expect(log).toHaveBeenCalledWith('Needs a Scroll of Identify or the Identify spell');
    expect(items[0].identified).toBe(false);
  });
});
