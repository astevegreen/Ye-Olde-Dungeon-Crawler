import { describe, it, expect, vi } from 'vitest';
import { RadialMenuOverlay, RADIAL_DIRECTIONS } from '../radialMenu';
import type { RadialMenuSlotConfig } from '../../ui/settings/settingsManager';
import { GameEngine } from '../../engine';
import { GameMap } from '../../engine';
import { Player } from '../../engine';

function buildEngine(): GameEngine {
  const map = new GameMap(20, 20);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
  return new GameEngine({ map, player });
}

function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

describe('RadialMenuOverlay (P-24)', () => {
  it('starts closed with all slots empty and no hovered direction', () => {
    const overlay = new RadialMenuOverlay();
    expect(overlay.isOpen).toBe(false);
    expect(overlay.getSelectedSlot()).toBeNull();
    expect(overlay.slots).toEqual(new Array(8).fill(null));
  });

  it('opens, tracks a hovered direction, and resolves the matching configured slot', () => {
    const overlay = new RadialMenuOverlay();
    const fireboltSlot: RadialMenuSlotConfig = { type: 'spell', spellId: 'firebolt' };
    overlay.slots[RADIAL_DIRECTIONS.indexOf('E')] = fireboltSlot;

    overlay.open();
    expect(overlay.isOpen).toBe(true);
    expect(overlay.getSelectedSlot()).toBeNull(); // nothing hovered yet

    overlay.setHoveredDirection('E');
    expect(overlay.getHoveredDirection()).toBe('E');
    expect(overlay.getSelectedSlot()).toEqual(fireboltSlot);

    // Hovering an empty wedge resolves to null even though a direction is set.
    overlay.setHoveredDirection('N');
    expect(overlay.getSelectedSlot()).toBeNull();
  });

  it('resets hovered direction on close', () => {
    const overlay = new RadialMenuOverlay();
    overlay.open();
    overlay.setHoveredDirection('S');
    overlay.close();
    expect(overlay.isOpen).toBe(false);
    expect(overlay.getHoveredDirection()).toBeNull();
  });

  it('ignores direction changes while closed', () => {
    const overlay = new RadialMenuOverlay();
    overlay.setHoveredDirection('W');
    expect(overlay.getHoveredDirection()).toBeNull();
  });

  it('renders without throwing when open, and is a no-op when closed', () => {
    const overlay = new RadialMenuOverlay();
    const engine = buildEngine();
    const ctx = createMockCanvasContext();
    const label = (slot: RadialMenuSlotConfig) => (slot.type === 'spell' ? slot.spellId : 'x');

    expect(() => overlay.render(ctx, engine, 960, 600, label)).not.toThrow();
    expect(ctx.fillRect).not.toHaveBeenCalled(); // closed: nothing drawn

    overlay.open();
    expect(() => overlay.render(ctx, engine, 960, 600, label)).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled(); // open: backdrop drawn
  });
});
