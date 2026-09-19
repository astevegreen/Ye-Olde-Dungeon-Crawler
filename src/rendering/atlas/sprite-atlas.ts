import { Visibility } from '../../engine';
import type { SpriteKey, AtlasCoords } from './types';
import type { SpriteRecipe } from '../../engine';

/**
 * The coordinate unit every sprite recipe draws in — fixed forever. Recipes (both
 * content packs) hardcode absolute pixel literals assuming this box and never read
 * their `size` argument, so this must never change independently of the bake-time
 * scale applied below; recipes are always invoked with exactly `SPRITE_SIZE`.
 */
export const SPRITE_SIZE = 32;

/** Physical resolution of one atlas cell as actually stored/sampled at runtime. */
export const ATLAS_TILE_SIZE = 64;

/** Bake-time-only antialiasing multiplier; never affects runtime draw cost. */
const BAKE_SUPERSAMPLE = 4;

/** Recipe-space -> stored-atlas-space scale (the "higher base resolution" lever). */
const NATIVE_SCALE = ATLAS_TILE_SIZE / SPRITE_SIZE;

/** Total scratch-canvas scale recipes are baked at before the final downsample. */
const BAKE_SCALE = NATIVE_SCALE * BAKE_SUPERSAMPLE;

/** Alpha (0-255) above which a pixel counts as "solid" for outline/highlight purposes. */
export const OUTLINE_ALPHA_THRESHOLD = 160;

/** '#0f172a' — already the darkest shade used throughout both content packs. */
export const OUTLINE_COLOR: readonly [number, number, number] = [0x0f, 0x17, 0x2a];

/** Lighten-blend factor for the top/left highlight rim (not a flat overwrite). */
export const HIGHLIGHT_MIX = 0.35;

const SHADE_LIGHT = 'rgba(255, 255, 255, 0.12)';
const SHADE_DARK = 'rgba(0, 0, 0, 0.18)';

export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 10;

export const ATLAS_MAP: Record<SpriteKey, AtlasCoords> = {
  // Row 0: Base Terrain
  wall: { col: 0, row: 0 },
  floor: { col: 1, row: 0 },
  door_closed: { col: 2, row: 0 },
  door_open: { col: 3, row: 0 },
  stairs_up: { col: 4, row: 0 },
  stairs_down: { col: 5, row: 0 },
  trap: { col: 6, row: 0 },
  secret_door: { col: 0, row: 0 },

  // Row 1: Player & Base NPCs
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

  // Row 2: Base Items
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

  // Row 3: Monstrous & Beasts Archetypes
  dragon: { col: 0, row: 3 },
  wyrm: { col: 1, row: 3 },
  aberration: { col: 2, row: 3 },
  fiend: { col: 3, row: 3 },
  hound: { col: 4, row: 3 },
  salamander: { col: 5, row: 3 },
  parasite: { col: 6, row: 3 },
  insect: { col: 7, row: 3 },
  spider: { col: 8, row: 3 },
  wolf: { col: 9, row: 3 },
  construct: { col: 10, row: 3 },
  slime: { col: 11, row: 3 },
  golem: { col: 12, row: 3 },
  dragon_boss: { col: 13, row: 3 },
  troll: { col: 14, row: 3 },
  bone_horror: { col: 15, row: 3 },

  // Row 4: Undead, Spectral, Humanoids
  draugr: { col: 0, row: 4 },
  wight: { col: 1, row: 4 },
  zombie: { col: 2, row: 4 },
  wraith: { col: 3, row: 4 },
  spectral: { col: 4, row: 4 },
  spirit: { col: 5, row: 4 },
  fae: { col: 6, row: 4 },
  imp: { col: 7, row: 4 },
  dwarf: { col: 8, row: 4 },
  hag: { col: 9, row: 4 },
  zealot: { col: 10, row: 4 },
  cultist: { col: 11, row: 4 },

  // Row 5: Expanded Equipment & Consumables
  iron_armor: { col: 0, row: 5 },
  iron_shield: { col: 1, row: 5 },
  mace: { col: 2, row: 5 },
  battleaxe: { col: 3, row: 5 },
  warhammer: { col: 4, row: 5 },
  bow: { col: 5, row: 5 },
  ring: { col: 6, row: 5 },
  amulet: { col: 7, row: 5 },
  cloak: { col: 8, row: 5 },
  gauntlets: { col: 9, row: 5 },
  bracers: { col: 10, row: 5 },
  mana_potion: { col: 11, row: 5 },
  scroll: { col: 12, row: 5 },
  gem: { col: 13, row: 5 },
  key: { col: 14, row: 5 },
  torch: { col: 15, row: 5 },

  // Row 6: Dungeon Zone Walls
  wall_rime_hollows: { col: 0, row: 6 },
  wall_dwarven_works: { col: 1, row: 6 },
  wall_obsidian_siphon: { col: 2, row: 6 },
  wall_tarnished_silver: { col: 3, row: 6 },
  wall_world_bark: { col: 4, row: 6 },
  wall_maw_of_malice: { col: 5, row: 6 },
  wall_rotting_root: { col: 6, row: 6 },

  // Row 7: Dungeon Zone Floors
  floor_rime_hollows: { col: 0, row: 7 },
  floor_dwarven_works: { col: 1, row: 7 },
  floor_obsidian_siphon: { col: 2, row: 7 },
  floor_tarnished_silver: { col: 3, row: 7 },
  floor_world_bark: { col: 4, row: 7 },
  floor_maw_of_malice: { col: 5, row: 7 },
  floor_rotting_root: { col: 6, row: 7 },

  // Row 8: Town Themed Walls & Floors
  wall_town: { col: 0, row: 8 },
  floor_town: { col: 1, row: 8 },
  floor_town_snow: { col: 2, row: 8 },
  wall_town_temple: { col: 3, row: 8 },
  floor_town_temple: { col: 4, row: 8 },
  wall_town_smithy: { col: 5, row: 8 },
  floor_town_smithy: { col: 6, row: 8 },
  wall_town_shop: { col: 7, row: 8 },
  floor_town_shop: { col: 8, row: 8 },
  wall_town_bank: { col: 9, row: 8 },
  floor_town_bank: { col: 10, row: 8 },
  hearth_fire: { col: 11, row: 8 },

  // Row 9: Collision-breaking monster variants (see sprite-mapper.ts)
  sorcerer: { col: 0, row: 9 },
  giant: { col: 1, row: 9 },
  giant_fire: { col: 2, row: 9 },
  shadow: { col: 3, row: 9 },
  ghost: { col: 4, row: 9 },
  bound_spirit: { col: 5, row: 9 },
  duergar: { col: 6, row: 9 },
  troll_witch: { col: 7, row: 9 },
  dragon_elder: { col: 8, row: 9 },
  rune_stone: { col: 9, row: 9 },
};

interface AtlasCell {
  ox: number;
  oy: number;
  size: number;
}

export class SpriteAtlas {
  public readonly atlasCanvas: HTMLCanvasElement;
  public readonly dimmedAtlasCanvas: HTMLCanvasElement;
  private spriteCache = new Map<SpriteKey, HTMLCanvasElement>();
  private recipes?: Record<string, SpriteRecipe>;

  constructor(recipes?: Record<string, SpriteRecipe>) {
    this.recipes = recipes;
    this.atlasCanvas = document.createElement('canvas');
    this.dimmedAtlasCanvas = document.createElement('canvas');

    // 16 columns by 10 rows of ATLAS_TILE_SIZE tiles
    const width = ATLAS_COLS * ATLAS_TILE_SIZE;
    const height = ATLAS_ROWS * ATLAS_TILE_SIZE;

    this.atlasCanvas.width = width;
    this.atlasCanvas.height = height;
    this.dimmedAtlasCanvas.width = width;
    this.dimmedAtlasCanvas.height = height;

    this.buildAtlas();
    this.buildDimmedAtlas();
  }

  /**
   * Bakes every recipe onto a supersampled scratch canvas (recipes see the exact same
   * `(ctx, ox, oy, SPRITE_SIZE)` call shape they always have — the extra resolution is
   * applied purely via `scratchCtx.scale(BAKE_SCALE, ...)`, invisible to recipe code),
   * downsamples once into the real atlas with smoothing on, then applies the shared
   * shading and outline/highlight passes to the final, smaller resolution.
   */
  private buildAtlas(): void {
    const ctx = this.atlasCanvas.getContext('2d');
    if (!ctx) return;

    const scratch = document.createElement('canvas');
    scratch.width = ATLAS_COLS * SPRITE_SIZE * BAKE_SCALE;
    scratch.height = ATLAS_ROWS * SPRITE_SIZE * BAKE_SCALE;

    const sctx = scratch.getContext('2d');
    if (!sctx) return;
    sctx.scale(BAKE_SCALE, BAKE_SCALE);

    for (const [key, coords] of Object.entries(ATLAS_MAP) as [SpriteKey, AtlasCoords][]) {
      const ox = coords.col * SPRITE_SIZE;
      const oy = coords.row * SPRITE_SIZE;
      const recipe = this.recipes?.[key];
      if (recipe) {
        recipe(sctx, ox, oy, SPRITE_SIZE);
      } else {
        this.renderFallback(sctx, ox, oy, key);
      }
    }

    // The one smoothed operation in the whole pipeline: averages the supersampled
    // scratch buffer down into real, anti-aliased atlas pixels. Reset immediately so
    // every other draw (including the passes below) stays nearest-neighbor.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(scratch, 0, 0, scratch.width, scratch.height, 0, 0, this.atlasCanvas.width, this.atlasCanvas.height);
    ctx.imageSmoothingEnabled = false;

    const cells = this.getUniqueCells();
    this.applyShadingOverlay(ctx, cells);
    this.bakeOutlineAndHighlight(ctx, cells);
  }

  /** Every occupied atlas cell, in stored/physical (ATLAS_TILE_SIZE) space, deduped by
   *  (col, row) — `wall`/`secret_door` share a cell, and each pixel pass below must
   *  run on it exactly once. */
  private getUniqueCells(): AtlasCell[] {
    const seen = new Set<string>();
    const cells: AtlasCell[] = [];
    for (const coords of Object.values(ATLAS_MAP) as AtlasCoords[]) {
      const key = `${coords.col},${coords.row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({ ox: coords.col * ATLAS_TILE_SIZE, oy: coords.row * ATLAS_TILE_SIZE, size: ATLAS_TILE_SIZE });
    }
    return cells;
  }

  /**
   * Whole-silhouette directional-light gradient, composited with `source-atop` so it
   * only paints over each sprite's own already-opaque/semi-opaque pixels — respects
   * whatever silhouette a recipe drew without any per-shape knowledge. Applies
   * identically to every sprite, current or future, in either content pack.
   */
  private applyShadingOverlay(ctx: CanvasRenderingContext2D, cells: AtlasCell[]): void {
    for (const { ox, oy, size } of cells) {
      const grad = ctx.createLinearGradient(ox, oy, ox + size, oy + size);
      grad.addColorStop(0, SHADE_LIGHT);
      grad.addColorStop(1, SHADE_DARK);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = grad;
      ctx.fillRect(ox, oy, size, size);
      ctx.restore();
    }
  }

  /** Reads back the baked atlas pixels, runs the shared outline/highlight pass, writes them back. */
  private bakeOutlineAndHighlight(ctx: CanvasRenderingContext2D, cells: AtlasCell[]): void {
    const { width, height } = this.atlasCanvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    applyOutlineAndHighlight(imgData.data, width, height, cells);
    ctx.putImageData(imgData, 0, 0);
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
    const sx = coords.col * ATLAS_TILE_SIZE;
    const sy = coords.row * ATLAS_TILE_SIZE;

    targetCtx.drawImage(source, sx, sy, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE, dx, dy, dSize, dSize);
  }

  public getSpriteCanvas(key: SpriteKey): HTMLCanvasElement {
    const cached = this.spriteCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_TILE_SIZE;
    canvas.height = ATLAS_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const coords = ATLAS_MAP[key];
      if (coords) {
        ctx.drawImage(
          this.atlasCanvas,
          coords.col * ATLAS_TILE_SIZE,
          coords.row * ATLAS_TILE_SIZE,
          ATLAS_TILE_SIZE,
          ATLAS_TILE_SIZE,
          0,
          0,
          ATLAS_TILE_SIZE,
          ATLAS_TILE_SIZE
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

/**
 * Shared, generic outline+highlight post-process: dilates a dark outline just outside
 * each sprite's solid silhouette, and lightens a top/left-facing interior rim to
 * simulate a fixed upper-left light source. Pure and DOM-free (operates on a raw
 * `Uint8ClampedArray`) so it's unit-testable without a canvas, and reusable for any
 * atlas layout, current or future, with no per-sprite special-casing.
 *
 * A pixel counts as "solid" only above OUTLINE_ALPHA_THRESHOLD, so existing soft
 * translucent glow/aura effects (e.g. the health potion's halo) fall below the
 * threshold and never grow a hard ring at their own soft edge — only at the boundary
 * of whatever fully-opaque shape sits on top of them. Fully-opaque, edge-to-edge
 * terrain tiles have no alpha=0..threshold pixels anywhere in their cell, so both
 * passes are a guaranteed no-op there — no seams between adjacent floor/wall tiles.
 */
export function applyOutlineAndHighlight(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cells: AtlasCell[]
): void {
  const src = data.slice();
  const alphaAt = (x: number, y: number): number => src[(y * width + x) * 4 + 3];

  for (const { ox, oy, size } of cells) {
    const minX = ox;
    const minY = oy;
    // Clamped defensively — a caller-supplied cell must never let the pixel loop walk
    // past the actual buffer bounds.
    const maxX = Math.min(ox + size, width);
    const maxY = Math.min(oy + size, height);

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const i = (y * width + x) * 4;
        const solid = alphaAt(x, y) >= OUTLINE_ALPHA_THRESHOLD;

        if (!solid) {
          if (hasSolidNeighbor8(x, y, minX, minY, maxX, maxY, alphaAt)) {
            data[i] = OUTLINE_COLOR[0];
            data[i + 1] = OUTLINE_COLOR[1];
            data[i + 2] = OUTLINE_COLOR[2];
            data[i + 3] = 255;
          }
        } else if (hasNonSolidNorthOrWest(x, y, minX, minY, alphaAt)) {
          data[i] = src[i] + (255 - src[i]) * HIGHLIGHT_MIX;
          data[i + 1] = src[i + 1] + (255 - src[i + 1]) * HIGHLIGHT_MIX;
          data[i + 2] = src[i + 2] + (255 - src[i + 2]) * HIGHLIGHT_MIX;
        }
      }
    }
  }
}

function hasSolidNeighbor8(
  x: number,
  y: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  alphaAt: (x: number, y: number) => number
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < minX || nx >= maxX || ny < minY || ny >= maxY) continue;
      if (alphaAt(nx, ny) >= OUTLINE_ALPHA_THRESHOLD) return true;
    }
  }
  return false;
}

/**
 * Out-of-cell-bounds neighbors default to "solid" (255) rather than "transparent" —
 * otherwise every sprite's own top row / left column would read as a false rim purely
 * from hitting the cell edge, which would break the terrain-tile no-op guarantee above
 * (a fully opaque tile's top-left border would otherwise always get highlighted).
 */
function hasNonSolidNorthOrWest(
  x: number,
  y: number,
  minX: number,
  minY: number,
  alphaAt: (x: number, y: number) => number
): boolean {
  const north = y - 1 >= minY ? alphaAt(x, y - 1) : 255;
  const west = x - 1 >= minX ? alphaAt(x - 1, y) : 255;
  return north < OUTLINE_ALPHA_THRESHOLD || west < OUTLINE_ALPHA_THRESHOLD;
}
