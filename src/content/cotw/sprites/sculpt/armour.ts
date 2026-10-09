import { E, K, P, X, Sh, T, type PrimTree } from './kit';
import { RAD, loop, rot, type ItemVariant, type Out } from './itemKit';

/** Weight reads as size and shine: a fur jerkin, a mail byrnie, a plate cuirass. */
export function bodyArmourModel(_f: number, v: ItemVariant): PrimTree {
  const out: Out = [];
  const k = v.kind || 'light';
  if (k === 'light') {
    // fur jerkin: small and soft; a leather vest, a fur collar and hem
    out.push(Sh(16.8, 23.8, 8, 2.2, 0.36));
    const vest = [10.2, 8.8, 13.4, 7.8, 16, 11.4, 18.6, 7.8, 21.8, 8.8, 22.6, 11.0, 21.2, 13.6, 22.2, 22.0, 16, 23.0, 9.8, 22.0, 10.8, 13.6, 9.4, 11.0];
    const parts = [
      P(vest, 'leather', { bv: 2.0 }),
      K(16, 12.0, 16, 22.4, 0.3, 0.3, 'leatherDark', { occ: false }),
      K(10.6, 9.4, 13.0, 15.0, 0.28, 0.28, 'leatherDark', { occ: false, ol: false }), K(21.4, 9.4, 19.0, 15.0, 0.28, 0.28, 'leatherDark', { occ: false, ol: false }),
      K(12.4, 8.0, 16, 11.8, 1.45, 1.2, 'furGrey'), K(16, 11.8, 19.6, 8.0, 1.2, 1.45, 'furGrey'),
      K(10.0, 22.2, 22.0, 22.2, 1.3, 1.3, 'furGrey'),
      X(15.3, 14.4, 1.4, 0.9, 'horn:4'), X(15.3, 17.6, 1.4, 0.9, 'horn:4'),
    ];
    out.push(rot(parts, -8));
    return out;
  }
  if (k === 'medium') {
    // mail byrnie: the T of a shirt, short sleeves, a riveted brass hem
    out.push(Sh(16.8, 25.2, 9, 2.3, 0.38));
    const shirt = [9.4, 7.8, 13.4, 6.8, 18.6, 6.8, 22.6, 7.8, 25.4, 12.8, 22.6, 14.2, 21.6, 12.8, 21.8, 24.6, 10.2, 24.6, 10.4, 12.8, 9.4, 14.2, 6.6, 12.8];
    const parts = [
      P(shirt, 'mail', { bv: 1.6 }),
      K(10.2, 24.4, 21.8, 24.4, 0.6, 0.6, 'bronze'),
      K(13.0, 7.2, 16, 9.2, 0.8, 0.8, 'leather'), K(16, 9.2, 19.0, 7.2, 0.8, 0.8, 'leather'),
      K(7.2, 13.0, 9.2, 14.0, 0.5, 0.5, 'bronze'), K(22.8, 14.0, 24.8, 13.0, 0.5, 0.5, 'bronze'),
    ];
    out.push(rot(parts, -8));
    return out;
  }
  // plate: broad, bright, layered; pauldrons and a skirt of lames
  out.push(Sh(16.8, 25.8, 10, 2.4, 0.4));
  const parts = [
    P([10.4, 19.8, 21.6, 19.8, 22.2, 22.2, 9.8, 22.2], 'iron', { bv: 0.7 }),
    P([10.0, 22.0, 22.0, 22.0, 22.6, 24.6, 9.4, 24.6], 'iron', { bv: 0.7 }),
    P([11.0, 7.8, 13.8, 7.0, 16, 9.0, 18.2, 7.0, 21.0, 7.8, 21.8, 13.0, 20.8, 19.6, 16, 21.0, 11.2, 19.6, 10.2, 13.0], 'steel', { bv: 2.6 }),
    K(16, 9.6, 16, 20.2, 0.35, 0.35, 'silver', { occ: false }),
    // pauldrons: layered lames shingled down the shoulder
    P([6.4, 13.6, 7.2, 10.8, 10.4, 10.6, 11.4, 13.2], 'iron', { bv: 0.8 }),
    P([6.8, 11.2, 7.8, 8.0, 11.2, 7.6, 12.0, 10.6], 'steel', { bv: 1.2, n: [-0.2, -0.3, 0.93] }),
    P([25.6, 13.6, 20.6, 13.2, 21.6, 10.6, 24.8, 10.8], 'iron', { bv: 0.8 }),
    P([25.2, 11.2, 20.0, 10.6, 20.8, 7.6, 24.2, 8.0], 'steel', { bv: 1.2, n: [0.2, -0.3, 0.93] }),
    X(8.6, 8.6, 0.8, 0.8, 'silver:5'), X(22.6, 8.6, 0.8, 0.8, 'silver:5'),
  ];
  out.push(rot(parts, -8));
  return out;
}

/** Lying flat: a round plank shield quartered in paint, or an angular iron heater. */
export function shieldModel(_f: number, v: ItemVariant): PrimTree {
  const out: Out = [];
  if ((v.kind || 'round') === 'round') {
    // a round shield lying on the floor: iron rim, planks quartered in paint, a domed boss
    const cx = 16, cy = 16.4, rx = 9.6, ry = 7.6, a = -0.12;
    out.push(Sh(cx + 0.9, cy + 1.9, rx + 0.3, ry, 0.36));
    out.push(E(cx, cy, rx, ry, 'iron', { a, fl: 0.7 }));
    out.push(E(cx, cy, rx - 1.0, ry - 0.9, 'wood', { a, fl: 0.85 }));
    // painted quarters: wedges whose arcs follow the face
    const q = (t0: number, t1: number): PrimTree[number] => {
      const pts = [cx, cy];
      for (let i = 0; i <= 6; i++) {
        const t = (t0 + (t1 - t0) * (i / 6)) * RAD;
        const lx = (rx - 1.1) * Math.cos(t), ly = (ry - 1.0) * Math.sin(t);
        pts.push(cx + lx * Math.cos(a) - ly * Math.sin(a), cy + lx * Math.sin(a) + ly * Math.cos(a));
      }
      return P(pts, 'item_paint', { bv: 0.6, n: [0, 0, 1] });
    };
    out.push(q(-90, 0), q(90, 180));
    for (const t of [-0.55, 0.0, 0.55]) {
      const x = cx + t * rx * 0.9;
      const h = ry * Math.sqrt(1 - (t * 0.9) ** 2) - 1.2;
      out.push(K(x + h * Math.sin(-a), cy - h * Math.cos(a), x - h * Math.sin(-a), cy + h * Math.cos(a), 0.18, 0.18, 'woodDark', { occ: false, ol: false }));
    }
    out.push(E(cx, cy, 2.9, 2.4, 'iron', { a }), E(cx - 0.2, cy - 0.2, 2.2, 1.8, 'steel', { a }));
    return out;
  }
  // iron heater: angular, a raised rim and a central rib
  out.push(Sh(16.9, 22.2, 8.4, 3.6, 0.36));
  const outer = [8.4, 7.8, 23.6, 7.8, 23.2, 13.0, 21.2, 18.6, 16, 24.4, 10.8, 18.6, 8.8, 13.0];
  const inner = [9.8, 9.0, 22.2, 9.0, 21.9, 13.0, 20.1, 17.9, 16, 22.6, 11.9, 17.9, 10.1, 13.0];
  const parts = [
    P(outer, 'blackIron', { bv: 1.0 }),
    P(inner, 'iron', { bv: 1.6 }),
    K(16, 9.2, 16, 22.2, 0.6, 0.45, 'steel'),
    K(10.2, 12.4, 21.8, 12.4, 0.5, 0.5, 'steel'),
    E(16, 12.4, 1.5, 1.5, 'steel'),
    X(9.2, 8.4, 0.8, 0.8, 'steel:5'), X(22.2, 8.4, 0.8, 0.8, 'steel:5'), X(15.6, 23.0, 0.8, 0.8, 'steel:5'),
  ];
  out.push(rot(T(parts, { sy: 0.95, py: 16 }), -10));
  return out;
}

/** A spangenhelm resting on its mail: four plates on bronze bands, brow band, nasal. */
export function helmModel(): PrimTree {
  const dome: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = Math.PI + (Math.PI * i) / 16, ct = Math.cos(t), st = Math.sin(t);
    dome.push(16 + 6.8 * ct, 18.6 + 10.2 * st - 1.6 * Math.pow(1 - Math.abs(ct), 3));
  }
  // a band at azimuth phi, following the dome from the apex to the brow
  const band = (sinPhi: number): Out => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 5; i++) {
      const h = 1 - i / 5, r = 6.8 * Math.sqrt(1 - h * h);
      pts.push([16 + r * sinPhi, 18.6 - 10.2 * h - 1.6 * Math.pow(h, 3)]);
    }
    const out: Out = [];
    for (let i = 0; i < 5; i++) out.push(K(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.48, 0.55, 'bronze', { occ: false }));
    return out;
  };
  const parts = [
    P([8.6, 18.8, 23.4, 18.8, 24.6, 23.4, 21.0, 25.0, 16, 25.4, 11.0, 25.0, 7.4, 23.4], 'mail', { bv: 1.2 }),
    P(dome, 'iron', { bv: 3.4 }),
    K(16, 7.6, 16, 18.4, 0.55, 0.62, 'bronze', { occ: false }),
    band(-0.78), band(0.78),
    E(16, 7.2, 0.95, 0.85, 'bronze'),
    X(12.2, 15.6, 0.7, 0.7, 'bronze:4'), X(19.2, 15.6, 0.7, 0.7, 'bronze:4'),
    K(8.8, 18.8, 23.2, 18.8, 0.95, 0.95, 'bronze'),
    K(16, 19.4, 16, 24.6, 0.95, 0.7, 'iron'),
  ];
  return [Sh(16.8, 25.0, 8.8, 2.2, 0.4), rot(parts, 8, 16, 22)];
}

/** A pair of boots: one standing, its mate tipped back against it. */
export function bootsModel(): PrimTree {
  const boot = (ink: number): Out => [
    P([10.8, 8.4, 15.6, 8.4, 15.8, 18.4, 20.4, 19.2, 22.0, 21.4, 21.6, 23.0, 10.6, 23.0, 10.2, 19.0], 'leather', { bv: 1.3, ink }),
    K(10.6, 23.2, 21.8, 23.2, 0.62, 0.62, 'leatherDark', { ink }),
    K(15.6, 15.6, 16.6, 18.8, 0.42, 0.42, 'leatherDark', { occ: false, ink }),
    K(10.4, 9.0, 16.0, 9.0, 1.45, 1.45, 'furTawny', { ink }),
  ];
  return [
    Sh(17.4, 25.2, 9.4, 2.2, 0.4),
    rot(T(boot(-0.12), { dx: -3.4, dy: -0.6 }), -14, 12, 23),
    T(boot(0), { dx: 1.2, dy: 1.4 }),
  ];
}

/** Gauntlets: leather gloves with plated fingers and a flared cuff, one laid over the other. */
export function glovesModel(): PrimTree {
  const glove = (ink: number): Out => [
    P([11.6, 25.0, 20.4, 25.0, 19.0, 18.6, 13.0, 18.6], 'leather', { bv: 1.2, ink }),
    K(12.0, 24.6, 20.0, 24.6, 0.6, 0.6, 'iron', { ink }),
    K(13.4, 15.0, 10.6, 11.6, 0.95, 0.85, 'leather', { ink }),
    K(13.0, 12.6, 12.8, 6.6, 0.82, 0.72, 'iron', { ink }),
    K(15.1, 12.2, 15.1, 5.6, 0.82, 0.72, 'iron', { ink }),
    K(17.2, 12.2, 17.4, 5.9, 0.82, 0.72, 'iron', { ink }),
    K(19.2, 12.6, 19.8, 7.4, 0.78, 0.68, 'iron', { ink }),
    P([12.4, 12.0, 19.8, 12.0, 19.8, 17.0, 16.0, 19.0, 12.6, 17.0], 'iron', { bv: 1.4, ink }),
    K(12.8, 14.6, 19.6, 14.6, 0.3, 0.3, 'blackIron', { occ: false, ink }),
  ];
  return [
    Sh(16.6, 24.2, 9.2, 2.6, 0.36),
    rot(T(glove(-0.12), { dx: -3.4, dy: -1.0 }), -30, 16, 16),
    rot(T(glove(0), { dx: 1.4, dy: 0.8 }), 24, 16, 16),
  ];
}

/** A cape dropped flat, a corner turned up to show its lining, pinned with a penannular brooch. */
export function cloakModel(): PrimTree {
  const ridge = (x1: number, y1: number, x2: number, y2: number): Out => [
    K(x1 + 0.7, y1, x2 + 0.9, y2, 0.45, 0.6, 'wool', { ink: -0.14, occ: false, ol: false }),
    K(x1, y1, x2, y2, 0.4, 0.55, 'wool', { ink: 0.1, occ: false, ol: false }),
  ];
  const parts = [
    P([12.0, 8.6, 20.0, 8.6, 22.6, 13.0, 25.0, 20.4, 24.4, 23.4, 20.6, 22.6, 16.4, 24.2, 12.0, 22.8, 7.8, 23.6, 7.0, 20.4, 9.4, 13.0], 'wool', { bv: 1.6 }),
    ridge(13.6, 11.0, 10.6, 21.6), ridge(16.2, 11.4, 16.0, 22.6), ridge(18.6, 11.0, 21.6, 21.0),
    P([20.6, 22.6, 24.4, 23.4, 25.0, 20.4, 22.6, 19.6], 'woolBrown', { bv: 0.6, n: [0.2, -0.4, 0.9] }),
    K(11.0, 9.2, 21.0, 9.2, 1.7, 1.7, 'furGrey'),
    loop(16, 10.4, 1.7, 1.5, 0.48, 'bronze', 12, {}, 0.1, 0.9),
    E(16 + 1.7 * Math.cos(0.2 * Math.PI), 10.4 + 1.5 * Math.sin(0.2 * Math.PI), 0.6, 0.6, 'bronze'),
    E(16 + 1.7 * Math.cos(1.8 * Math.PI), 10.4 + 1.5 * Math.sin(1.8 * Math.PI), 0.6, 0.6, 'bronze'),
    K(13.6, 12.2, 18.6, 8.8, 0.32, 0.32, 'bronze'),
  ];
  return [Sh(16.8, 23.8, 9.6, 2.4, 0.4), rot(parts, -10, 16, 17)];
}
