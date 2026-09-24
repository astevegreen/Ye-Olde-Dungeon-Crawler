import type { ZoneArt } from '../kit';
import { rgba, mix, ell } from '../pen';

/** Abandoned Dwarven Works (floors 10–17): dressed stone, cold forges, brass gone brown. */
export const DWARVEN_WORKS: ZoneArt = {
  key: 'dwarven_works',
  pal: {
    void: '#100e0c',
    floorLo: '#201d19',
    floor: '#25211d',
    floorHi: '#2b2621',
    faceLo: '#302922',
    face: '#463c32',
    rim: '#554a3c',
    cap: '#6d5e4e',
    accent: '#8c6d38',
    glow: '#e0793a',
    liquid: '#1d3036',
    liquidHi: '#6f9aa3',
    pitFace: '#2b241e',
  },
  floor: { kind: 'field', tones: 3, details: 1, detailRate: 0.08 },
  // 2x2 dressed flagstones: each quadrant draws its part of the slab's border, so four
  // cells make one slab and the seams line up across the floor.
  floorEvery(pen, p, _r, v) {
    const qx = v.q & 1;
    const qy = v.q >> 1;
    pen.fillStyle = mix(p.floorLo, '#000000', 0.45);
    pen.fillRect(qx ? 31 : 0, 0, 1, 32);
    pen.fillRect(0, qy ? 31 : 0, 32, 1);
    pen.fillStyle = rgba(p.floorHi, 0.9);
    if (!qx) pen.fillRect(1, qy ? 0 : 1, 1, 31);
    if (!qy) pen.fillRect(qx ? 0 : 1, 1, 31, 1);
  },
  // A brass drain plate set into the slab, riveted at the corners.
  floorDetail(pen, p, r) {
    const x = 9 + r() * 8;
    const y = 9 + r() * 8;
    pen.fillStyle = rgba('#000000', 0.35);
    pen.fillRect(x + 0.6, y + 0.6, 10, 10);
    pen.fillStyle = rgba(p.accent, 0.55);
    pen.fillRect(x, y, 10, 10);
    pen.fillStyle = rgba('#140f0a', 0.8);
    for (let i = 0; i < 3; i++) pen.fillRect(x + 2, y + 2.4 + i * 2.4, 6, 1);
    pen.fillStyle = rgba('#c39a52', 0.7);
    for (const [dx, dy] of [[1, 1], [8.4, 1], [1, 8.4], [8.4, 8.4]]) pen.fillRect(x + dx, y + dy, 0.8, 0.8);
  },
  faces: 2,
  face(pen, p, _r, v, top) {
    pen.fillStyle = rgba(p.faceLo, 1);
    pen.fillRect(0, top + 10, 32, 1);
    const off = v === 1 ? 6 : 0;
    for (const x of [11, 24]) pen.fillRect(x, top, 1, 10);
    for (const x of [5 + off, 18 + off, 29]) if (x < 32) pen.fillRect(x, top + 11, 1, 9);
    pen.fillStyle = rgba(p.cap, 0.22);
    pen.fillRect(0, top + 1, 32, 1);
    pen.fillRect(0, top + 11, 32, 1);
    if (v === 1) {
      pen.fillStyle = rgba(p.accent, 0.85);
      pen.fillRect(0, top + 7, 32, 2);
      pen.fillStyle = '#b08d4c';
      for (const x of [6, 16, 26]) {
        ell(pen, x, top + 8, 0.9, 0.9);
        pen.fill();
      }
    }
  },
  door: { wood: '#6b4a2e', woodDark: '#46301d', seam: '#2a1c10', band: '#7d6233', bandLight: '#b08d4c', ring: '#c39a52' },
  pillar(pen, p) {
    const g = pen.createLinearGradient(9, 0, 23, 0);
    g.addColorStop(0, p.cap);
    g.addColorStop(0.5, p.face);
    g.addColorStop(1, p.faceLo);
    pen.fillStyle = g;
    pen.fillRect(10, 7, 12, 20);
    pen.fillStyle = mix(p.cap, '#ffffff', 0.08);
    pen.fillRect(8, 3, 16, 4);
    pen.fillStyle = p.faceLo;
    pen.fillRect(8, 6, 16, 1);
    pen.fillStyle = p.face;
    pen.fillRect(8, 26, 16, 3);
    pen.fillStyle = rgba(p.accent, 0.9);
    pen.fillRect(10, 12, 12, 1.6);
    pen.fillRect(10, 21, 12, 1.6);
  },
  liquid: 'ripple',
  // Chasms in the Works are cold forges banked with embers.
  pit: 'coals',
};
