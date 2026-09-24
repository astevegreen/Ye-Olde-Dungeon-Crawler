import type { SpriteRecipe, TerrainStyle } from '../../../engine';
import { type Pen, type Rand, seeded, rgba, mix, ell, poly, macroQuadrant } from './pen';

/**
 * The cotw terrain kit: one `ZoneArt` (palette plus a few material hooks) becomes a zone's
 * full recipe set in the key grammar `TerrainArtConfig` documents (src/engine/types/manifest.ts):
 * floor tones and details, 3/4 walls with rims and corners, blended liquids and pits,
 * zone-themed doors, and props. Recipes draw in the fixed 32-unit cell.
 */

export interface ZonePalette {
  void: string;
  floorLo: string;
  floor: string;
  floorHi: string;
  faceLo: string;
  face: string;
  rim: string;
  cap: string;
  accent: string;
  glow: string;
  liquid: string;
  liquidHi: string;
  pitFace: string;
}

export interface DoorPalette {
  wood: string;
  woodDark: string;
  seam: string;
  band: string;
  bandLight: string;
  ring: string;
}

export interface FloorVariant {
  tone: number;
  detail: boolean;
  /** Which detail variant, when `detail`. */
  n: number;
  /** 2x2 quadrant (0-3) for macro floors, else 0. */
  q: number;
}

export type LiquidPattern = 'ice' | 'ripple' | 'magma';
export type PitPattern = 'void' | 'lava' | 'coals';

export interface ZoneArt {
  /** Recipe-key suffix: a `tileZoneBands` key, `town`, or `town_<buildingType>`. */
  key: string;
  pal: ZonePalette;
  floor: TerrainStyle & { kind: 'field' };
  /** Drawn on every floor cell after tone and mottling (e.g. slab seams). */
  floorEvery?(pen: Pen, p: ZonePalette, r: Rand, v: FloorVariant): void;
  /** The motif on detail cells. */
  floorDetail?(pen: Pen, p: ZonePalette, r: Rand, v: FloorVariant): void;
  faces: number;
  /** Face texture below the cap band; `top` is where the face starts (12). */
  face(pen: Pen, p: ZonePalette, r: Rand, variant: number, top: number): void;
  /** Frost, snow or growth on caps and rim overlays. */
  capAccent?(pen: Pen, p: ZonePalette, r: Rand, where: 'cap' | 'rimN' | 'rimE' | 'rimW'): void;
  /** Extra texture on wall tops (the rock mass). */
  topTexture?(pen: Pen, p: ZonePalette, r: Rand): void;
  /** Building interiors only draw floors and wall faces; the rest comes from the parent zone. */
  interior?: boolean;
  door?: DoorPalette;
  pillar?(pen: Pen, p: ZonePalette): void;
  liquid?: LiquidPattern;
  /** Extra marks on the liquid body (64-unit, seamless). */
  liquidExtra?(pen: Pen, p: ZonePalette, r: Rand): void;
  pit?: PitPattern;
  /** Extra marks on the pit body (64-unit, seamless). */
  pitExtra?(pen: Pen, p: ZonePalette, r: Rand): void;
}

const TOP = 12;

/** A recipe drawing in cell-local 32-unit space, clipped to its cell. */
function cell(draw: (pen: Pen) => void): SpriteRecipe {
  return (ctx: Pen, ox: number, oy: number) => {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.rect(0, 0, 32, 32);
    ctx.clip();
    draw(ctx);
    ctx.restore();
  };
}

// ───────────────────────── floors ─────────────────────────

/**
 * A floor cell: its tone's seamless 64-unit mottle (so shading flows across the 2x2 block
 * and on into the next), then the zone's per-cell marks. Nothing repeats at cell scale.
 */
function drawFloor(pen: Pen, z: ZoneArt, v: FloorVariant): void {
  const p = z.pal;
  // Tones are texture variants a hair apart in value, so a change of tone between cells
  // never shows as an edge; the feathered patches carry the shading.
  const base = [mix(p.floor, p.floorLo, 0.3), p.floor, mix(p.floor, p.floorHi, 0.3)][Math.min(2, v.tone)];
  macroQuadrant(pen, v.q, (p64) => {
    const m = seeded(`${z.key}|mottle|${v.tone}`);
    p64.fillStyle = base;
    p64.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) {
      const cx = m() * 64;
      const cy = m() * 64;
      const rad = 10 + m() * 14;
      const g = p64.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, rgba(i % 2 ? p.floorHi : p.floorLo, 0.55));
      g.addColorStop(1, rgba(i % 2 ? p.floorHi : p.floorLo, 0));
      p64.fillStyle = g;
      p64.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  });
  const r = seeded(`${z.key}|f|${v.tone}|${v.detail}|${v.n}|${v.q}`);
  z.floorEvery?.(pen, p, r, v);
  if (v.detail) z.floorDetail?.(pen, p, r, v);
}

// ───────────────────────── walls ─────────────────────────

function drawTop(pen: Pen, z: ZoneArt): void {
  const p = z.pal;
  const r = seeded(`${z.key}|top`);
  // The rock mass stays flat: it is negative space, and any per-cell mark would repeat.
  pen.fillStyle = p.void;
  pen.fillRect(0, 0, 32, 32);
  z.topTexture?.(pen, p, r);
}

function drawFace(pen: Pen, z: ZoneArt, variant: number): void {
  const p = z.pal;
  const r = seeded(`${z.key}|face|${variant}`);
  pen.fillStyle = p.void;
  pen.fillRect(0, 0, 32, TOP);
  const g = pen.createLinearGradient(0, TOP, 0, 32);
  g.addColorStop(0, p.face);
  g.addColorStop(1, p.faceLo);
  pen.fillStyle = g;
  pen.fillRect(0, TOP, 32, 32 - TOP);
  z.face(pen, p, r, variant, TOP);
  pen.fillStyle = p.cap;
  pen.fillRect(0, TOP - 3, 32, 3);
  pen.fillStyle = 'rgba(0,0,0,0.3)';
  pen.fillRect(0, TOP, 32, 1);
  const base = pen.createLinearGradient(0, 26, 0, 32);
  base.addColorStop(0, 'rgba(0,0,0,0)');
  base.addColorStop(1, 'rgba(0,0,0,0.38)');
  pen.fillStyle = base;
  pen.fillRect(0, 26, 32, 6);
  z.capAccent?.(pen, p, r, 'cap');
}

function wallOverlays(z: ZoneArt): Record<string, (pen: Pen) => void> {
  const p = z.pal;
  const accent = (where: 'rimN' | 'rimE' | 'rimW') => (pen: Pen) => z.capAccent?.(pen, p, seeded(`${z.key}|${where}`), where);
  return {
    rimN: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(0, 0, 32, 2);
      accent('rimN')(pen);
    },
    rimE: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(30, 0, 2, 32);
      accent('rimE')(pen);
    },
    rimW: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(0, 0, 2, 32);
      accent('rimW')(pen);
    },
    edgeE: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(30, 0, 2, TOP - 3);
      pen.fillStyle = 'rgba(0,0,0,0.32)';
      pen.fillRect(30.6, TOP, 1.4, 32 - TOP);
    },
    edgeW: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(0, 0, 2, TOP - 3);
      pen.fillStyle = rgba(p.cap, 0.35);
      pen.fillRect(0, TOP, 1.4, 32 - TOP);
    },
    cornerNE: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(30, 0, 2, 2);
    },
    cornerNW: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(0, 0, 2, 2);
    },
    cornerSE: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(30, TOP - 3, 2, 32 - TOP + 3);
    },
    cornerSW: (pen) => {
      pen.fillStyle = p.rim;
      pen.fillRect(0, TOP - 3, 2, 32 - TOP + 3);
    },
  };
}

// ───────────────────────── liquids and pits ─────────────────────────

function liquidBody(pen: Pen, z: ZoneArt): void {
  const p = z.pal;
  const kind = z.liquid ?? 'ripple';
  const r = seeded(`${z.key}|liquid`);
  pen.fillStyle = p.liquid;
  pen.fillRect(0, 0, 64, 64);
  if (kind === 'ice') {
    for (let i = 0; i < 4; i++) {
      pen.fillStyle = rgba(p.liquidHi, 0.08);
      ell(pen, r() * 64, r() * 64, 8 + r() * 10, 5 + r() * 6, r() * 3);
      pen.fill();
    }
    pen.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      let x = r() * 64;
      let y = r() * 64;
      pen.strokeStyle = rgba(p.liquidHi, 0.5);
      pen.beginPath();
      pen.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
        x += 5 + r() * 7;
        y += (r() - 0.5) * 12;
        pen.lineTo(x, y);
      }
      pen.stroke();
    }
    pen.fillStyle = rgba(p.glow, 0.45);
    pen.fillRect(12 + r() * 40, 12 + r() * 40, 2, 1);
  } else {
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = rgba(p.liquidHi, 0.07);
      ell(pen, r() * 64, r() * 64, 9 + r() * 8, 5 + r() * 4);
      pen.fill();
    }
    // Ripple bands run the full 64 units with a 32-unit period, so they meet across cells.
    for (const y0 of [8, 24, 40, 56]) {
      const phase = r() * Math.PI * 2;
      pen.lineWidth = 1;
      pen.strokeStyle = rgba(p.liquidHi, kind === 'magma' ? 0.65 : 0.38);
      pen.beginPath();
      for (let x = 0; x <= 64; x += 2) {
        const y = y0 + Math.sin((x / 32) * Math.PI * 2 + phase) * 1.3;
        if (x === 0) pen.moveTo(x, y);
        else pen.lineTo(x, y);
      }
      pen.stroke();
      pen.strokeStyle = 'rgba(0,0,0,0.2)';
      pen.beginPath();
      for (let x = 0; x <= 64; x += 2) {
        const y = y0 + 1.6 + Math.sin((x / 32) * Math.PI * 2 + phase) * 1.3;
        if (x === 0) pen.moveTo(x, y);
        else pen.lineTo(x, y);
      }
      pen.stroke();
    }
  }
  z.liquidExtra?.(pen, p, r);
}

function liquidEdge(pen: Pen, z: ZoneArt, side: 'N' | 'E' | 'S' | 'W'): void {
  const p = z.pal;
  const ice = z.liquid === 'ice';
  const bank = mix(p.floor, p.rim, 0.5);
  const lip = ice ? rgba(p.accent, 0.55) : rgba(p.liquidHi, 0.28);
  if (side === 'N') {
    const g = pen.createLinearGradient(0, 0, 0, 5);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pen.fillStyle = g;
    pen.fillRect(0, 0, 32, 5);
    pen.fillStyle = bank;
    pen.fillRect(0, 0, 32, 1);
  } else if (side === 'S') {
    pen.fillStyle = lip;
    pen.fillRect(0, 30.2, 32, 1);
    pen.fillStyle = bank;
    pen.fillRect(0, 31.2, 32, 0.8);
  } else {
    const x = side === 'W' ? 0 : 29;
    const g = pen.createLinearGradient(side === 'W' ? 0 : 32, 0, side === 'W' ? 3 : 29, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pen.fillStyle = g;
    pen.fillRect(x, 0, 3, 32);
    pen.fillStyle = bank;
    pen.fillRect(side === 'W' ? 0 : 31, 0, 1, 32);
  }
  if (ice) {
    const r = seeded(`${z.key}|ice-edge|${side}`);
    pen.fillStyle = rgba(p.accent, 0.5);
    for (let i = 0; i < 4; i++) {
      const t = 2 + r() * 26;
      if (side === 'N') pen.fillRect(t, 1, 1.5 + r() * 2, 1);
      else if (side === 'S') pen.fillRect(t, 29.5, 1.5 + r() * 2, 1);
      else pen.fillRect(side === 'W' ? 1 : 30, t, 1, 1.5 + r() * 2);
    }
  }
}

function pitBody(pen: Pen, z: ZoneArt): void {
  const p = z.pal;
  const kind = z.pit ?? 'void';
  const r = seeded(`${z.key}|pit`);
  if (kind === 'void') {
    pen.fillStyle = '#040506';
    pen.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 5; i++) {
      pen.fillStyle = rgba(p.pitFace, 0.35);
      ell(pen, r() * 64, r() * 64, 3 + r() * 6, 2 + r() * 3);
      pen.fill();
    }
  } else {
    const lava = kind === 'lava';
    pen.fillStyle = lava ? '#e2651c' : '#3a1408';
    pen.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 6; i++) {
      pen.fillStyle = lava ? rgba('#f59e0b', 0.55) : rgba('#e0793a', 0.75);
      ell(pen, r() * 64, r() * 64, lava ? 6 + r() * 7 : 2 + r() * 3, lava ? 4 + r() * 5 : 1.5 + r() * 2, r() * 3);
      pen.fill();
    }
    for (let i = 0; i < (lava ? 7 : 10); i++) {
      const cx = r() * 64;
      const cy = r() * 64;
      const rad = lava ? 3.5 + r() * 4.5 : 2 + r() * 2.5;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + r() * 0.5;
        const rr = rad * (0.7 + r() * 0.5);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      pen.fillStyle = lava ? rgba('#ffd27a', 0.55) : rgba('#f7a14a', 0.4);
      poly(pen, pts.map(([x, y]) => [cx + (x - cx) * 1.15, cy + (y - cy) * 1.15] as [number, number]));
      pen.fill();
      pen.fillStyle = lava ? '#2b140f' : '#1a0c08';
      poly(pen, pts);
      pen.fill();
    }
  }
  z.pitExtra?.(pen, p, r);
}

function pitEdge(pen: Pen, z: ZoneArt, side: 'N' | 'E' | 'S' | 'W'): void {
  const p = z.pal;
  if (z.pit === 'lava' || z.pit === 'coals') {
    pen.fillStyle = '#170b08';
    if (side === 'N') pen.fillRect(0, 0, 32, 3);
    if (side === 'S') pen.fillRect(0, 29, 32, 3);
    if (side === 'W') pen.fillRect(0, 0, 3, 32);
    if (side === 'E') pen.fillRect(29, 0, 3, 32);
    pen.fillStyle = rgba('#9a3412', 0.9);
    if (side === 'N') pen.fillRect(0, 3, 32, 0.8);
    if (side === 'S') pen.fillRect(0, 28.2, 32, 0.8);
    if (side === 'W') pen.fillRect(3, 0, 0.8, 32);
    if (side === 'E') pen.fillRect(28.2, 0, 0.8, 32);
    return;
  }
  if (side === 'N') {
    const g = pen.createLinearGradient(0, 0, 0, 13);
    g.addColorStop(0, p.pitFace);
    g.addColorStop(1, 'rgba(3,4,5,0)');
    pen.fillStyle = g;
    pen.fillRect(0, 0, 32, 13);
    pen.fillStyle = p.rim;
    pen.fillRect(0, 0, 32, 1.5);
  } else if (side === 'S') {
    pen.fillStyle = p.cap;
    pen.fillRect(0, 30, 32, 2);
  } else {
    pen.fillStyle = p.rim;
    pen.fillRect(side === 'W' ? 0 : 30.5, 0, 1.5, 32);
  }
}

// ───────────────────────── doors ─────────────────────────

function doorSlab(pen: Pen, d: DoorPalette, x0: number, y0: number, w: number, h: number): void {
  const g = pen.createLinearGradient(x0, 0, x0 + w, 0);
  g.addColorStop(0, d.wood);
  g.addColorStop(1, d.woodDark);
  pen.fillStyle = g;
  pen.fillRect(x0, y0, w, h);
  pen.fillStyle = rgba(d.seam, 0.9);
  for (let i = 1; i < 4; i++) pen.fillRect(x0 + (w * i) / 4, y0, 0.8, h);
  pen.fillStyle = rgba(mix(d.wood, '#ffffff', 0.25), 0.8);
  pen.fillRect(x0, y0, w, 0.8);
}

function drawFaceDoor(pen: Pen, z: ZoneArt, d: DoorPalette, open: boolean): void {
  const p = z.pal;
  // The passage runs through: floor above and below the door, rims continuing the
  // corridor's walls on both sides, so the doorway reads as connected.
  pen.fillStyle = p.floor;
  pen.fillRect(0, 0, 32, 32);
  pen.fillStyle = p.rim;
  pen.fillRect(0, 0, 2, TOP - 2);
  pen.fillRect(30, 0, 2, TOP - 2);
  for (const x of [2, 25]) {
    pen.fillStyle = p.face;
    pen.fillRect(x, TOP - 3, 5, 32 - TOP + 3);
    pen.fillStyle = p.cap;
    pen.fillRect(x, TOP - 3, 5, 2.4);
    pen.fillStyle = 'rgba(0,0,0,0.3)';
    pen.fillRect(x === 2 ? 6 : 25, TOP - 1, 1, 32 - TOP + 1);
  }
  pen.fillStyle = 'rgba(0,0,0,0.55)';
  pen.fillRect(7, TOP - 1, 18, 32 - TOP + 1);
  if (!open) {
    doorSlab(pen, d, 8, TOP, 16, 32 - TOP);
    for (const y of [TOP + 3, TOP + 14]) {
      pen.fillStyle = d.band;
      pen.fillRect(8, y, 16, 2);
      pen.fillStyle = d.bandLight;
      pen.fillRect(8, y, 16, 0.6);
    }
    pen.strokeStyle = d.ring;
    pen.lineWidth = 1;
    pen.beginPath();
    pen.arc(20.3, TOP + 9.5, 1.7, 0, Math.PI * 2);
    pen.stroke();
  } else {
    pen.fillStyle = '#050608';
    pen.fillRect(8, TOP, 16, 32 - TOP);
    pen.fillStyle = d.woodDark;
    poly(pen, [[8, TOP], [11.5, TOP + 2], [11.5, 30], [8, 32]]);
    pen.fill();
    pen.fillStyle = rgba(mix(d.wood, '#ffffff', 0.2), 0.7);
    pen.fillRect(11, TOP + 2, 0.6, 28 - TOP);
    pen.fillStyle = p.floor;
    pen.fillRect(12, 29.5, 12, 2.5);
  }
}

function drawSideDoor(pen: Pen, d: DoorPalette, open: boolean): void {
  pen.fillStyle = 'rgba(0,0,0,0.35)';
  pen.fillRect(10.5, 0, 11, 32);
  if (!open) {
    doorSlab(pen, d, 12.5, 1, 7, 30);
    pen.fillStyle = mix(d.wood, '#ffffff', 0.2);
    pen.fillRect(12.5, 1, 7, 1.6);
    for (const y of [7, 24]) {
      pen.fillStyle = d.band;
      pen.fillRect(12, y, 8, 1.8);
      pen.fillStyle = d.bandLight;
      pen.fillRect(12, y, 8, 0.6);
    }
  } else {
    pen.fillStyle = d.woodDark;
    pen.fillRect(2, 1, 3.5, 30);
    pen.fillStyle = d.wood;
    pen.fillRect(2, 1, 1, 30);
  }
}

// ───────────────────────── props ─────────────────────────

function drawStairs(pen: Pen, p: ZonePalette, down: boolean): void {
  pen.lineJoin = 'round';
  if (down) {
    pen.fillStyle = 'rgba(0,0,0,0.45)';
    pen.beginPath();
    pen.roundRect(4, 5, 24, 24, 3);
    pen.fill();
    pen.fillStyle = '#050608';
    pen.beginPath();
    pen.roundRect(5.5, 6.5, 21, 21, 2);
    pen.fill();
    for (let i = 0; i < 4; i++) {
      const y = 8.5 + i * 4.4;
      const inset = 1.5 + i * 1.7;
      pen.fillStyle = mix(p.cap, '#050608', 0.2 + i * 0.23);
      pen.fillRect(6.5 + inset, y, 19 - 2 * inset, 2.3);
    }
    pen.strokeStyle = p.rim;
    pen.lineWidth = 1;
    pen.beginPath();
    pen.roundRect(5.5, 6.5, 21, 21, 2);
    pen.stroke();
    poly(pen, [[11.5, 20], [20.5, 20], [16, 25.5]]);
  } else {
    for (let i = 0; i < 5; i++) {
      const y = 24 - i * 4.4;
      const w = 22 - i * 1.6;
      pen.fillStyle = 'rgba(0,0,0,0.45)';
      pen.fillRect(16 - w / 2, y + 2.6, w, 1.6);
      pen.fillStyle = mix(p.face, p.cap, i / 4);
      pen.fillRect(16 - w / 2, y, w, 2.8);
    }
    poly(pen, [[11.5, 17], [20.5, 17], [16, 11.5]]);
  }
  // The arrow is the one near-white in the environment: findable in memory and greyscale.
  pen.strokeStyle = '#0b0d10';
  pen.lineWidth = 2.2;
  pen.stroke();
  pen.fillStyle = '#ddd2b9';
  pen.fill();
}

function drawTrap(pen: Pen, p: ZonePalette): void {
  pen.fillStyle = mix(p.floorHi, p.cap, 0.3);
  pen.fillRect(8, 8, 16, 16);
  pen.fillStyle = rgba(p.cap, 0.7);
  pen.fillRect(8, 8, 16, 1);
  pen.fillRect(8, 8, 1, 16);
  pen.fillStyle = 'rgba(0,0,0,0.5)';
  pen.fillRect(8, 23, 16, 1);
  pen.fillRect(23, 8, 1, 16);
  pen.lineJoin = 'round';
  pen.strokeStyle = '#1a1206';
  pen.lineWidth = 2.2;
  poly(pen, [[16, 10], [22, 16], [16, 22], [10, 16]]);
  pen.stroke();
  pen.fillStyle = '#d4a24c';
  pen.fill();
  pen.fillStyle = '#1a1206';
  ell(pen, 16, 16, 1.6, 1.6);
  pen.fill();
}

function drawBars(pen: Pen, p: ZonePalette): void {
  pen.fillStyle = mix(p.face, '#000000', 0.2);
  pen.fillRect(1, 27, 30, 4);
  pen.fillStyle = rgba(p.cap, 0.5);
  pen.fillRect(1, 27, 30, 1);
  for (const x of [5, 12, 19, 26]) {
    pen.fillStyle = '#565d66';
    pen.fillRect(x, 3, 3, 24.5);
    pen.fillStyle = '#8f98a3';
    pen.fillRect(x, 3, 1, 24.5);
    pen.fillStyle = '#2e3339';
    pen.fillRect(x + 2.2, 3, 0.8, 24.5);
  }
  pen.fillStyle = '#4b5259';
  pen.fillRect(2, 9, 28, 2);
  pen.fillStyle = '#7c858f';
  pen.fillRect(2, 9, 28, 0.8);
}

function drawPillar(pen: Pen, z: ZoneArt): void {
  pen.fillStyle = 'rgba(0,0,0,0.45)';
  ell(pen, 17, 28.2, 10.5, 3.2);
  pen.fill();
  z.pillar?.(pen, z.pal);
}

// ───────────────────────── assembly ─────────────────────────

/** Every recipe a zone contributes, keyed per the terrain key grammar. */
export function buildZoneRecipes(z: ZoneArt): Record<string, SpriteRecipe> {
  const out: Record<string, SpriteRecipe> = {};
  const k = z.key;
  const tones = z.floor.tones ?? 3;
  const details = z.floor.details ?? 0;
  // Floors are always 2x2 macro tiles: the mottle is continuous across cells.
  for (const q of [0, 1, 2, 3]) {
    const qp = `q${q}`;
    for (let t = 0; t < tones; t++) out[`floor_${k}~${qp}t${t}`] = cell((pen) => drawFloor(pen, z, { tone: t, detail: false, n: 0, q }));
    for (let d = 0; d < details; d++) out[`floor_${k}~${qp}d${d}`] = cell((pen) => drawFloor(pen, z, { tone: 1, detail: true, n: d, q }));
  }
  for (let f = 0; f < z.faces; f++) out[`wall_${k}~face${f}`] = cell((pen) => drawFace(pen, z, f));
  if (z.interior) return out;

  out[`wall_${k}~top`] = cell((pen) => drawTop(pen, z));
  for (const [part, draw] of Object.entries(wallOverlays(z))) out[`wall_${k}~${part}`] = cell(draw);

  for (let q = 0; q < 4; q++) {
    out[`water_${k}~q${q}`] = cell((pen) => macroQuadrant(pen, q, (p64) => liquidBody(p64, z)));
    out[`chasm_${k}~q${q}`] = cell((pen) => macroQuadrant(pen, q, (p64) => pitBody(p64, z)));
  }
  for (const side of ['N', 'E', 'S', 'W'] as const) {
    out[`water_${k}~edge${side}`] = cell((pen) => liquidEdge(pen, z, side));
    out[`chasm_${k}~edge${side}`] = cell((pen) => pitEdge(pen, z, side));
  }

  const door = z.door;
  if (door) {
    out[`door_closed_${k}~face`] = cell((pen) => drawFaceDoor(pen, z, door, false));
    out[`door_open_${k}~face`] = cell((pen) => drawFaceDoor(pen, z, door, true));
    out[`door_closed_${k}~side`] = cell((pen) => drawSideDoor(pen, door, false));
    out[`door_open_${k}~side`] = cell((pen) => drawSideDoor(pen, door, true));
  }
  out[`stairs_down_${k}~prop`] = cell((pen) => drawStairs(pen, z.pal, true));
  out[`stairs_up_${k}~prop`] = cell((pen) => drawStairs(pen, z.pal, false));
  out[`trap_${k}~prop`] = cell((pen) => drawTrap(pen, z.pal));
  out[`bars_${k}~prop`] = cell((pen) => drawBars(pen, z.pal));
  if (z.pillar) out[`pillar_${k}~prop`] = cell((pen) => drawPillar(pen, z));
  return out;
}
