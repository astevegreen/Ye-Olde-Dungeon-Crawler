import { describe, it, expect, vi } from 'vitest';
import { RadialMenuOverlay, RADIAL_DIRECTIONS } from '../radialMenu';
import type { CompanionWheelSlot } from '../../ui/companionWheel';
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
    lineTo: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 6 })),
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

describe('RadialMenuOverlay', () => {
  it('starts closed with all slots empty and no hovered direction', () => {
    const overlay = new RadialMenuOverlay();
    expect(overlay.isOpen).toBe(false);
    expect(overlay.getSelectedSlot()).toBeNull();
    expect(overlay.slots).toEqual(new Array(8).fill(null));
  });

  it('opens, tracks a hovered direction, and resolves the matching slot', () => {
    const overlay = new RadialMenuOverlay();
    const skillSlot: CompanionWheelSlot = { label: 'Rally Howl', action: { kind: 'skill', skillId: 'rally_howl' } };
    overlay.slots[RADIAL_DIRECTIONS.indexOf('E')] = skillSlot;

    overlay.open();
    expect(overlay.isOpen).toBe(true);
    expect(overlay.getSelectedSlot()).toBeNull(); // nothing hovered yet

    overlay.setHoveredDirection('E');
    expect(overlay.getHoveredDirection()).toBe('E');
    expect(overlay.getSelectedSlot()).toEqual(skillSlot);

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
    overlay.slots[0] = { label: 'Call Fenrir', action: { kind: 'call' } };

    expect(() => overlay.render(ctx, engine, 960, 600)).not.toThrow();
    expect(ctx.fillRect).not.toHaveBeenCalled(); // closed: nothing drawn

    overlay.open();
    expect(() => overlay.render(ctx, engine, 960, 600)).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled(); // open: backdrop drawn
    expect(ctx.fillText).toHaveBeenCalledWith('Call Fenrir', expect.any(Number), expect.any(Number), expect.any(Number));
  });

  it('breaks a long label onto two lines, and moves only while its clock runs', () => {
    const overlay = new RadialMenuOverlay();
    const engine = buildEngine();
    const ctx = createMockCanvasContext();
    overlay.slots[2] = { label: 'Guard the Hero Closely', action: { kind: 'call' } };
    overlay.open();

    expect(overlay.render(ctx, engine, 960, 600)).toBe(false); // Reduce motion: still
    const drawn = vi.mocked(ctx.fillText).mock.calls.map((c) => c[0]);
    expect(drawn).not.toContain('Guard the Hero Closely');
    expect(drawn).toContain('Guard the');
    expect(drawn).toContain('Hero Closely');
    expect(overlay.render(ctx, engine, 960, 600, undefined, 1200)).toBe(true);
  });
});
