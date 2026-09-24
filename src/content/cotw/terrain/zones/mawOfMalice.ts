import type { ZoneArt } from '../kit';
import type { Pen, Rand } from '../pen';
import { rgba, mix, ell } from '../pen';

const BONE = '#c2b196';
const BONE_SHADE = '#8a7a66';
const BONE_EDGE = '#2a0d14';
const GUM = '#7a2436';

/** One tooth: broad at the gum, curving to a point. `dir` 1 hangs down, -1 rises up. */
function tooth(pen: Pen, x: number, gumY: number, w: number, len: number, dir: 1 | -1): void {
  const tip = gumY + len * dir;
  pen.beginPath();
  pen.moveTo(x, gumY);
  pen.quadraticCurveTo(x + w * 0.08, gumY + len * 0.72 * dir, x + w * 0.52, tip);
  pen.quadraticCurveTo(x + w * 0.92, gumY + len * 0.7 * dir, x + w, gumY);
  pen.closePath();
  const g = pen.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, mix(BONE, '#ffffff', 0.15));
  g.addColorStop(0.55, BONE);
  g.addColorStop(1, BONE_SHADE);
  pen.fillStyle = g;
  pen.fill();
  pen.strokeStyle = BONE_EDGE;
  pen.lineWidth = 0.8;
  pen.stroke();
  pen.fillStyle = 'rgba(255,255,255,0.35)';
  pen.fillRect(x + w * 0.22, gumY + (dir === 1 ? 1.5 : -3.5), 0.9, 2);
}

function jaw(pen: Pen, r: Rand, top: number, upper: boolean): void {
  // A dark throat behind the teeth.
  pen.fillStyle = 'rgba(10,2,5,0.55)';
  pen.fillRect(0, top + (upper ? 3 : 0), 32, 32 - top - (upper ? 3 : 4));
  if (upper) {
    pen.fillStyle = GUM;
    pen.fillRect(0, top, 32, 3.4);
    let x = -1 + r() * 2;
    while (x < 31) {
      const w = 6 + r() * 3;
      tooth(pen, x, top + 2.6, w, 10 + r() * 6, 1);
      x += w + 0.6;
    }
  } else {
    pen.fillStyle = GUM;
    pen.fillRect(0, 28.6, 32, 3.4);
    let x = r() * 2;
    while (x < 31) {
      const w = 5.5 + r() * 3.5;
      tooth(pen, x, 29.4, w, 8 + r() * 6, -1);
      x += w + 0.8;
    }
    pen.fillStyle = GUM;
    pen.fillRect(0, top, 32, 2.4);
  }
}

/** Maw of Malice (floors 43–49): the gullet of something vast. Purplish-red flesh, bone teeth. */
export const MAW_OF_MALICE: ZoneArt = {
  key: 'maw_of_malice',
  pal: {
    void: '#17080e',
    floorLo: '#2f161e',
    floor: '#341923',
    floorHi: '#3c1d28',
    faceLo: '#431e2b',
    face: '#602d3e',
    rim: '#773748',
    cap: '#97475b',
    accent: BONE,
    glow: '#d63a4f',
    liquid: '#4a1320',
    liquidHi: '#c0394f',
    pitFace: '#2e1218',
  },
  floor: { kind: 'field', tones: 3, details: 2, detailRate: 0.05 },
  floorDetail(pen, p, r, v) {
    if (v.n === 0) {
      // Bone chips.
      for (let i = 0; i < 2; i++) {
        pen.save();
        pen.translate(9 + r() * 14, 9 + r() * 14);
        pen.rotate(r() * 3);
        pen.fillStyle = rgba(BONE, 0.45);
        pen.fillRect(-2, -0.7, 4, 1.4);
        pen.restore();
      }
    } else {
      // A ridge of sinew.
      pen.strokeStyle = rgba(p.floorLo, 0.95);
      pen.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        const y = 10 + r() * 12;
        pen.beginPath();
        pen.moveTo(4, y);
        pen.quadraticCurveTo(16, y + (r() - 0.5) * 8, 28, y);
        pen.stroke();
      }
    }
  },
  faces: 2,
  // Face 0 is an upper jaw hanging from the cap; face 1 a lower jaw rising from the floor.
  face(pen, _p, r, v, top) {
    jaw(pen, r, top, v === 0);
  },
  door: { wood: '#8e8070', woodDark: '#5e5348', seam: '#3a2a26', band: '#6a2a36', bandLight: '#9a4452', ring: '#d63a4f' },
  // A femur: a long shaft with knobbed heads at both ends.
  pillar(pen) {
    const g = pen.createLinearGradient(10, 0, 22, 0);
    g.addColorStop(0, mix(BONE, '#ffffff', 0.18));
    g.addColorStop(0.5, BONE);
    g.addColorStop(1, BONE_SHADE);
    pen.fillStyle = g;
    pen.strokeStyle = BONE_EDGE;
    pen.lineWidth = 0.9;
    pen.beginPath();
    pen.moveTo(13.4, 8);
    pen.quadraticCurveTo(14.6, 16, 13.8, 24);
    pen.lineTo(18.4, 24);
    pen.quadraticCurveTo(17.6, 16, 18.8, 8);
    pen.closePath();
    pen.fill();
    pen.stroke();
    for (const [x, y, rx, ry] of [[13, 6.4, 3.4, 2.8], [19.2, 5.8, 3.1, 2.6], [12.8, 25.6, 3.6, 2.9], [19.4, 26.2, 3.3, 2.7]]) {
      pen.fillStyle = g;
      ell(pen, x, y, rx, ry);
      pen.fill();
      pen.stroke();
    }
    pen.fillStyle = 'rgba(255,255,255,0.3)';
    pen.fillRect(14.6, 10, 1, 12);
    pen.strokeStyle = rgba(BONE_SHADE, 0.9);
    pen.lineWidth = 0.6;
    pen.beginPath();
    pen.moveTo(16.4, 13);
    pen.lineTo(17.2, 16);
    pen.stroke();
  },
  liquid: 'ripple',
  liquidExtra(pen, p, r) {
    for (let i = 0; i < 6; i++) {
      pen.strokeStyle = rgba(p.liquidHi, 0.4);
      pen.lineWidth = 0.7;
      ell(pen, r() * 64, r() * 64, 1 + r() * 1.2, 1 + r() * 1.2);
      pen.stroke();
    }
  },
  pit: 'void',
  pitExtra(pen, p, r) {
    for (let i = 0; i < 3; i++) {
      pen.fillStyle = rgba(p.glow, 0.12);
      ell(pen, r() * 64, r() * 64, 9 + r() * 6, 6 + r() * 4);
      pen.fill();
    }
  },
};
