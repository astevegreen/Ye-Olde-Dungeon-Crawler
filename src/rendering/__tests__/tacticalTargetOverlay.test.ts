import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TacticalTargetOverlay } from '../tacticalTargetOverlay';
import { Camera } from '../camera';
import { GameEngine } from '../../engine';

describe('TacticalTargetOverlay', () => {
  let overlay: TacticalTargetOverlay;

  beforeEach(() => {
    overlay = new TacticalTargetOverlay();
  });

  it('tracks hovered coordinates and clears hover', () => {
    expect(overlay.hoveredTile).toBeNull();

    overlay.setHoveredTile(10, 15);
    expect(overlay.hoveredTile).toEqual({ x: 10, y: 15 });

    overlay.clearHover();
    expect(overlay.hoveredTile).toBeNull();
  });

  it('renders safely when no tile is hovered', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const camera = new Camera(20, 15);
    expect(() => {
      overlay.render(mockCtx, {} as GameEngine, camera, 32, 0, 0, 960, 600);
    }).not.toThrow();
  });
});
