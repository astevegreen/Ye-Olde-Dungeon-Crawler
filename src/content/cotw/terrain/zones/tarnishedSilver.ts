import type { ZoneArt } from '../kit';
import { rgba, mix, ell } from '../pen';

const TIMBER = '#4f3a28';
const TIMBER_HI = '#6b5038';

/** Tarnished Silver Veins (floors 26–33): worked-out mines. Grey-green tarnish, warm timber shoring. */
export const TARNISHED_SILVER: ZoneArt = {
  key: 'tarnished_silver',
  pal: {
    void: '#0b0d0d',
    floorLo: '#1a1e1d',
    floor: '#1d2322',
    floorHi: '#222827',
    faceLo: '#242b2a',
    face: '#35403e',
    rim: '#424e4d',
    cap: '#566362',
    accent: '#94a3a1',
    glow: '#6cc4b8',
    liquid: '#1c3533',
    liquidHi: '#6fa8a0',
    pitFace: '#212827',
  },
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.07 },
  floorDetail(pen, p, r, v) {
    const cx = 10 + r() * 12;
    const cy = 10 + r() * 12;
    if (v.n === 0) {
      for (let i = 0; i < 5; i++) {
        const x = cx + (r() - 0.5) * 9;
        const y = cy + (r() - 0.5) * 7;
        const s = 1 + r() * 1.4;
        pen.fillStyle = p.floorLo;
        ell(pen, x, y + 0.5, s, s * 0.8);
        pen.fill();
        pen.fillStyle = mix(p.floorHi, p.cap, 0.35);
        ell(pen, x - 0.3, y - 0.3, s * 0.8, s * 0.6);
        pen.fill();
      }
    } else {
      for (let i = 0; i < 4; i++) {
        pen.fillStyle = rgba(p.accent, 0.22);
        pen.fillRect(cx + (r() - 0.5) * 10, cy + (r() - 0.5) * 8, 1.3, 1.3);
      }
    }
  },
  faces: 2,
  face(pen, p, r, v, top) {
    pen.strokeStyle = rgba(p.faceLo, 0.95);
    pen.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = top + 4 + i * 6;
      pen.beginPath();
      pen.moveTo(0, y + 3);
      pen.lineTo(32, y - 2 + r() * 2);
      pen.stroke();
    }
    if (v === 1) {
      // Timber shoring: warm against the grey-green rock, marking the drifts.
      for (const x of [2, 26]) {
        pen.fillStyle = TIMBER;
        pen.fillRect(x, top, 4, 32 - top);
        pen.fillStyle = TIMBER_HI;
        pen.fillRect(x, top, 1.2, 32 - top);
      }
      pen.fillStyle = TIMBER;
      pen.fillRect(2, top, 28, 3.2);
      pen.fillStyle = TIMBER_HI;
      pen.fillRect(2, top, 28, 1);
      pen.fillStyle = 'rgba(0,0,0,0.5)';
      pen.fillRect(3.4, top + 1.8, 1, 1);
      pen.fillRect(27.4, top + 1.8, 1, 1);
    } else {
      pen.strokeStyle = rgba(p.accent, 0.55);
      pen.lineWidth = 1.1;
      pen.beginPath();
      pen.moveTo(1, top + 9 + r() * 3);
      pen.quadraticCurveTo(12, top + 4 + r() * 6, 20, top + 11);
      pen.quadraticCurveTo(26, top + 15, 31, top + 12);
      pen.stroke();
    }
  },
  door: { wood: '#5a4330', woodDark: '#3b2b1f', seam: '#241910', band: '#5d6968', bandLight: '#8f9d9b', ring: '#94a3a1' },
  pillar(pen) {
    pen.fillStyle = TIMBER;
    pen.fillRect(12, 5, 8, 23);
    pen.fillStyle = TIMBER_HI;
    pen.fillRect(12, 5, 2, 23);
    pen.fillStyle = TIMBER;
    pen.fillRect(6, 3, 20, 4);
    pen.fillStyle = TIMBER_HI;
    pen.fillRect(6, 3, 20, 1.2);
    pen.fillStyle = '#2a2d31';
    pen.fillRect(12, 16, 8, 1.6);
  },
  liquid: 'ripple',
  pit: 'void',
};
