import { describe, it, expect, vi } from 'vitest';
import { InventoryTabAdapter } from '../inventoryTabAdapter';
import type { InventoryOverlay } from '../inventory-overlay';

function fakeOverlay(closesOn: string): InventoryOverlay {
  const overlay = {
    isOpen: true,
    handleKeyDown(e: KeyboardEvent) {
      if (e.code === closesOn) overlay.isOpen = false;
      return true;
    },
  };
  return overlay as unknown as InventoryOverlay;
}

describe('InventoryTabAdapter', () => {
  it('dismisses the hosting shell when the overlay closes itself on [I]', () => {
    const onDismiss = vi.fn();
    const adapter = new InventoryTabAdapter(fakeOverlay('KeyI'), undefined, onDismiss);
    adapter.handleKeyDown({ code: 'KeyI' } as KeyboardEvent);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('leaves the shell open for keys the overlay handles without closing', () => {
    const onDismiss = vi.fn();
    const adapter = new InventoryTabAdapter(fakeOverlay('KeyI'), undefined, onDismiss);
    adapter.handleKeyDown({ code: 'ArrowDown' } as KeyboardEvent);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
