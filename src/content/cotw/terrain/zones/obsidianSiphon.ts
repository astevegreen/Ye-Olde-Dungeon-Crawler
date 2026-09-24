import type { ZoneArt } from '../kit';
import { rgba, mix, poly } from '../pen';

/** Obsidian Siphon (floors 18–25): volcanic glass split by magma. Lava is the only saturated colour. */
export const OBSIDIAN_SIPHON: ZoneArt = {
  key: 'obsidian_siphon',
  pal: {
    void: '#0c0a0e',
    floorLo: '#1e1a22',
    floor: '#231e27',
    floorHi: '#27212c',
    faceLo: '#2e2737',
    face: '#433a4c',
    rim: '#524665',
    cap: '#685b7d',
    accent: '#a33a14',
    glow: '#f59e0b',
    liquid: '#4a1d10',
    liquidHi: '#e2651c',
    pitFace: '#1a0d0b',
  },
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.06 },
  floorDetail(pen, p, r, v) {
    if (v.n === 0) {
      // A glassy sheen: one long, faint diagonal glint.
      const g = pen.createLinearGradient(4, 26, 28, 6);
      g.addColorStop(0, rgba(p.cap, 0));
      g.addColorStop(0.5, rgba(p.cap, 0.28));
      g.addColorStop(1, rgba(p.cap, 0));
      pen.fillStyle = g;
      poly(pen, [[4, 25 + r() * 2], [26, 5 + r() * 2], [28, 7 + r() * 2], [6, 27 + r() * 2]]);
      pen.fill();
    } else {
      // Residual heat under the glass: a soft, dim ember glow.
      const cx = 10 + r() * 12;
      const cy = 10 + r() * 12;
      const g = pen.createRadialGradient(cx, cy, 0, cx, cy, 8);
      g.addColorStop(0, rgba('#6a2412', 0.45));
      g.addColorStop(1, rgba('#6a2412', 0));
      pen.fillStyle = g;
      pen.fillRect(cx - 8, cy - 8, 16, 16);
    }
  },
  faces: 2,
  face(pen, p, r, v, top) {
    for (let i = 0; i < 4; i++) {
      const x0 = i * 8 + r() * 2;
      pen.fillStyle = mix(p.face, i % 2 ? p.faceLo : p.cap, 0.15 + r() * 0.2);
      poly(pen, [[x0, top], [x0 + 8, top], [x0 + 7 + r() * 2, 32], [x0 - 1, 32]]);
      pen.fill();
      pen.fillStyle = rgba(p.cap, 0.55);
      pen.fillRect(x0, top, 0.8, 32 - top);
    }
    if (v === 1) {
      const x = 9 + r() * 14;
      const pts: Array<[number, number]> = [[x, top + 1]];
      for (let y = top + 4; y <= 32; y += 4) pts.push([x + (r() - 0.5) * 5, y]);
      const trace = () => {
        pen.beginPath();
        pts.forEach(([px, py], i) => (i ? pen.lineTo(px, py) : pen.moveTo(px, py)));
      };
      pen.strokeStyle = rgba(p.glow, 0.2);
      pen.lineWidth = 3.4;
      trace();
      pen.stroke();
      pen.strokeStyle = p.accent;
      pen.lineWidth = 1.1;
      trace();
      pen.stroke();
    }
  },
  door: { wood: '#2c2532', woodDark: '#16121b', seam: '#0b080e', band: '#3a3040', bandLight: '#6a5a7a', ring: '#c2410c' },
  pillar(pen, p) {
    pen.fillStyle = p.faceLo;
    poly(pen, [[9, 28], [23, 28], [21, 9], [17, 2], [12, 10]]);
    pen.fill();
    pen.fillStyle = p.cap;
    poly(pen, [[9, 28], [15, 28], [16, 5], [12, 10]]);
    pen.fill();
    pen.fillStyle = rgba(p.glow, 0.55);
    pen.fillRect(17, 14, 1, 6);
  },
  liquid: 'magma',
  pit: 'lava',
};
