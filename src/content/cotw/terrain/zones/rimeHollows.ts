import type { ZoneArt } from '../kit';
import { rgba, ell, poly, wavyH } from '../pen';

/** Rime Hollows (floors 1–9): permafrost caves. Cold greys, one frost accent on caps and icicles. */
export const RIME_HOLLOWS: ZoneArt = {
  key: 'rime_hollows',
  pal: {
    void: '#0b0f14',
    floorLo: '#161e27',
    floor: '#19232c',
    floorHi: '#1e2832',
    faceLo: '#1f2b36',
    face: '#2f3f4e',
    rim: '#3a4e5d',
    cap: '#4d6474',
    accent: '#8db3c7',
    glow: '#d3ecf7',
    liquid: '#284558',
    liquidHi: '#a6c8da',
    pitFace: '#1d3342',
  },
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.07 },
  floorDetail(pen, p, r, v) {
    if (v.n === 0) {
      // A soft rime patch with a few crystals, not a glyph.
      const cx = 10 + r() * 12;
      const cy = 10 + r() * 12;
      pen.fillStyle = rgba(p.accent, 0.1);
      ell(pen, cx, cy, 7 + r() * 3, 4 + r() * 2, r() * 3);
      pen.fill();
      pen.fillStyle = rgba(p.accent, 0.35);
      for (let i = 0; i < 5; i++) pen.fillRect(cx + (r() - 0.5) * 12, cy + (r() - 0.5) * 7, 1, 1);
    } else {
      // Grit: a small cluster of pebbles with a lit upper edge.
      const cx = 10 + r() * 12;
      const cy = 10 + r() * 12;
      for (let i = 0; i < 4; i++) {
        const x = cx + (r() - 0.5) * 8;
        const y = cy + (r() - 0.5) * 6;
        const s = 0.9 + r() * 1.1;
        pen.fillStyle = rgba('#05080c', 0.55);
        ell(pen, x, y + 0.5, s, s * 0.8);
        pen.fill();
        pen.fillStyle = rgba(p.cap, 0.45);
        ell(pen, x - 0.3, y - 0.3, s * 0.75, s * 0.55);
        pen.fill();
      }
    }
  },
  faces: 2,
  face(pen, p, r, v, top) {
    pen.strokeStyle = rgba(p.faceLo, 0.95);
    pen.lineWidth = 1.1;
    for (let i = 0; i < 2; i++) wavyH(pen, r, top + 6 + i * 7 + r() * 2, 2.2);
    for (let i = 0; i < 4; i++) {
      pen.fillStyle = rgba(p.cap, 0.2);
      ell(pen, 4 + r() * 24, top + 3 + r() * 14, 1.5 + r() * 2, 1 + r());
      pen.fill();
    }
    if (v === 1) {
      for (let x = 2 + r() * 3; x < 30; x += 3.4 + r() * 3) {
        const len = 3 + r() * 5.5;
        pen.fillStyle = rgba(p.accent, 0.72);
        poly(pen, [[x - 1.2, top], [x + 1.2, top], [x + 0.2, top + len]]);
        pen.fill();
      }
    } else {
      pen.fillStyle = rgba(p.accent, 0.12);
      ell(pen, 16, top + 2, 13, 2.4);
      pen.fill();
    }
  },
  capAccent(pen, p, r, where) {
    pen.fillStyle = rgba(p.accent, 0.6);
    for (let i = 0; i < (where === 'cap' ? 6 : 3); i++) {
      const t = r() * 29;
      if (where === 'cap') pen.fillRect(t, 9 + r() * 1.4, 1.2 + r() * 2, 1);
      else if (where === 'rimN') pen.fillRect(t, 0, 1.5 + r() * 2, 1);
      else pen.fillRect(where === 'rimW' ? 0 : 31, t, 1, 1.5 + r() * 2);
    }
  },
  door: { wood: '#5d4633', woodDark: '#3a2b20', seam: '#241a12', band: '#3a4450', bandLight: '#7a8a99', ring: '#9fb8c8' },
  pillar(pen, p) {
    const g = pen.createLinearGradient(9, 0, 23, 0);
    g.addColorStop(0, '#8fb6c9');
    g.addColorStop(0.45, '#4f7a8f');
    g.addColorStop(1, '#223c4c');
    pen.fillStyle = g;
    poly(pen, [[8, 28], [24, 28], [21, 7], [16, 2.5], [11, 7]]);
    pen.fill();
    pen.strokeStyle = rgba(p.glow, 0.75);
    pen.lineWidth = 0.9;
    pen.beginPath();
    pen.moveTo(13.5, 8);
    pen.lineTo(12.5, 25);
    pen.stroke();
    pen.fillStyle = rgba(p.accent, 0.5);
    ell(pen, 16, 28, 9, 1.8);
    pen.fill();
  },
  liquid: 'ice',
  pit: 'void',
  pitExtra(pen, p, r) {
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = rgba(p.accent, 0.08);
      ell(pen, r() * 64, r() * 64, 8 + r() * 6, 5 + r() * 4);
      pen.fill();
    }
  },
};
