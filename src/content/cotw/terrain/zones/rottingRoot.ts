import type { ZoneArt } from '../kit';
import type { Pen, Rand } from '../pen';
import { rgba, mix, ell, wavyV } from '../pen';

const STAIN = '#070905';
const WITHER = '#6b6450';
const MOLD = '#8a9477';

/** Dark, soft-edged rot stains. */
function stain(pen: Pen, r: Rand, cx: number, cy: number, rad: number, alpha: number): void {
  const g = pen.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, rgba(STAIN, alpha));
  g.addColorStop(0.7, rgba(STAIN, alpha * 0.6));
  g.addColorStop(1, rgba(STAIN, 0));
  pen.fillStyle = g;
  ell(pen, cx, cy, rad, rad * (0.6 + r() * 0.3), r() * 3);
  pen.fill();
}

/** Withered strands: dry, pale fibres. */
function strands(pen: Pen, r: Rand, n: number, x0: number, y0: number, spread: number, len: number): void {
  pen.lineWidth = 0.6;
  for (let i = 0; i < n; i++) {
    pen.strokeStyle = rgba(WITHER, 0.55 + r() * 0.3);
    const x = x0 + (r() - 0.5) * spread;
    const y = y0 + (r() - 0.5) * spread * 0.6;
    pen.beginPath();
    pen.moveTo(x, y);
    pen.quadraticCurveTo(x + (r() - 0.5) * len, y + len * 0.5, x + (r() - 0.5) * len * 1.2, y + len);
    pen.stroke();
  }
}

/** The Rotting Root (floor 50): the blighted heart of the root. Olive rot, withering, fungus light. */
export const ROTTING_ROOT: ZoneArt = {
  key: 'rotting_root',
  pal: {
    void: '#0b0d08',
    floorLo: '#1a1f15',
    floor: '#1f2318',
    floorHi: '#23291c',
    faceLo: '#262c1f',
    face: '#39402c',
    rim: '#454f34',
    cap: '#5a6544',
    accent: '#63742e',
    glow: '#a8d654',
    liquid: '#1d2412',
    liquidHi: '#7d9440',
    pitFace: '#20251a',
  },
  floor: { kind: 'field', tones: 3, details: 3, detailRate: 0.1 },
  // Every floor cell carries some rot: broad dark stains, more on the darker tone.
  floorEvery(pen, _p, r, v) {
    stain(pen, r, 8 + r() * 16, 8 + r() * 16, 7 + r() * 5, v.tone === 0 ? 0.5 : 0.28);
  },
  floorDetail(pen, p, r, v) {
    const cx = 9 + r() * 14;
    const cy = 11 + r() * 12;
    if (v.n === 0) {
      // A rot hole with a slick rim.
      stain(pen, r, cx, cy, 6, 0.7);
      pen.fillStyle = '#050603';
      ell(pen, cx, cy, 3.2, 2.2);
      pen.fill();
      pen.strokeStyle = rgba(p.liquidHi, 0.45);
      pen.lineWidth = 0.7;
      ell(pen, cx, cy - 0.3, 3.6, 2.5);
      pen.stroke();
    } else if (v.n === 1) {
      strands(pen, r, 7, cx, cy, 12, 6);
      pen.fillStyle = rgba(MOLD, 0.25);
      ell(pen, cx + 2, cy + 3, 4, 2);
      pen.fill();
    } else {
      // Fungus caps with a faint glow.
      for (let i = 0; i < 3; i++) {
        const x = cx + (i - 1) * 3.4;
        const y = cy + (r() - 0.5) * 3;
        const s = 1.6 + r() * 1.2;
        pen.fillStyle = mix(p.cap, '#ffffff', 0.1);
        pen.fillRect(x - 0.4, y, 0.9, 2.6);
        pen.fillStyle = p.cap;
        ell(pen, x, y, s, s * 0.6);
        pen.fill();
        pen.fillStyle = rgba(p.glow, 0.6);
        pen.fillRect(x - s * 0.8, y + 0.3, s * 1.6, 0.7);
      }
    }
  },
  faces: 2,
  face(pen, p, r, v, top) {
    // Blackened heartwood: cracks, rot streaks running down from the cap, withered fibres.
    pen.strokeStyle = rgba('#050604', 0.8);
    pen.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) wavyV(pen, r, 5 + i * 10 + r() * 3, 2, top, 32, 4);
    for (let i = 0; i < 4; i++) {
      const x = 2 + r() * 28;
      const len = 8 + r() * 12;
      const g = pen.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, rgba(STAIN, 0.75));
      g.addColorStop(1, rgba(STAIN, 0));
      pen.fillStyle = g;
      pen.fillRect(x, top, 1.6 + r() * 1.6, len);
    }
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = rgba(p.accent, 0.25);
      ell(pen, 4 + r() * 24, top + 4 + r() * 12, 2.5 + r() * 2, 1.6);
      pen.fill();
    }
    strands(pen, r, 5, 16, top + 1, 26, 7);
    if (v === 1) {
      for (const [x, y] of [[9, top + 8], [21, top + 13]]) {
        pen.fillStyle = p.cap;
        pen.beginPath();
        pen.ellipse(x, y, 5, 2.4, 0, Math.PI, 0);
        pen.fill();
        pen.fillStyle = rgba(p.glow, 0.6);
        pen.fillRect(x - 4.6, y, 9.2, 0.8);
      }
    }
  },
  topTexture(pen, _p, r) {
    stain(pen, r, 10 + r() * 12, 10 + r() * 12, 9, 0.45);
  },
  door: { wood: '#34402a', woodDark: '#1f2718', seam: '#12170d', band: '#2a2f24', bandLight: '#56603f', ring: '#8fb04a' },
  pillar(pen, p) {
    pen.fillStyle = mix(p.cap, '#ffffff', 0.12);
    pen.fillRect(13.5, 12, 5, 16);
    pen.fillStyle = rgba(STAIN, 0.5);
    pen.fillRect(13.5, 20, 5, 8);
    pen.fillStyle = p.cap;
    pen.beginPath();
    pen.ellipse(16, 12, 10.5, 6, 0, Math.PI, 0);
    pen.fill();
    pen.fillStyle = rgba(STAIN, 0.45);
    ell(pen, 11, 9, 3, 1.6);
    pen.fill();
    pen.fillStyle = rgba(p.glow, 0.8);
    pen.fillRect(6, 11.6, 20, 1.2);
    for (const [x, y] of [[12, 9], [18, 8], [21, 10]]) {
      pen.fillStyle = rgba(p.glow, 0.5);
      ell(pen, x, y, 1.2, 0.8);
      pen.fill();
    }
  },
  liquid: 'ripple',
  liquidExtra(pen, p, r) {
    for (let i = 0; i < 5; i++) {
      pen.fillStyle = rgba(p.accent, 0.25);
      ell(pen, r() * 64, r() * 64, 3 + r() * 5, 2 + r() * 2, r() * 3);
      pen.fill();
    }
  },
  pit: 'void',
  pitExtra(pen, p, r) {
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = rgba(p.glow, 0.1);
      ell(pen, r() * 64, r() * 64, 8 + r() * 6, 5 + r() * 4);
      pen.fill();
    }
  },
};
