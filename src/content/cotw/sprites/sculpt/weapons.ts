import { E, K, P, X, T, type PrimTree } from './kit';
import { RAD, lay, loop, type ItemVariant, type Out } from './itemKit';

interface SwordShape { bl: number; bw: number; sw: number; tip: number; gw: number; gr: number; grip: number; pom: string; st: string; gm: string; fuller: boolean; ricasso?: boolean }

const SWORDS: Record<string, SwordShape> = {
  short: { bl: 9.4, bw: 1.55, sw: 1.15, tip: 2.6, gw: 2.5, gr: 0.6, grip: 3.4, pom: 'disc', st: 'steel', gm: 'iron', fuller: false },
  broad: { bl: 12.4, bw: 2.0, sw: 1.7, tip: 2.3, gw: 3.1, gr: 0.85, grip: 3.8, pom: 'lobed', st: 'steel', gm: 'bronze', fuller: true },
  frost: { bl: 12.8, bw: 1.6, sw: 1.15, tip: 3.2, gw: 3.6, gr: 0.6, grip: 3.8, pom: 'crystal', st: 'item_frost', gm: 'item_frost', fuller: true },
  great: { bl: 15.2, bw: 1.85, sw: 1.55, tip: 2.6, gw: 4.6, gr: 0.8, grip: 5.4, pom: 'pear', st: 'steel', gm: 'iron', fuller: true, ricasso: true },
};

/** Four silhouettes by length and guard: shortsword, broadsword, Frost Blade, greatsword. */
export function swordModel(_f: number, v: ItemVariant): PrimTree {
  const o = SWORDS[v.kind || 'broad'];
  const c = 16;
  const out: Out = [];
  const pomH = o.pom === 'lobed' ? 2.4 : o.pom === 'disc' ? 2.4 : 3;
  const yT = 0, yS = o.tip, yG = yS + o.bl, yH = yG + o.gr * 2, yP = yH + o.grip, yE = yP + pomH;
  // blade: a lit flat (local left lies toward the light once laid down), a shaded flat, the fuller
  out.push(P([c - o.bw, yG, c, yG, c, yT, c - o.sw, yS], o.st, { bv: 0.45, n: [-0.42, 0, 0.9] }));
  out.push(P([c, yG, c + o.bw, yG, c + o.sw, yS, c, yT], o.st, { bv: 0.45, n: [0.18, 0, 0.98] }));
  if (o.fuller) out.push(P([c - 0.5, yG - 0.4, c + 0.5, yG - 0.4, c + 0.35, yS + 1.8, c - 0.35, yS + 1.8], o.st, { n: [0.5, 0, 0.86] }));
  if (o.ricasso) {
    out.push(K(c, yG - 0.2, c, yG - 2.6, 1.25, 1.2, 'leatherDark'));
    out.push(K(c - 2.1, yG - 2.9, c + 2.1, yG - 2.9, 0.5, 0.5, o.gm));
  }
  // guard
  if (v.kind === 'great') {
    out.push(K(c, yG + o.gr, c - o.gw, yG + o.gr + 1.5, o.gr, o.gr * 0.75, o.gm), K(c, yG + o.gr, c + o.gw, yG + o.gr + 1.5, o.gr, o.gr * 0.75, o.gm));
    out.push(E(c - o.gw, yG + o.gr + 1.6, 0.8, 0.8, o.gm), E(c + o.gw, yG + o.gr + 1.6, 0.8, 0.8, o.gm));
  } else if (v.kind === 'frost') {
    // quillons like ice spikes, swept toward the point
    out.push(P([c - 0.6, yG + 1.2, c - o.gw, yG - 1.6, c - o.gw + 1.0, yG + 0.2, c - 1.4, yG + 1.8], o.gm, { bv: 0.4, n: [-0.4, -0.2, 0.9] }));
    out.push(P([c + 0.6, yG + 1.2, c + 1.4, yG + 1.8, c + o.gw - 1.0, yG + 0.2, c + o.gw, yG - 1.6], o.gm, { bv: 0.4, n: [0.3, -0.2, 0.93] }));
    out.push(K(c - 1.5, yG + o.gr, c + 1.5, yG + o.gr, o.gr + 0.25, o.gr + 0.25, o.gm));
  } else {
    out.push(K(c - o.gw, yG + o.gr, c + o.gw, yG + o.gr, o.gr, o.gr, o.gm));
  }
  // grip and its wrap
  out.push(K(c, yH - 0.2, c, yP + 0.2, 0.85, 0.8, 'leatherDark'));
  for (let y = yH + 0.9; y < yP - 0.3; y += 1.3) out.push(K(c - 0.75, y + 0.35, c + 0.75, y - 0.35, 0.22, 0.22, 'leather', { occ: false, ol: false }));
  // pommel
  if (o.pom === 'lobed') {
    out.push(K(c - 1.9, yP + 0.55, c + 1.9, yP + 0.55, 0.6, 0.6, o.gm));
    out.push(E(c - 1.25, yP + 1.3, 0.95, 1.0, o.gm), E(c + 1.25, yP + 1.3, 0.95, 1.0, o.gm), E(c, yP + 1.45, 1.05, 1.15, o.gm));
  } else if (o.pom === 'disc') {
    out.push(E(c, yP + 1.2, 1.35, 1.25, o.gm));
  } else if (o.pom === 'pear') {
    out.push(K(c - 1.1, yP + 0.35, c + 1.1, yP + 0.35, 0.45, 0.45, o.gm), E(c, yP + 1.6, 1.3, 1.5, o.gm));
  } else {
    out.push(P([c, yP, c + 1.35, yP + 1.4, c, yP + 3, c - 1.35, yP + 1.4], 'item_frost', { bv: 0.6, n: [-0.1, -0.1, 1] }));
  }
  return lay(out, 45, yT, yE, 1.5);
}

/** A long-hafted bearded Dane axe, or the cleaver: a short heavy slab with a hanging hole. */
export function axeModel(_f: number, v: ItemVariant): PrimTree {
  const c = 16;
  const out: Out = [];
  if (v.kind === 'cleaver') {
    // a heavy slab: spine straight into the tang, edge bellied toward the light
    out.push(K(c + 1.8, 15.6, c + 1.8, 25.2, 1.05, 1.15, 'woodDark'));
    out.push(X(c + 1.4, 18.2, 0.9, 0.9, 'bronze:4'), X(c + 1.4, 21.6, 0.9, 0.9, 'bronze:4'));
    out.push(E(c + 1.8, 25.8, 1.2, 0.85, 'iron'));
    out.push(P([c - 4.0, 5.2, c + 2.9, 5.2, c + 3.1, 15.2, c + 2.1, 16.6, c - 4.6, 16.6, c - 5.7, 13.2, c - 5.9, 9.0, c - 5.1, 6.2], 'iron', { bv: 1.0, n: [-0.08, -0.05, 1] }));
    out.push(K(c - 4.8, 5.8, c - 5.75, 9.2, 0.55, 0.55, 'steel'), K(c - 5.75, 9.2, c - 5.55, 13.4, 0.55, 0.55, 'steel'), K(c - 5.55, 13.4, c - 4.5, 16.2, 0.55, 0.5, 'steel'));
    out.push(E(c + 0.9, 7.9, 0.85, 0.85, 'item_void'));
    return lay(out, 32, 5.2, 26.4, 2.2);
  }
  // bearded Dane axe on a long haft; the crescent edge faces the light
  out.push(K(c, 27.2, c, 5.6, 0.72, 0.66, 'wood'));
  out.push(K(c, 21.6, c, 26.4, 0.88, 0.88, 'leatherDark'));
  out.push(E(c, 27.6, 0.95, 0.95, 'iron'));
  out.push(P([c - 0.4, 6.8, c - 2.6, 6.2, c - 5.2, 3.8, c - 6.6, 4.3, c - 7.4, 6.6, c - 7.6, 9.2, c - 7.0, 11.6, c - 5.8, 13.4, c - 4.6, 11.8, c - 3.2, 10.2, c - 0.4, 9.8], 'steel', { bv: 1.1, n: [0, -0.1, 1] }));
  out.push(K(c - 5.4, 4.0, c - 7.3, 6.8, 0.5, 0.5, 'silver'), K(c - 7.3, 6.8, c - 7.45, 9.4, 0.5, 0.5, 'silver'), K(c - 7.45, 9.4, c - 6.0, 12.9, 0.5, 0.4, 'silver'));
  out.push(K(c, 6.0, c, 10.4, 1.15, 1.15, 'iron'));
  return lay(out, 40, 4.6, 28.4, 1.4);
}

/** Four heads on one haft length: flanged mace, morningstar, forge hammer, bone cudgel. */
export function bluntModel(_f: number, v: ItemVariant): PrimTree {
  const c = 16;
  const out: Out = [];
  const k = v.kind || 'mace';
  if (k === 'mace') {
    out.push(K(c, 26, c, 11.5, 0.68, 0.62, 'woodDark'));
    out.push(K(c, 21.4, c, 25.6, 0.86, 0.86, 'leatherDark'));
    out.push(E(c, 26.4, 1.0, 0.9, 'iron'));
    out.push(K(c - 1.5, 12.4, c + 1.5, 12.4, 0.6, 0.6, 'iron'));
    // flanged head: side flanges, the crown flange, one flange edge-on to us
    out.push(P([c - 1.4, 6.0, c - 4.5, 7.2, c - 4.7, 10.8, c - 1.4, 12.0], 'iron', { bv: 0.7, n: [-0.35, 0, 0.94] }));
    out.push(P([c + 1.4, 6.0, c + 1.4, 12.0, c + 4.7, 10.8, c + 4.5, 7.2], 'iron', { bv: 0.7, n: [0.3, 0, 0.95] }));
    out.push(P([c - 1.5, 6.8, c, 3.6, c + 1.5, 6.8], 'iron', { bv: 0.5 }));
    out.push(E(c, 9.0, 1.9, 3.1, 'iron'));
    out.push(K(c, 5.4, c, 12.2, 0.8, 0.65, 'steel'));
    return lay(out, 40, 3.6, 27.3, 1.6);
  }
  if (k === 'morningstar') {
    out.push(K(c, 26.6, c, 12.0, 0.75, 0.7, 'wood'));
    out.push(K(c, 12.2, c, 16.4, 0.95, 0.85, 'iron'));
    out.push(K(c, 21.8, c, 26.0, 0.9, 0.9, 'leatherDark'));
    out.push(E(c, 27.0, 1.0, 0.95, 'iron'));
    const bx = c, by = 8.6;
    for (let i = 0; i < 8; i++) {
      const t = (i * 45 + 22.5) * RAD, ca = Math.cos(t), sa = Math.sin(t);
      if (sa > 0.8) continue; // the haft hides the lowest spike
      const tx = -sa, ty = ca;
      out.push(P([bx + ca * 2.6 + tx * 0.85, by + sa * 2.6 + ty * 0.85, bx + ca * 5.0, by + sa * 5.0, bx + ca * 2.6 - tx * 0.85, by + sa * 2.6 - ty * 0.85], 'steel', { bv: 0.4, n: [ca * 0.3, sa * 0.3, 0.95] }));
    }
    out.push(E(bx, by, 3.2, 3.2, 'iron'));
    out.push(K(bx - 3.1, by + 0.4, bx + 3.1, by + 0.4, 0.45, 0.45, 'blackIron', { fl: 0.4 }));
    // two spikes that point at us
    out.push(P([bx - 1.6, by - 2.0, bx - 0.4, by - 1.4, bx - 1.2, by - 0.5], 'steel', { n: [-0.4, -0.4, 0.82] }));
    out.push(P([bx + 0.8, by + 1.3, bx + 2.0, by + 1.7, bx + 1.1, by + 2.6], 'steel', { n: [0.2, 0.3, 0.93] }));
    return lay(out, 40, 3.6, 28, 1.6);
  }
  if (k === 'hammer') {
    // forge hammer: square striking face, tapered peen, short wooden handle
    out.push(K(c, 26.6, c, 6.0, 0.95, 0.85, 'wood'));
    out.push(E(c, 26.8, 1.0, 0.8, 'woodDark'));
    // a heavy block head, square face toward the light, wedge peen away from it
    out.push(P([c - 5.6, 5.0, c + 2.4, 5.0, c + 2.4, 11.6, c - 5.6, 11.6], 'iron', { bv: 1.2 }));
    out.push(P([c - 6.6, 4.4, c - 5.0, 4.4, c - 5.0, 12.2, c - 6.6, 12.2], 'steel', { bv: 0.6, n: [-0.35, 0, 0.94] }));
    out.push(P([c + 2.4, 5.4, c + 6.6, 7.6, c + 6.6, 9.0, c + 2.4, 11.2], 'iron', { bv: 0.8, n: [0.15, 0, 0.99] }));
    out.push(K(c + 6.6, 7.7, c + 6.6, 8.9, 0.4, 0.4, 'steel'));
    out.push(E(c, 4.6, 1.0, 0.7, 'wood'));
    return lay(out, 40, 4.0, 27.6, 1.6);
  }
  // bone cudgel: a great femur, the narrow end bound in leather
  out.push(K(c, 24.4, c + 0.3, 10.2, 1.25, 1.7, 'bone'));
  out.push(E(c - 1.6, 8.4, 2.2, 2.1, 'bone'), E(c + 1.9, 7.6, 2.3, 2.3, 'bone'));
  out.push(E(c + 0.2, 10.4, 1.5, 1.0, 'boneOld', { fl: 0.4 }));
  out.push(K(c + 1.0, 12.6, c + 0.2, 15.6, 0.22, 0.22, 'boneOld', { occ: false }));
  out.push(K(c, 19.6, c, 24.4, 1.5, 1.45, 'leatherDark'));
  for (let y = 20.4; y < 24; y += 1.2) out.push(K(c - 1.4, y + 0.4, c + 1.4, y - 0.4, 0.24, 0.24, 'leather', { occ: false, ol: false }));
  out.push(E(c, 25.2, 1.7, 1.4, 'boneOld'));
  return lay(out, 40, 5.3, 26.6, 2.0);
}

/** Short blades: the broken-back seax, a needle stiletto with a ring pommel, a chisel. */
export function daggerModel(_f: number, v: ItemVariant): PrimTree {
  const c = 16;
  const out: Out = [];
  const k = v.kind || 'seax';
  if (k === 'seax') {
    // the Norse seax: broken back, straight edge, long antler grip, no guard
    out.push(P([c - 1.4, 17.4, c - 1.4, 10.0, c + 1.45, 5.6, c + 0.1, 10.6, c + 0.1, 17.4], 'steel', { bv: 0.4, n: [-0.42, 0, 0.9] }));
    out.push(P([c + 0.1, 17.4, c + 0.1, 10.6, c + 1.45, 5.6, c + 1.45, 17.4], 'steel', { bv: 0.3, n: [0.2, 0, 0.98] }));
    out.push(K(c - 1.5, 17.9, c + 1.6, 17.9, 0.6, 0.6, 'bronze'));
    out.push(K(c, 18.3, c - 0.1, 24.4, 1.05, 0.92, 'horn'));
    out.push(K(c - 0.1, 24.5, c - 0.1, 25.4, 0.95, 0.95, 'bronze'));
    return lay(T(out, { s: 0.8, px: 16, py: 16 }), 45, 9.0, 25.0, 1.3);
  }
  if (k === 'stiletto') {
    out.push(P([c - 0.85, 17, c, 17, c, 4.6], 'steel', { bv: 0.3, n: [-0.42, 0, 0.9] }));
    out.push(P([c, 17, c + 0.85, 17, c, 4.6], 'steel', { bv: 0.3, n: [0.2, 0, 0.98] }));
    out.push(K(c - 2.7, 17.5, c + 2.7, 17.5, 0.45, 0.45, 'iron'));
    out.push(E(c - 2.9, 17.5, 0.75, 0.75, 'iron'), E(c + 2.9, 17.5, 0.75, 0.75, 'iron'));
    out.push(K(c, 18.0, c, 22.6, 0.7, 0.65, 'leatherDark'));
    out.push(loop(c, 24.0, 1.25, 1.25, 0.45, 'iron', 12));
    return lay(T(out, { s: 0.95, px: 16, py: 16 }), 45, 4.6, 25.3, 1.1);
  }
  // a carpenter's chisel: bulbous handle, iron ferrule, flat shank, bright bevel
  out.push(K(c, 24.4, c, 17.6, 1.55, 1.3, 'wood'));
  out.push(E(c, 24.8, 1.6, 0.9, 'woodDark'));
  out.push(K(c, 17.6, c, 16.2, 1.25, 1.25, 'iron'));
  out.push(P([c - 0.7, 16.2, c + 0.7, 16.2, c + 1.35, 8.2, c - 1.35, 8.2], 'steel', { bv: 0.4, n: [-0.1, 0, 1] }));
  out.push(P([c - 1.35, 8.3, c + 1.35, 8.3, c + 1.35, 7.0, c - 1.35, 7.0], 'silver', { n: [-0.3, -0.5, 0.8] }));
  return lay(T(out, { s: 0.85, px: 16, py: 16 }), 45, 9.5, 23.0, 1.3);
}

/** The longest things on the floor: an ash spear with a leaf of ice, a hooked sun-glaive. */
export function polearmModel(_f: number, v: ItemVariant): PrimTree {
  const c = 16;
  const out: Out = [];
  if ((v.kind || 'ice') === 'ice') {
    // ice spear: an ash shaft and a leaf-blade of clear ice, rime growing from the binding
    out.push(K(c, 27.6, c, 11.2, 0.6, 0.56, 'item_ash'));
    out.push(K(c, 27.4, c, 28.8, 0.6, 0.2, 'iron'));
    out.push(P([c - 0.6, 11.0, c - 2.5, 9.6, c - 0.6, 9.4], 'ice', { n: [-0.3, -0.3, 0.9] }), P([c + 0.6, 11.0, c + 0.6, 9.4, c + 2.3, 10.2], 'ice', { n: [0.3, -0.2, 0.93] }));
    out.push(K(c, 12.6, c, 9.6, 0.92, 0.8, 'leatherDark'));
    out.push(P([c, 10.2, c - 1.8, 7.0, c - 1.3, 3.4, c, 0.6], 'ice', { bv: 0.5, n: [-0.42, 0, 0.9] }));
    out.push(P([c, 10.2, c, 0.6, c + 1.3, 3.4, c + 1.8, 7.0], 'ice', { bv: 0.5, n: [0.22, 0, 0.97] }));
    return lay(out, 45, 0.6, 28.8, 1.2);
  }
  // sun-glaive: a long single-edged blade, a hook on its spine, a rayed bronze disc at the socket
  out.push(K(c, 28.4, c, 13.0, 0.62, 0.6, 'wood'));
  out.push(E(c, 28.6, 0.8, 0.8, 'iron'));
  const dx = c, dy = 14.2;
  for (let i = 0; i < 6; i++) {
    const t = (i * 60 + 30) * RAD, ca = Math.cos(t), sa = Math.sin(t), tx = -sa, ty = ca;
    out.push(P([dx + ca * 1.6 + tx * 0.9, dy + sa * 1.6 + ty * 0.9, dx + ca * 3.5, dy + sa * 3.5, dx + ca * 1.6 - tx * 0.9, dy + sa * 1.6 - ty * 0.9], 'bronze', { bv: 0.3, n: [ca * 0.3, sa * 0.3, 0.95] }));
  }
  out.push(E(dx, dy, 2.0, 2.0, 'bronze'));
  out.push(E(dx - 0.3, dy - 0.3, 0.9, 0.9, 'bronze', { ink: 0.12 }));
  out.push(K(c, 12.4, c, 10.0, 0.9, 0.8, 'bronze'));
  // a broad single-edged blade: straight spine, the edge swelling toward the light, a back-hook
  out.push(P([c + 0.5, 10.4, c - 1.2, 9.6, c - 2.8, 6.8, c - 3.2, 4.0, c - 2.4, 1.8, c - 0.6, 0.2, c + 0.5, 4.0], 'steel', { bv: 0.5, n: [-0.42, 0, 0.9] }));
  out.push(P([c + 0.5, 10.4, c + 0.5, 4.0, c - 0.6, 0.2, c + 1.3, 2.6, c + 1.3, 10.4], 'steel', { bv: 0.3, n: [0.2, 0, 0.98] }));
  out.push(P([c + 1.2, 5.6, c + 3.4, 4.2, c + 2.6, 5.6, c + 1.2, 7.4], 'steel', { n: [0.2, -0.2, 0.96] }));
  return lay(out, 45, 0.2, 29.4, 1.2);
}

/** The Ironwood bough: a gnarled dark stave, a crook at the head, iron bands. */
export function staffModel(): PrimTree {
  const out: Out = [];
  const pts = [[16.5, 29.6], [15.6, 23.0], [16.5, 16.0], [15.7, 9.6], [15.4, 6.0], [14.6, 3.8], [15.6, 1.8], [17.4, 2.2], [18.0, 3.8]];
  const rr = [1.0, 1.05, 0.98, 0.95, 0.9, 0.8, 0.72, 0.6, 0.45];
  out.push(K(16.2, 10.2, 18.8, 7.4, 0.55, 0.3, 'item_ironwood'), K(16.0, 15.2, 13.6, 13.4, 0.5, 0.28, 'item_ironwood'));
  for (let i = 0; i < pts.length - 1; i++) out.push(K(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rr[i], rr[i + 1], 'item_ironwood'));
  out.push(E(15.9, 19.4, 1.35, 0.95, 'item_ironwood'), E(16.3, 12.6, 1.25, 0.9, 'item_ironwood'));
  out.push(K(14.9, 25.0, 17.2, 25.4, 0.45, 0.45, 'iron'), K(14.6, 7.0, 16.6, 7.4, 0.42, 0.42, 'iron'));
  out.push(K(16.5, 28.6, 16.6, 30.2, 1.0, 0.8, 'iron'));
  return lay(out, 45, 1.6, 30.4, 1.3);
}
