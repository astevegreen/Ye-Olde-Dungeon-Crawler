import { E, K, P, X, Lt, Sh, T, breath, sway, type PrimTree } from './kit';
import { DARK, aEye, type FamilyVariant } from './family';
import './materials';

function warlock(b: number, sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 7.4, 2.2)];
  const hx = 18.4;
  const hy = 7.4 + b * 0.3;
  o.push(P([hx - 2.6, hy - 2.4, hx - 0.6, hy - 3, 12.6, 19.4, 10.4 + sw * 0.4, 21.4], 'hairDark', { bv: 0.6 }));
  o.push(P([12.4, 17.4, 19.4, 17.4, 21.6, 28.2, 19.2, 27.2, 17, 28.4, 14.6, 27.2, 12.2, 28.4, 9.6 + sw * 0.3, 27.8], 'mon1_twDress', { bv: 1.1 }));
  o.push(E(15.8, 14.2, 3.4, 4.6, 'mon1_twDress'));
  o.push(K(13.4, 11, 11.6, 17.4, 0.9, 0.7, 'mon1_twSkin', { ink: -0.1 }));
  o.push(P([11, 11.2, 19.4, 10.4, 20.2, 15.4, 18.4, 19.6, 17.2, 17.8, 15.6, 20.2, 14.2, 17.8, 12.2, 19.4, 10.6, 16.4], 'mon1_shawl', { bv: 0.9 }));
  o.push(K(17.6, 11, 18.6, hy + 2, 0.9, 0.8, 'mon1_twSkin'));
  o.push(E(hx, hy, 2.8, 3, 'mon1_twSkin', { fl: 0.2 }));
  o.push(K(hx + 1.6, hy + 0.2, hx + 5.6, hy + 3, 1, 0.45, 'mon1_twSkin'));
  o.push(K(hx + 0.6, hy + 2.6, hx + 2.4, hy + 3.8, 0.7, 0.4, 'mon1_twSkin'));
  o.push(E(hx - 0.8, hy - 1.6, 3, 2.2, 'hairDark'));
  o.push(K(hx - 0.2, hy - 1.4, hx - 1 + sw * 0.15, hy + 4.4, 0.55, 0.3, 'hairDark'));
  o.push(aEye(hx + 0.6, hy - 0.4, 0.9, 0.8), aEye(hx + 2.1, hy - 0.3, 0.6, 0.7));
  o.push(X(hx + 1.2, hy + 2, 1.4, 0.4, DARK));
  const sx = 27;
  o.push(K(sx + 0.6, 28.2, sx - 0.2, 5.6, 0.6, 0.5, 'woodDark'));
  o.push(K(sx - 0.2, 6, sx - 1.6, 3.2, 0.45, 0.3, 'woodDark'), K(sx - 0.1, 6, sx + 1.6, 3.6, 0.45, 0.3, 'woodDark'));
  o.push(E(sx, 6.4, 1.5, 1.7, 'runestone'));
  o.push(X(sx - 0.2, 5.4, 0.5, 2, 'mon1_hex:4', { em: true }), X(sx - 0.2, 5.6, 1.2, 0.5, 'mon1_hex:4', { em: true }));
  const a0 = (f % 4) * (Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    const a = a0 + (i * Math.PI * 2) / 3;
    o.push(E(sx + Math.cos(a) * 2.6, 6.4 + Math.sin(a) * 1.4, 0.5, 0.5, 'mon1_hex'));
  }
  o.push(Lt(sx, 6.4, 9, '#8c84ff', 0.9));
  o.push(K(18.6, 11.6, 22.6, 14, 0.85, 0.7, 'mon1_twSkin'), K(22.6, 14, 26.2, 12.4, 0.7, 0.6, 'mon1_twSkin'));
  o.push(E(26.6, 12.2, 0.8, 0.9, 'mon1_twSkin'), K(26.8, 11.6, 28.2, 11.2, 0.35, 0.25, 'mon1_twSkin'), K(26.8, 12.6, 28.4, 12.8, 0.35, 0.25, 'mon1_twSkin'));
  return o;
}

function coven(b: number, sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 7.4, 2.2)];
  const hx = 18.6;
  const hy = 9.6 + b * 0.3;
  o.push(P([12, 12.4, 20.4, 12.4, 22.4, 28.2, 20, 27.4, 17.4, 28.4, 14.8, 27.4, 12.2, 28.4, 9.6 + sw * 0.3, 27.6], 'mon1_coven', { bv: 1.2 }));
  o.push(P([hx - 3.4, hy - 1, hx - 4.6, hy - 5.4, hx - 7.4, hy - 4.8 + sw * 0.2, hx - 4.4, hy + 3.4], 'mon1_coven', { bv: 0.6 }));
  o.push(E(hx - 0.6, hy, 4, 4.3, 'mon1_coven'));
  o.push(E(hx + 1.2, hy + 1, 2.4, 2.8, 'mon1_twSkin', { fl: 0.2 }));
  o.push(K(hx + 2.4, hy + 0.6, hx + 5.4, hy - 0.8, 0.95, 0.45, 'mon1_twSkin'));
  o.push(X(hx + 1.4, hy + 2.4, 1.4, 1, DARK));
  o.push(X(hx + 1.2, hy - 0.2, 0.8, 0.5, DARK), X(hx + 2.6, hy - 0.4, 0.6, 0.5, DARK));
  o.push(P([hx - 3.6, hy - 3.6, hx + 1.6, hy - 4.4, hx + 3.4, hy - 2.6, hx + 0.6, hy - 1.6, hx - 2.4, hy + 3], 'mon1_coven', { ink: 0.05 }));
  o.push(K(13, 13.4, 16.6, 17.4, 1.4, 1.2, 'mon1_coven', { ink: -0.06 }), K(16.6, 17.4, 19.2, 17.2, 1.2, 1, 'mon1_coven', { ink: -0.06 }));
  o.push(K(20, 13.6, 23.8, 16.6, 1.5, 1.2, 'mon1_coven'));
  const bx = 21.8;
  const by = 17.2;
  o.push(E(bx, by + 0.6, 3, 1.5, 'stoneDark', { fl: 0.3 }));
  o.push(E(bx, by - 0.2, 2.6, 0.9, 'emFire', { fl: 0.4 }));
  o.push(E(bx - 0.4, by - 0.4, 1.2, 0.5, 'emFireCore'));
  const k = f % 4;
  o.push(X(bx - 1 + k * 0.3, by - 2.4 - k * 0.6, 0.5, 0.5, 'emFire:4', { em: true }), X(bx + 1.2 - k * 0.2, by - 4 - (k % 2) * 0.5, 0.5, 0.5, 'emFireCore:3', { em: true }));
  o.push(E(19.4, by + 0.4, 1, 1, 'mon1_twSkin'), E(24.6, by + 0.2, 1, 1, 'mon1_twSkin'));
  o.push(Lt(bx, by - 1, 10, '#ff8a2c', 0.95));
  return o;
}

function ironwood(b: number, sw: number, f: number): PrimTree {
  const o: PrimTree[number][] = [Sh(16, 28.6, 8, 2.3)];
  const hx = 18.6;
  const hy = 8 + b * 0.3;
  o.push(P([hx - 1.6, hy - 4, hx + 1.4, hy - 3.6, hx - 1.4, hy + 3, 11.2, 21.4, 8.4 + sw * 0.4, 20.6, 10.2, 16, 8.6, 13.2 + sw * 0.3, 11.4, 11, 11.2, 6.4, 13.6, 4.6], 'mon1_ironHair', { bv: 0.8 }));
  o.push(P([11.6, 15.6, 20, 15.6, 22, 28.2, 19.4, 27.2, 17.2, 28.4, 14.6, 27.4, 12.4, 28.4, 9.6 + sw * 0.3, 27.8], 'mon1_twDress', { bv: 1.1 }));
  o.push(K(13, 11.6, 11.2, 18.6, 1.1, 0.85, 'bark', { ink: -0.1 }), K(11.2, 18.6, 10.4, 21, 0.6, 0.35, 'bark', { ink: -0.1 }));
  o.push(E(16, 13.6, 4, 4.8, 'bark'));
  o.push(P([11.4, 11.4, 20.6, 11, 20.8, 15.6, 16, 17.8, 11.2, 16], 'mon1_moss', { bv: 0.8, ink: -0.08 }));
  o.push(K(17.6, 10.4, 18.2, hy + 2, 1, 0.9, 'mon1_ironSkin'));
  o.push(E(hx, hy, 3, 3.2, 'mon1_ironSkin', { fl: 0.2 }));
  o.push(K(hx + 1.8, hy + 0.2, hx + 5.4, hy + 2.4, 1.05, 0.5, 'mon1_ironSkin'));
  o.push(K(hx + 0.6, hy + 2.6, hx + 2.6, hy + 3.6, 0.75, 0.45, 'mon1_ironSkin'));
  o.push(E(hx - 1.4, hy - 2, 2.8, 2, 'mon1_ironHair'));
  // twigs in the hair sweep back, not up: scaled by 1.1 the head nearly reaches the top of the cell
  o.push(K(hx - 1.6, hy - 3.6, hx - 4.2, hy - 4.2, 0.4, 0.25, 'woodDark'), K(hx - 3, hy - 3.9, hx - 4, hy - 4.3, 0.3, 0.2, 'woodDark'));
  o.push(aEye(hx + 0.6, hy - 0.4, 1, 0.8), aEye(hx + 2.2, hy - 0.3, 0.7, 0.7));
  o.push(X(hx + 1, hy + 2, 1.6, 0.5, DARK));
  // the curse siphon: blood drawn in a spiral to the open claw
  // one thread, thin where it leaves the victim, gathering into a ball in the palm
  const k = f % 4;
  const wv = [0, 0.4, 0, -0.4][k];
  const pts: Array<[number, number]> = [[28.8, 27], [29.2, 23.6 + wv * 0.3], [28.8 - wv * 0.4, 20.4], [27.6, 18 + wv * 0.3], [25.8, 16.2], [24.4, 14]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    o.push(K(x1, y1, x2, y2, 0.2 + i * 0.1, 0.3 + i * 0.1, 'mon1_blood', { ol: false }));
  }
  o.push(E(28.2 + wv * 0.3, 25.6 - k * 0.3, 0.35, 0.45, 'mon1_blood'));
  o.push(E(24, 13.4, 1.25, 1.25, 'mon1_blood'));
  o.push(K(19.6, 11.2, 21.8, 15.6, 1.1, 0.9, 'mon1_ironSkin'), K(21.8, 15.6, 23.2, 14.4, 0.9, 0.75, 'mon1_ironSkin'));
  o.push(K(23.2, 14.4, 24.4, 11.8, 0.35, 0.22, 'mon1_ironSkin'), K(23.4, 14.2, 25.4, 12.6, 0.35, 0.22, 'mon1_ironSkin'), K(23.2, 14.6, 25.6, 14.4, 0.35, 0.22, 'mon1_ironSkin'));
  o.push(Lt(24, 13.6, 8, '#d8323c', 0.8));
  return T(o, { s: 1.1 });
}

/** mon_troll_wife: the troll-witches. Long noses, long fingers, a light that curses. */
export function trollWifeModel(f: number, v: FamilyVariant): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  switch (v.kind) {
    case 'coven': return coven(b, sw, f);
    case 'ironwood': return ironwood(b, sw, f);
  }
  return warlock(b, sw, f);
}
