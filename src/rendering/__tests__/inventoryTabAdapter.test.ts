import { describe, it, expect, vi } from 'vitest';
import { InventoryTabAdapter } from '../inventoryTabAdapter';
import type { InventoryOverlay } from '../inventory-overlay';

function fakeOverlay() {
  const listeners: Array<() => void> = [];
  const overlay = {
    isOpen: true,
    addCloseListener: (fn: () => void) => listeners.push(fn),
    close() {
      overlay.isOpen = false;
      listeners.forEach((fn) => fn());
    },
    handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'KeyI') overlay.close();
      return true;
    },
  };
  return overlay as typeof overlay & InventoryOverlay;
}

describe('InventoryTabAdapter', () => {
  it('dismisses the hosting shell when the overlay closes itself on [I]', () => {
    const onDismiss = vi.fn();
    const adapter = new InventoryTabAdapter(fakeOverlay(), undefined, onDismiss);
    adapter.handleKeyDown({ code: 'KeyI' } as KeyboardEvent);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses the shell for closes that bypass key handling (canvas X, Rune channel)', () => {
    const onDismiss = vi.fn();
    const overlay = fakeOverlay();
    new InventoryTabAdapter(overlay, undefined, onDismiss);
    overlay.close();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not dismiss the shell when the shell itself unmounts the tab (tab switch)', () => {
    const onDismiss = vi.fn();
    const adapter = new InventoryTabAdapter(fakeOverlay(), undefined, onDismiss);
    adapter.unmount();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('leaves the shell open for keys the overlay handles without closing', () => {
    const onDismiss = vi.fn();
    const adapter = new InventoryTabAdapter(fakeOverlay(), undefined, onDismiss);
    adapter.handleKeyDown({ code: 'ArrowDown' } as KeyboardEvent);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
