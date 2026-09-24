import type { SpriteRecipe } from '../../../../engine';
import type { ZoneArt, ZonePalette } from '../kit';
import { type Pen, seeded, rgba, mix, ell, poly, macroQuadrant } from '../pen';

/*
 * Bjarnarhaven: moonlit snow outside, hearth-lit timber inside. Snow caps every roofline,
 * lit windows mark the houses, and the town's things (fountain, statues, carts, stalls)
 * are props over the snow. Building interiors draw only their floors and wall faces; the
 * rest comes from the town (terrain keys fall back from `town_<type>` to `town`).
 */

const SNOW = '#dfe7ee';
const TIMBER = '#4b3322';
const TIMBER_DARK = '#33231a';
const HEARTH = '#e8914a';

const OUTSIDE: ZonePalette = {
  void: '#15181d',
  floorLo: '#2e3742',
  floor: '#343d48',
  floorHi: '#3a4450',
  faceLo: TIMBER_DARK,
  face: TIMBER,
  rim: '#8795a4',
  cap: '#b8c3ce',
  accent: SNOW,
  glow: HEARTH,
  liquid: '#223644',
  liquidHi: '#8fb1c4',
  pitFace: '#1b2129',
};

const TOWN_DOOR = { wood: '#7a502d', woodDark: '#4b2f1a', seam: '#2e1c0f', band: '#2b2c31', bandLight: '#5a5c63', ring: '#b08d4c' };

export const TOWN: ZoneArt = {
  key: 'town',
  pal: OUTSIDE,
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.08 },
  floorDetail(pen, p, r, v) {
    if (v.n === 0) {
      // A soft drift catching the moonlight.
      const cx = 10 + r() * 12;
      const cy = 10 + r() * 12;
      const g = pen.createRadialGradient(cx, cy, 0, cx, cy, 10);
      g.addColorStop(0, rgba(p.accent, 0.16));
      g.addColorStop(1, rgba(p.accent, 0));
      pen.fillStyle = g;
      pen.fillRect(cx - 10, cy - 10, 20, 20);
    } else {
      // Dead grass poking through.
      pen.strokeStyle = rgba('#7d7358', 0.6);
      pen.lineWidth = 0.7;
      const cx = 10 + r() * 12;
      const cy = 14 + r() * 10;
      for (let i = 0; i < 5; i++) {
        pen.beginPath();
        pen.moveTo(cx + (i - 2) * 1.4, cy);
        pen.lineTo(cx + (i - 2) * 1.8 + (r() - 0.5) * 2, cy - 2.5 - r() * 2);
        pen.stroke();
      }
    }
  },
  faces: 2,
  // Log walls; the variant has a shuttered window lit from inside.
  face(pen, p, _r, v, top) {
    for (let i = 0; i < 3; i++) {
      const y = top + 1 + i * 6.3;
      pen.fillStyle = mix(p.face, i % 2 ? p.faceLo : p.face, 0.4);
      pen.beginPath();
      pen.roundRect(0, y, 32, 5.6, 2.6);
      pen.fill();
      pen.fillStyle = 'rgba(255,255,255,0.07)';
      pen.fillRect(1, y + 0.6, 30, 1);
      pen.fillStyle = 'rgba(0,0,0,0.35)';
      pen.fillRect(0, y + 5.2, 32, 0.8);
    }
    if (v === 1) {
      pen.fillStyle = '#120d0a';
      pen.fillRect(11, top + 5, 10, 8);
      pen.fillStyle = rgba(HEARTH, 0.85);
      pen.fillRect(12, top + 6, 8, 6);
      pen.fillStyle = '#3a2618';
      pen.fillRect(15.5, top + 5, 1, 8);
      pen.fillRect(11, top + 8.6, 10, 0.9);
    }
  },
  capAccent(pen, p, r, where) {
    pen.fillStyle = rgba(p.accent, 0.95);
    if (where === 'cap') {
      for (let i = 0; i < 4; i++) {
        ell(pen, 3 + r() * 26, 9, 2.5 + r() * 2, 1.2);
        pen.fill();
      }
    } else if (where === 'rimN') {
      pen.fillRect(0, 0, 32, 1.2);
    } else {
      pen.fillRect(where === 'rimW' ? 0 : 30.8, 0, 1.2, 32);
    }
  },
  door: TOWN_DOOR,
  pillar(pen) {
    pen.fillStyle = TIMBER;
    pen.fillRect(12, 5, 8, 23);
    pen.fillStyle = '#6a4a31';
    pen.fillRect(12, 5, 2, 23);
    pen.fillStyle = SNOW;
    pen.fillRect(11, 4, 10, 1.6);
  },
  liquid: 'ice',
  pit: 'void',
};

/** A building interior: its own floor and the wall faces seen from inside. */
function interior(
  key: string,
  pal: Pick<ZonePalette, 'floorLo' | 'floor' | 'floorHi' | 'faceLo' | 'face' | 'cap' | 'accent'>,
  floorEvery: ZoneArt['floorEvery'],
  face: ZoneArt['face']
): ZoneArt {
  return {
    key,
    interior: true,
    pal: { ...OUTSIDE, ...pal },
    floor: { kind: 'field', tones: 3, details: 0 },
    floorEvery,
    faces: 2,
    face,
  };
}

/** Plank or slab seams laid across a 2x2 block: each quadrant draws its share. */
function seams(pen: Pen, q: number, color: string, planks: boolean): void {
  const qx = q & 1;
  const qy = q >> 1;
  pen.fillStyle = color;
  if (planks) {
    // Boards run east-west; their butt joints fall in different places per row.
    for (let i = 1; i < 4; i++) pen.fillRect(0, i * 8, 32, 0.9);
    for (let row = 0; row < 4; row++) pen.fillRect(((row * 11 + qx * 16 + qy * 5) % 32) + 0.5, row * 8, 0.9, 8);
  } else {
    pen.fillRect(qx ? 31 : 0, 0, 1, 32);
    pen.fillRect(0, qy ? 31 : 0, 32, 1);
  }
}

export const TOWN_SHOP = interior(
  'town_shop',
  { floorLo: '#352416', floor: '#3b2919', floorHi: '#412e1d', face: '#4a3220', faceLo: '#352316', cap: '#6a4a31', accent: '#6f8f8a' },
  (pen, _p, _r, v) => seams(pen, v.q, 'rgba(20,12,6,0.8)', true),
  (pen, p, _r, _v, top) => {
    pen.fillStyle = p.faceLo;
    pen.fillRect(0, top + 9, 32, 2.4);
    pen.fillRect(0, top + 17, 32, 2);
    const goods = ['#6f8f8a', '#a37b3f', '#8a4a3c', '#7f8a5a'];
    for (let i = 0; i < 4; i++) {
      pen.fillStyle = rgba(goods[i], 0.8);
      pen.fillRect(3 + i * 7.5, top + 4.5, 4, 4.5);
      pen.fillStyle = rgba(goods[(i + 2) % 4], 0.7);
      pen.fillRect(5 + i * 7.5, top + 13, 3.5, 4);
    }
  }
);

export const TOWN_SMITHY = interior(
  'town_smithy',
  { floorLo: '#1f1c1a', floor: '#24201d', floorHi: '#2a2521', face: '#2e2a27', faceLo: '#1f1c1a', cap: '#4a4440', accent: '#c46a32' },
  (pen, p, r, v) => {
    seams(pen, v.q, 'rgba(0,0,0,0.4)', false);
    if (r() < 0.3) {
      pen.fillStyle = rgba(p.accent, 0.55);
      pen.fillRect(6 + r() * 20, 6 + r() * 20, 1.1, 1.1);
    }
  },
  (pen, _p, _r, _v, top) => {
    const g = pen.createLinearGradient(0, top, 0, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pen.fillStyle = g;
    pen.fillRect(0, top, 32, 32 - top);
    pen.fillStyle = '#5b5f66';
    pen.fillRect(4, top + 5, 24, 1.4);
    for (const x of [8, 16, 24]) {
      pen.fillStyle = '#6b7079';
      pen.fillRect(x, top + 6, 1.2, 5 + (x % 3));
    }
  }
);

export const TOWN_TEMPLE = interior(
  'town_temple',
  { floorLo: '#2e3238', floor: '#33373e', floorHi: '#393e45', face: '#4a4f57', faceLo: '#383c43', cap: '#6e737b', accent: '#b8953f' },
  // Flagstones with a gold ring centred on each 2x2 slab.
  (pen, p, _r, v) => {
    seams(pen, v.q, 'rgba(0,0,0,0.3)', false);
    pen.strokeStyle = rgba(p.accent, 0.5);
    pen.lineWidth = 1.1;
    pen.beginPath();
    pen.arc(v.q & 1 ? 0 : 32, v.q >> 1 ? 0 : 32, 10, 0, Math.PI * 2);
    pen.stroke();
  },
  (pen, p, _r, v, top) => {
    pen.fillStyle = p.faceLo;
    pen.fillRect(0, top + 10, 32, 1);
    for (const x of [10, 22]) pen.fillRect(x, top, 1, 10);
    for (const x of [4, 16, 28]) pen.fillRect(x, top + 11, 1, 9);
    if (v === 1) {
      pen.strokeStyle = rgba(p.accent, 0.8);
      pen.lineWidth = 1.2;
      pen.beginPath();
      pen.moveTo(16, top + 2);
      pen.lineTo(16, top + 9);
      pen.moveTo(12.5, top + 2.5);
      pen.lineTo(19.5, top + 2.5);
      pen.stroke();
    }
  }
);

export const TOWN_BANK = interior(
  'town_bank',
  { floorLo: '#22272e', floor: '#272c33', floorHi: '#2d333b', face: '#353c45', faceLo: '#262c33', cap: '#4f5761', accent: '#8c96a0' },
  (pen, p, _r, v) => {
    seams(pen, v.q, 'rgba(0,0,0,0.32)', false);
    pen.strokeStyle = rgba(p.accent, 0.3);
    pen.lineWidth = 0.8;
    pen.strokeRect(v.q & 1 ? -1 : 6, v.q >> 1 ? -1 : 6, 27, 27);
  },
  (pen, p, _r, _v, top) => {
    pen.fillStyle = p.faceLo;
    pen.fillRect(0, top + 10, 32, 1);
    for (const x of [12, 26]) pen.fillRect(x, top, 1, 10);
    pen.fillStyle = '#4a525c';
    pen.fillRect(0, top + 13, 32, 3);
    pen.fillStyle = '#8c96a0';
    for (const x of [5, 16, 27]) pen.fillRect(x, top + 14, 1.2, 1.2);
  }
);

export const TOWN_HOUSE = interior(
  'town_house',
  { floorLo: '#302116', floor: '#35251a', floorHi: '#3a291d', face: '#46301f', faceLo: '#33231a', cap: '#5a3f2a', accent: '#8a6a44' },
  (pen, _p, _r, v) => seams(pen, v.q, 'rgba(20,12,6,0.75)', true),
  (pen, p, _r, v, top) => {
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = mix(p.face, p.faceLo, (i % 2) * 0.5);
      pen.fillRect(0, top + 1 + i * 6.3, 32, 5.6);
    }
    if (v === 1) {
      // A hanging shield and axe.
      pen.fillStyle = '#6a3a24';
      ell(pen, 11, top + 8, 4, 4);
      pen.fill();
      pen.fillStyle = '#a58a52';
      ell(pen, 11, top + 8, 1.2, 1.2);
      pen.fill();
      pen.fillStyle = '#7d8590';
      poly(pen, [[20, top + 4], [25, top + 5], [23, top + 9]]);
      pen.fill();
    }
  }
);

// ───────────────────────── the town's things ─────────────────────────

/** Cobbles on a staggered grid, with snow lodged in the joints; seamless over 64 units. */
function cobbles(pen: Pen): void {
  pen.fillStyle = '#2a2b2e';
  pen.fillRect(0, 0, 64, 64);
  const r = seeded('town-cobbles');
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * 8 + (row % 2) * 4 + (r() - 0.5);
      const y = row * 8 + (r() - 0.5);
      const shade = r();
      pen.fillStyle = mix('#3b3c40', '#4a4a4c', shade);
      pen.beginPath();
      pen.roundRect(x + 0.7, y + 0.7, 6.6, 6.4, 2.2);
      pen.fill();
      pen.fillStyle = 'rgba(255,255,255,0.08)';
      pen.fillRect(x + 1.6, y + 1.2, 4.6, 0.8);
    }
  }
  for (let i = 0; i < 10; i++) {
    pen.fillStyle = rgba(SNOW, 0.18);
    ell(pen, r() * 64, r() * 64, 3 + r() * 5, 1.2 + r() * 1.5, r() * 3);
    pen.fill();
  }
}

function roadEdge(pen: Pen, side: 'N' | 'E' | 'S' | 'W'): void {
  const r = seeded(`town-road-edge-${side}`);
  pen.fillStyle = rgba(SNOW, 0.35);
  for (let t = 0; t < 32; t += 3) {
    const depth = 1.2 + r() * 2.2;
    if (side === 'N') pen.fillRect(t, 0, 3.2, depth);
    else if (side === 'S') pen.fillRect(t, 32 - depth, 3.2, depth);
    else if (side === 'W') pen.fillRect(0, t, depth, 3.2);
    else pen.fillRect(32 - depth, t, depth, 3.2);
  }
}

/** The plaza fountain, 64x64 over a 2x2 block: frozen basin, spout pillar, icicles. */
function fountain(pen: Pen): void {
  cobbles(pen);
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 33, 36, 27, 21);
  pen.fill();
  pen.fillStyle = '#6e737b';
  ell(pen, 32, 33, 27, 21);
  pen.fill();
  pen.fillStyle = '#8a9099';
  ell(pen, 32, 31.5, 27, 20);
  pen.fill();
  pen.fillStyle = rgba(SNOW, 0.85);
  ell(pen, 32, 14, 17, 3.2);
  pen.fill();
  pen.fillStyle = '#4b6f86';
  ell(pen, 32, 33, 21, 15);
  pen.fill();
  pen.fillStyle = rgba('#a9cadb', 0.45);
  ell(pen, 26, 29, 10, 5, -0.3);
  pen.fill();
  pen.strokeStyle = rgba('#dff1fa', 0.55);
  pen.lineWidth = 0.8;
  pen.beginPath();
  pen.moveTo(18, 38);
  pen.lineTo(27, 35);
  pen.lineTo(34, 40);
  pen.lineTo(45, 36);
  pen.stroke();
  // The spout: a carved post with a raven on top.
  pen.fillStyle = '#5d636b';
  pen.fillRect(29, 18, 6, 17);
  pen.fillStyle = '#8a9099';
  pen.fillRect(29, 18, 2, 17);
  pen.fillStyle = '#6e737b';
  pen.fillRect(27, 16, 10, 3);
  pen.fillStyle = '#1e2126';
  poly(pen, [[29, 16], [35, 16], [37, 12], [33, 10], [31, 11]]);
  pen.fill();
  pen.fillStyle = rgba(SNOW, 0.9);
  pen.fillRect(27, 15.4, 10, 1.2);
  pen.fillStyle = rgba('#dff1fa', 0.8);
  for (const x of [19, 24, 40, 45]) poly(pen, [[x - 1, 45], [x + 1, 45], [x, 49]]), pen.fill();
}

function pine(pen: Pen): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 17, 29, 10, 3);
  pen.fill();
  pen.fillStyle = '#3a2618';
  pen.fillRect(15, 24, 3, 6);
  const tiers: Array<[number, number, number]> = [[26, 12, 8], [19, 10, 7], [12, 7, 7]];
  for (const [base, half, h] of tiers) {
    pen.fillStyle = '#1b3328';
    poly(pen, [[16.5 - half, base], [16.5 + half, base], [16.5, base - h - 3]]);
    pen.fill();
    pen.fillStyle = '#26473a';
    poly(pen, [[16.5 - half, base], [16.5, base], [16.5, base - h - 3]]);
    pen.fill();
    pen.fillStyle = rgba(SNOW, 0.85);
    poly(pen, [[16.5 - half * 0.7, base - h * 0.35], [16.5, base - h - 2], [16.5 + half * 0.2, base - h * 0.6]]);
    pen.fill();
  }
}

function statue(pen: Pen): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 17, 29, 10, 3);
  pen.fill();
  pen.fillStyle = '#5d636b';
  pen.fillRect(8, 22, 17, 7);
  pen.fillStyle = '#7a8089';
  pen.fillRect(8, 22, 17, 1.6);
  // A warrior with a raised hammer.
  pen.fillStyle = '#80868f';
  pen.fillRect(13, 12, 7, 10);
  ell(pen, 16.5, 9.5, 3, 3);
  pen.fill();
  pen.fillRect(19, 5, 1.6, 9);
  pen.fillRect(17.5, 3.5, 5, 3);
  pen.fillStyle = '#9aa0a8';
  pen.fillRect(13, 12, 2, 10);
  pen.fillStyle = rgba(SNOW, 0.9);
  ell(pen, 16.5, 7.4, 3, 1.1);
  pen.fill();
  pen.fillRect(12.6, 11.4, 7.8, 1.2);
  pen.fillRect(17.5, 3, 5, 0.9);
}

function cart(pen: Pen, load: (pen: Pen) => void): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 17, 28.5, 13, 3);
  pen.fill();
  load(pen);
  pen.fillStyle = '#6b4a2e';
  pen.fillRect(4, 18, 24, 6);
  pen.fillStyle = '#8a6440';
  pen.fillRect(4, 18, 24, 1.4);
  pen.fillStyle = '#4b2f1a';
  pen.fillRect(26, 21, 5, 1.6);
  for (const x of [9, 22]) {
    pen.fillStyle = '#2e1c0f';
    ell(pen, x, 25.5, 3.6, 3.6);
    pen.fill();
    pen.fillStyle = '#7a5530';
    ell(pen, x, 25.5, 2.6, 2.6);
    pen.fill();
    pen.fillStyle = '#2e1c0f';
    ell(pen, x, 25.5, 0.9, 0.9);
    pen.fill();
  }
}

function hay(pen: Pen): void {
  pen.fillStyle = '#b8913e';
  ell(pen, 16, 15, 12, 6);
  pen.fill();
  pen.fillStyle = '#d4ae5a';
  ell(pen, 14, 13, 8, 3.5);
  pen.fill();
  pen.strokeStyle = 'rgba(120,85,30,0.8)';
  pen.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    pen.beginPath();
    pen.moveTo(7 + i * 3.5, 17);
    pen.lineTo(9 + i * 3.2, 11);
    pen.stroke();
  }
  pen.fillStyle = rgba(SNOW, 0.7);
  ell(pen, 15, 10.4, 6, 1.4);
  pen.fill();
}

function goods(pen: Pen): void {
  const crate = (x: number, y: number, w: number, h: number, c: string) => {
    pen.fillStyle = c;
    pen.fillRect(x, y, w, h);
    pen.fillStyle = 'rgba(0,0,0,0.35)';
    pen.fillRect(x, y + h - 1, w, 1);
    pen.fillRect(x + w / 2 - 0.4, y, 0.8, h);
    pen.fillStyle = 'rgba(255,255,255,0.12)';
    pen.fillRect(x, y, w, 0.8);
  };
  crate(6, 11, 8, 7, '#7a5a36');
  crate(15, 13, 7, 5, '#6a4a2c');
  pen.fillStyle = '#8f7f5e';
  ell(pen, 24, 15, 3.6, 3);
  pen.fill();
  pen.fillStyle = rgba(SNOW, 0.8);
  pen.fillRect(6, 10.4, 8, 1.1);
  pen.fillRect(15, 12.4, 7, 1);
}

function barrels(pen: Pen): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 16, 28, 12, 3);
  pen.fill();
  for (const [x, y] of [[10, 17], [22, 17], [16, 11]]) {
    pen.fillStyle = '#6b4a2e';
    pen.beginPath();
    pen.roundRect(x - 5, y - 1, 10, 12, 3);
    pen.fill();
    pen.fillStyle = '#2b2c31';
    pen.fillRect(x - 5, y + 2, 10, 1.2);
    pen.fillRect(x - 5, y + 7, 10, 1.2);
    pen.fillStyle = '#8a6440';
    pen.fillRect(x - 5, y - 1, 2, 12);
    pen.fillStyle = rgba(SNOW, 0.85);
    ell(pen, x, y - 0.6, 4.4, 1.2);
    pen.fill();
  }
}

function woodpile(pen: Pen): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 16, 28, 13, 3);
  pen.fill();
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const x = 7 + i * 6 + row * 3;
      const y = 24 - row * 5;
      pen.fillStyle = '#5a3a22';
      ell(pen, x, y, 3, 2.6);
      pen.fill();
      pen.fillStyle = '#b08a5a';
      ell(pen, x, y, 2, 1.7);
      pen.fill();
      pen.strokeStyle = 'rgba(90,58,34,0.8)';
      pen.lineWidth = 0.5;
      ell(pen, x, y, 1, 0.8);
      pen.stroke();
    }
  }
  pen.fillStyle = rgba(SNOW, 0.85);
  ell(pen, 16, 13.6, 4, 1.1);
  pen.fill();
}

function stall(pen: Pen): void {
  pen.fillStyle = 'rgba(0,0,0,0.4)';
  ell(pen, 16, 28.5, 14, 3);
  pen.fill();
  pen.fillStyle = '#4b2f1a';
  pen.fillRect(4, 8, 2, 20);
  pen.fillRect(26, 8, 2, 20);
  pen.fillStyle = '#6b4a2e';
  pen.fillRect(3, 19, 26, 7);
  pen.fillStyle = '#8a6440';
  pen.fillRect(3, 19, 26, 1.4);
  for (let i = 0; i < 4; i++) {
    pen.fillStyle = ['#8a4a3c', '#a37b3f', '#6f8f8a', '#7f8a5a'][i];
    ell(pen, 7 + i * 6, 17.5, 2.2, 1.6);
    pen.fill();
  }
  // A faded striped awning.
  for (let i = 0; i < 7; i++) {
    pen.fillStyle = i % 2 ? '#d8cdb4' : '#8a3a30';
    poly(pen, [[2 + i * 4, 5], [6 + i * 4, 5], [6.8 + i * 4, 11], [2.8 + i * 4, 11]]);
    pen.fill();
  }
  pen.fillStyle = rgba(SNOW, 0.9);
  pen.fillRect(2, 4.2, 28, 1.4);
}

function prop(draw: (pen: Pen) => void): SpriteRecipe {
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

/** Recipes for the town's pack tiles (tiles.ts): the lanes and fountain as areas, the rest as props. */
export function townThingRecipes(): Record<string, SpriteRecipe> {
  const out: Record<string, SpriteRecipe> = {};
  for (let q = 0; q < 4; q++) {
    out[`town_road~q${q}`] = prop((pen) => macroQuadrant(pen, q, cobbles));
    out[`town_fountain~q${q}`] = prop((pen) => {
      // Not seamless: one fountain per 2x2 block, so draw it once rather than wrapped.
      pen.save();
      pen.translate(-(q & 1) * 32, -(q >> 1) * 32);
      fountain(pen);
      pen.restore();
    });
  }
  for (const side of ['N', 'E', 'S', 'W'] as const) out[`town_road~edge${side}`] = prop((pen) => roadEdge(pen, side));
  out['town_pine~prop'] = prop(pine);
  out['town_statue~prop'] = prop(statue);
  out['town_hay_cart~prop'] = prop((pen) => cart(pen, hay));
  out['town_goods_cart~prop'] = prop((pen) => cart(pen, goods));
  out['town_barrels~prop'] = prop(barrels);
  out['town_woodpile~prop'] = prop(woodpile);
  out['town_market_stall~prop'] = prop(stall);
  return out;
}
