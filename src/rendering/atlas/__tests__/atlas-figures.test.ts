import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpriteAtlas, ATLAS_TILE_SIZE } from '../sprite-atlas';
import { Visibility, type PixelSprite } from '../../../engine';

/** A 2D context that keeps pixel buffers, so a figure's strip and its dimmed copy can be made. */
function mockCanvas(): HTMLCanvasElement {
  const canvas = { width: 0, height: 0 } as { width: number; height: number; getContext?: () => unknown };
  const ctx: Record<string, unknown> = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  };
  const proxy = new Proxy(ctx, { get: (t, p: string) => (p in t ? t[p] : vi.fn()) });
  canvas.getContext = () => proxy;
  return canvas as unknown as HTMLCanvasElement;
}

function target() {
  const drawImage = vi.fn();
  return { ctx: { drawImage } as unknown as CanvasRenderingContext2D, drawImage };
}

function figure(frames?: number): PixelSprite & { render: ReturnType<typeof vi.fn> } {
  return { frames, render: vi.fn((_f: number, size: number) => new Uint8ClampedArray(size * size * 4)) };
}

describe('SpriteAtlas figures: sprites that draw their own pixels', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? mockCanvas() : {}) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defines figures from the pack and counts their frames, 1 to 4', () => {
    const atlas = new SpriteAtlas({}, { pixelSprites: { ghost: figure(3), statue: figure(), swarm: figure(9) } });
    expect(atlas.hasFigure('ghost')).toBe(true);
    expect(atlas.hasSprite('ghost')).toBe(true);
    expect(atlas.frameCount('ghost')).toBe(3);
    expect(atlas.frameCount('statue')).toBe(1);
    expect(atlas.frameCount('swarm')).toBe(4);
    expect(atlas.frameCount('wall')).toBe(1);
    expect(atlas.hasFigure('wall')).toBe(false);
  });

  it('bakes each frame once, on first draw, and wraps the frame index', () => {
    const ghost = figure(4);
    const atlas = new SpriteAtlas({}, { pixelSprites: { ghost } });
    expect(ghost.render).not.toHaveBeenCalled();

    const { ctx, drawImage } = target();
    atlas.drawSprite(ctx, 'ghost', 10, 20, 32, Visibility.Visible, 2);
    atlas.drawSprite(ctx, 'ghost', 10, 20, 32, Visibility.Visible, 2);
    atlas.drawSprite(ctx, 'ghost', 10, 20, 32, Visibility.Visible, 5);
    expect(ghost.render.mock.calls).toEqual([
      [2, ATLAS_TILE_SIZE],
      [1, ATLAS_TILE_SIZE],
    ]);
    expect(drawImage.mock.calls[0].slice(1)).toEqual([2 * ATLAS_TILE_SIZE, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE, 10, 20, 32, 32]);
    expect(drawImage.mock.calls[2][1]).toBe(ATLAS_TILE_SIZE);
  });

  it('draws a remembered figure still, from frame 0', () => {
    const ghost = figure(4);
    const atlas = new SpriteAtlas({}, { pixelSprites: { ghost } });
    const { ctx, drawImage } = target();
    atlas.drawSprite(ctx, 'ghost', 0, 0, 32, Visibility.Explored, 3);
    expect(ghost.render.mock.calls).toEqual([[0, ATLAS_TILE_SIZE]]);
    expect(drawImage.mock.calls[0][1]).toBe(0);
  });

  it('draws a key from its figure over a recipe of the same name', () => {
    const recipe = vi.fn();
    const ghost = figure(2);
    const atlas = new SpriteAtlas({ ghost: recipe }, { pixelSprites: { ghost } });
    atlas.drawSprite(target().ctx, 'ghost', 0, 0, 32);
    expect(ghost.render).toHaveBeenCalledTimes(1);
  });

  it('keeps the latest transient looks and forgets the oldest past twelve', () => {
    const atlas = new SpriteAtlas({}, { pixelSprites: { ghost: figure() } });
    for (let i = 0; i < 13; i++) atlas.defineFigure(`hero:${i}`, figure(), { transient: true });
    expect(atlas.hasFigure('hero:0')).toBe(false);
    expect(atlas.hasFigure('hero:1')).toBe(true);
    expect(atlas.hasFigure('hero:12')).toBe(true);
    expect(atlas.hasFigure('ghost')).toBe(true);
  });
});

describe('SpriteAtlas item auras: an identified item drawn in its family’s aura', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? mockCanvas() : {}) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const auras = (frames = 16) => ({
    frames,
    tones: ['cursed', 'blessed'],
    render: vi.fn((_item: Uint8ClampedArray, size: number, _tone: string, _frame: number) => new Uint8ClampedArray(size * size * 4)),
  });

  it('draws a family the pack has an aura for at the aura’s frame, and any other plain', () => {
    const art = auras();
    const atlas = new SpriteAtlas({}, { pixelSprites: { blade: figure() }, itemAuras: art });
    expect([atlas.itemFrameCount('blade', 'cursed'), atlas.itemFrameCount('blade', 'hexed'), atlas.itemFrameCount('blade', null)]).toEqual([16, 1, 1]);

    const { ctx, drawImage } = target();
    atlas.drawItem(ctx, 'blade', 'cursed', 4, 6, 24, 5);
    expect(art.render.mock.calls.map((c) => [c[1], c[2], c[3]])).toEqual([[ATLAS_TILE_SIZE, 'cursed', 5]]);
    expect(drawImage.mock.calls[0].slice(1)).toEqual([5 * ATLAS_TILE_SIZE, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE, 4, 6, 24, 24]);

    atlas.drawItem(ctx, 'blade', 'hexed', 0, 0, 32, 5);
    atlas.drawItem(ctx, 'blade', null, 0, 0, 32, 5);
    expect(art.render).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[1][1]).toBe(0);
  });

  it('bakes each aura frame once, wraps the frame, and reads the item once for every family', () => {
    const art = auras();
    const blade = figure();
    const atlas = new SpriteAtlas({}, { pixelSprites: { blade }, itemAuras: art });
    const { ctx } = target();
    atlas.drawItem(ctx, 'blade', 'cursed', 0, 0, 32, 3);
    atlas.drawItem(ctx, 'blade', 'cursed', 0, 0, 32, 19);
    atlas.drawItem(ctx, 'blade', 'blessed', 0, 0, 32, 3);
    expect(art.render.mock.calls.map((c) => [c[2], c[3]])).toEqual([['cursed', 3], ['blessed', 3]]);
    expect(blade.render).toHaveBeenCalledTimes(1);
    expect(art.render.mock.calls[1][0]).toBe(art.render.mock.calls[0][0]);
  });

  it('keeps an idling item in step: each aura frame wraps the item’s idle frame at that step', () => {
    const art = auras();
    const wand = figure(2);
    const atlas = new SpriteAtlas({}, { pixelSprites: { wand }, itemAuras: art });
    const { ctx } = target();
    for (let f = 0; f < 4; f++) atlas.drawItem(ctx, 'wand', 'cursed', 0, 0, 32, f);
    expect(wand.render.mock.calls.map((c) => c[0])).toEqual([0, 1]);
    const items = art.render.mock.calls.map((c) => c[0]);
    expect([items[2] === items[0], items[3] === items[1], items[1] === items[0]]).toEqual([true, true, false]);
  });

  it('reads a recipe-drawn item from its atlas cell', () => {
    const art = auras();
    const atlas = new SpriteAtlas({ relic: vi.fn() }, { itemAuras: art });
    atlas.drawItem(target().ctx, 'relic', 'blessed', 0, 0, 32, 0);
    expect(art.render.mock.calls[0][0]).toHaveLength(ATLAS_TILE_SIZE * ATLAS_TILE_SIZE * 4);
  });

  it('draws every item plain when the pack has no auras', () => {
    const blade = figure();
    const atlas = new SpriteAtlas({}, { pixelSprites: { blade } });
    expect(atlas.itemFrameCount('blade', 'cursed')).toBe(1);
    const { ctx, drawImage } = target();
    atlas.drawItem(ctx, 'blade', 'cursed', 0, 0, 32, 7);
    expect(drawImage.mock.calls[0][1]).toBe(0);
  });
});
