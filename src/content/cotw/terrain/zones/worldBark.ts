import type { ZoneArt } from '../kit';
import { rgba, ell, wavyV } from '../pen';

/** World Bark Descent (floors 34–42): inside Yggdrasil's roots. Umber bark, one moss green, amber sap. */
export const WORLD_BARK: ZoneArt = {
  key: 'world_bark',
  pal: {
    void: '#0e0b08',
    floorLo: '#231c15',
    floor: '#282018',
    floorHi: '#2f251c',
    faceLo: '#34271d',
    face: '#4d3a2a',
    rim: '#5c4831',
    cap: '#765c41',
    accent: '#4d6a33',
    glow: '#c9912f',
    liquid: '#3a2c10',
    liquidHi: '#c9912f',
    pitFace: '#2a1f16',
  },
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.06 },
  floorDetail(pen, p, r, v) {
    if (v.n === 0) {
      // A surfaced root arching through the loam.
      pen.lineCap = 'round';
      pen.strokeStyle = rgba(p.face, 0.7);
      pen.lineWidth = 2.6;
      pen.beginPath();
      pen.moveTo(3, 20 + r() * 6);
      pen.bezierCurveTo(10, 14 + r() * 8, 20, 22 - r() * 8, 29, 14 + r() * 6);
      pen.stroke();
      pen.strokeStyle = rgba(p.cap, 0.25);
      pen.lineWidth = 0.8;
      pen.stroke();
      pen.lineCap = 'butt';
    } else {
      for (let i = 0; i < 3; i++) {
        pen.fillStyle = rgba(p.accent, 0.6);
        ell(pen, 8 + r() * 16, 8 + r() * 16, 2.4 + r(), 1.4);
        pen.fill();
      }
    }
  },
  faces: 2,
  face(pen, p, r, v, top) {
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 6.2 + r() * 1.5;
      pen.strokeStyle = rgba(p.faceLo, 0.95);
      pen.lineWidth = 1.6;
      wavyV(pen, r, x, 1.4, top, 32, 5);
      pen.strokeStyle = rgba(p.cap, 0.22);
      pen.lineWidth = 0.8;
      wavyV(pen, r, x + 1.6, 1.2, top, 32, 5);
    }
    if (v === 1) {
      for (let i = 0; i < 5; i++) {
        pen.fillStyle = rgba(p.accent, 0.8);
        ell(pen, 3 + r() * 26, 29 + r() * 2, 2.5 + r() * 2, 1.4);
        pen.fill();
      }
      pen.strokeStyle = rgba(p.faceLo, 1);
      pen.lineWidth = 1;
      ell(pen, 10 + r() * 12, top + 8, 2.4, 1.8);
      pen.stroke();
    }
  },
  door: { wood: '#5a4128', woodDark: '#3a2a1a', seam: '#23180e', band: '#4d6a33', bandLight: '#6f8f4a', ring: '#b8a57a' },
  pillar(pen, p) {
    const g = pen.createLinearGradient(8, 0, 24, 0);
    g.addColorStop(0, p.cap);
    g.addColorStop(0.5, p.face);
    g.addColorStop(1, p.faceLo);
    pen.fillStyle = g;
    pen.beginPath();
    pen.moveTo(6, 29);
    pen.quadraticCurveTo(10, 18, 9, 3);
    pen.lineTo(23, 3);
    pen.quadraticCurveTo(22, 18, 26, 29);
    pen.closePath();
    pen.fill();
    pen.strokeStyle = rgba(p.faceLo, 0.9);
    pen.lineWidth = 1;
    for (const x of [13, 17, 20]) {
      pen.beginPath();
      pen.moveTo(x, 4);
      pen.lineTo(x + 0.5, 27);
      pen.stroke();
    }
    pen.fillStyle = rgba(p.accent, 0.85);
    ell(pen, 11, 27, 4, 1.6);
    pen.fill();
    ell(pen, 21, 28, 3, 1.3);
    pen.fill();
  },
  // Pools here are slow amber sap.
  liquid: 'ripple',
  liquidExtra(pen, p, r) {
    for (let i = 0; i < 4; i++) {
      pen.fillStyle = rgba(p.glow, 0.12);
      ell(pen, r() * 64, r() * 64, 6 + r() * 6, 3 + r() * 3, r() * 3);
      pen.fill();
    }
  },
  pit: 'void',
};
