import { Visibility } from '../../engine';
import type { SpriteKey, AtlasCoords } from './types';
import type { SpriteRecipe } from '../../engine';

export const SPRITE_SIZE = 32;

export const ATLAS_MAP: Record<SpriteKey, AtlasCoords> = {
  // Row 0: Terrain
  wall: { col: 0, row: 0 },
  floor: { col: 1, row: 0 },
  door_closed: { col: 2, row: 0 },
  door_open: { col: 3, row: 0 },
  stairs_up: { col: 4, row: 0 },
  stairs_down: { col: 5, row: 0 },
  trap: { col: 6, row: 0 },
  secret_door: { col: 0, row: 0 },

  // Row 1: Entities
  player: { col: 0, row: 1 },
  kobold: { col: 1, row: 1 },
  skeleton: { col: 2, row: 1 },
  giant_rat: { col: 3, row: 1 },
  orc: { col: 4, row: 1 },
  shopkeeper: { col: 5, row: 1 },
  townsperson: { col: 6, row: 1 },
  priest: { col: 7, row: 1 },
  sage: { col: 8, row: 1 },
  banker: { col: 9, row: 1 },
  guard: { col: 10, row: 1 },
  player_female: { col: 11, row: 1 },
  giant_boss: { col: 12, row: 1 },

  // Row 2: Items
  broadsword: { col: 0, row: 2 },
  leather_armor: { col: 1, row: 2 },
  wooden_shield: { col: 2, row: 2 },
  health_potion: { col: 3, row: 2 },
  gold_coins: { col: 4, row: 2 },
  dagger: { col: 5, row: 2 },
  helmet: { col: 6, row: 2 },
  boots: { col: 7, row: 2 },
  backpack: { col: 8, row: 2 },
  purse: { col: 9, row: 2 },
  cursed_mace: { col: 10, row: 2 },
  chest: { col: 11, row: 2 },
  belt: { col: 12, row: 2 },
  sun_stone: { col: 13, row: 2 },
  travel_bread: { col: 14, row: 2 },
};

export class SpriteAtlas {
  public readonly atlasCanvas: HTMLCanvasElement;
  public readonly dimmedAtlasCanvas: HTMLCanvasElement;
  private spriteCache = new Map<SpriteKey, HTMLCanvasElement>();
  private recipes?: Record<string, SpriteRecipe>;

  constructor(recipes?: Record<string, SpriteRecipe>) {
    this.recipes = recipes;
    this.atlasCanvas = document.createElement('canvas');
    this.dimmedAtlasCanvas = document.createElement('canvas');

    // 16 columns by 4 rows of 32x32 tiles
    const width = 16 * SPRITE_SIZE;
    const height = 4 * SPRITE_SIZE;

    this.atlasCanvas.width = width;
    this.atlasCanvas.height = height;
    this.dimmedAtlasCanvas.width = width;
    this.dimmedAtlasCanvas.height = height;

    this.buildAtlas();
    this.buildDimmedAtlas();
  }

  private buildAtlas(): void {
    const ctx = this.atlasCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Render each sprite into its allocated cell on the atlas
    for (const [key, coords] of Object.entries(ATLAS_MAP) as [SpriteKey, AtlasCoords][]) {
      const ox = coords.col * SPRITE_SIZE;
      const oy = coords.row * SPRITE_SIZE;
      const recipe = this.recipes?.[key];
      if (recipe) {
        recipe(ctx, ox, oy, SPRITE_SIZE);
      } else {
        this.renderFallback(ctx, ox, oy, key);
      }
    }
  }

  private buildDimmedAtlas(): void {
    const ctx = this.atlasCanvas.getContext('2d');
    const dimmedCtx = this.dimmedAtlasCanvas.getContext('2d');
    if (!ctx || !dimmedCtx) return;

    dimmedCtx.imageSmoothingEnabled = false;

    // Copy full atlas
    dimmedCtx.drawImage(this.atlasCanvas, 0, 0);

    // Apply dark blue-slate Fog of War desaturation
    const imgData = dimmedCtx.getImageData(0, 0, this.dimmedAtlasCanvas.width, this.dimmedAtlasCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a === 0) continue;

      // Rec. 709 Grayscale Luminance
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Dim and tint towards dungeon shadow palette
      data[i] = Math.floor(lum * 0.6); // Red muted
      data[i + 1] = Math.floor(lum * 0.8); // Green muted
      data[i + 2] = Math.floor(lum * 1.3 + 18); // Cool blue-slate bias
    }

    dimmedCtx.putImageData(imgData, 0, 0);
  }

  public drawSprite(
    targetCtx: CanvasRenderingContext2D,
    key: SpriteKey,
    dx: number,
    dy: number,
    dSize: number,
    visibility: Visibility = Visibility.Visible
  ): void {
    if (visibility === Visibility.Unexplored) {
      return;
    }

    const coords = ATLAS_MAP[key];
    if (!coords) return;

    const source = visibility === Visibility.Explored ? this.dimmedAtlasCanvas : this.atlasCanvas;
    const sx = coords.col * SPRITE_SIZE;
    const sy = coords.row * SPRITE_SIZE;

    targetCtx.drawImage(source, sx, sy, SPRITE_SIZE, SPRITE_SIZE, dx, dy, dSize, dSize);
  }

  public getSpriteCanvas(key: SpriteKey): HTMLCanvasElement {
    const cached = this.spriteCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const coords = ATLAS_MAP[key];
      if (coords) {
        ctx.drawImage(
          this.atlasCanvas,
          coords.col * SPRITE_SIZE,
          coords.row * SPRITE_SIZE,
          SPRITE_SIZE,
          SPRITE_SIZE,
          0,
          0,
          SPRITE_SIZE,
          SPRITE_SIZE
        );
      }
    }

    this.spriteCache.set(key, canvas);
    return canvas;
  }

  private renderFallback(ctx: CanvasRenderingContext2D, ox: number, oy: number, key: string): void {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ox, oy, SPRITE_SIZE, SPRITE_SIZE);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(ox + 0.5, oy + 0.5, SPRITE_SIZE - 1, SPRITE_SIZE - 1);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key[0].toUpperCase(), ox + SPRITE_SIZE / 2, oy + SPRITE_SIZE / 2);
  }
}
