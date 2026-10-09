import { E, K, P, X, Lt, Sh, T, type PrimTree } from './kit';
import { rot, rp, shLine, type Out } from './itemKit';

/** Níðhögg's Fang: the dragon's shed tooth made a blade; a bead of bile swells and drips at the point. */
export function fangModel(f: number): PrimTree {
  const out: Out = [];
  const tooth = [13.2, 19.2, 12.8, 15.0, 13.4, 11.0, 14.8, 7.6, 17.2, 5.0, 20.0, 3.8, 18.6, 6.8, 17.6, 9.6, 17.4, 12.8, 17.8, 16.0, 18.4, 19.2];
  out.push(P(tooth, 'item_fang', { bv: 2.0, n: [-0.1, 0, 1] }));
  out.push(P([13.2, 19.2, 13.0, 17.0, 17.9, 17.0, 18.4, 19.2], 'item_fangRoot', { bv: 0.8 }));
  out.push(K(15.6, 15.8, 15.4, 11.6, 0.26, 0.26, 'item_fangRoot', { occ: false, ol: false }), K(15.4, 11.6, 16.4, 8.2, 0.24, 0.22, 'item_fangRoot', { occ: false, ol: false }), K(16.4, 8.2, 18.4, 5.6, 0.22, 0.18, 'item_fangRoot', { occ: false, ol: false }));
  out.push(K(13.0, 19.8, 18.4, 19.8, 0.95, 0.95, 'blackIron'));
  out.push(K(15.6, 20.4, 15.6, 25.6, 1.05, 0.95, 'leatherDark'));
  for (let y = 21.2; y < 25.2; y += 1.3) out.push(K(14.6, y + 0.4, 16.6, y - 0.4, 0.26, 0.26, 'linen', { occ: false, ol: false }));
  out.push(E(15.6, 26.4, 1.4, 1.1, 'blackIron'));
  const deg = 34, s = 0.95;
  const laid = rot(T(out, { s, px: 16, py: 16 }), deg);
  // the bead and its drip hang straight down in world space
  const tip = rp(16 + (20.0 - 16) * s, 16 + (3.8 - 16) * s, deg);
  const swell = [0, 0.15, 0.3, 0.05][f % 4];
  const bead: Out = [
    E(tip[0] + 0.2, tip[1] + 0.9 + swell * 0.6, 1.0 + swell * 0.4, 1.15 + swell * 0.7, 'emPoison'),
    X(tip[0] - 0.2, tip[1] + 0.5 + swell * 0.5, 0.7, 0.7, '#e2ff9a', { em: true }),
  ];
  if (f % 4 === 3) bead.push(E(tip[0] + 0.2, tip[1] + 4.2, 0.55, 0.7, 'emPoison'));
  const a = rp(16, 16 + (4 - 16) * s, deg), b = rp(16, 16 + (27.4 - 16) * s, deg);
  return [shLine(a[0], a[1], b[0], b[1], 1.6, 0.4), laid, bead, Lt(tip[0], tip[1] + 1.2, 9, '#95dc4c', 0.85 + swell * 0.4)];
}

/** Shard of the Hearth-Tear: a splinter of Sól's chariot, sunlight trapped in jagged crystal. */
export function hearthTearModel(f: number): PrimTree {
  const pulse = [0, 0.06, 0.12, 0.06][f % 4];
  /* A crystal is straight lines: three prism faces (lit, front, shadowed) running parallel
   * up to a faceted point, a snapped base. The core is a seam of white-gold in the front face. */
  const prism = (cx: number, by: number, ty: number, w: number, deg: number, core: boolean): PrimTree => {
    const l = cx - w / 2, r = cx + w / 2, a = cx - w * 0.2, b = cx + w * 0.22, tx = cx + w * 0.06, sy = ty + w * 1.0;
    const out: Out = [
      P([l, by - 0.4, l, sy + 0.4, tx, ty, a, sy, a, by + 0.5], 'item_sunglass', { n: [-0.62, -0.15, 0.77] }),
      P([a, by + 0.5, a, sy, tx, ty, b, sy + 0.3, b, by - 0.2, cx, by + 0.7], 'item_sunglass', { n: [-0.05, -0.2, 0.98] }),
      P([b, by - 0.2, b, sy + 0.3, tx, ty, r, sy + 0.9, r, by - 0.8], 'item_sunglass', { n: [0.6, -0.1, 0.79] }),
    ];
    if (core) {
      out.push(P([tx, ty + 0.4, b - 0.3, sy + 2, cx + 0.5, by - 4, cx, by - 1.2, a + 0.4, by - 5, a + 0.5, sy + 1.6], 'item_suncore', { ink: pulse }));
      out.push(E(cx, (sy + by) / 2 + 1, w * 0.18 + pulse * 2, w * 0.5 + pulse * 3, 'item_suncore', { ink: pulse + 0.12 }));
    }
    return rot(out, deg, cx, by);
  };
  const sp = [[19.2, 4.6], [13.4, 13.2], [19.6, 12.0], [9.2, 15.4]][f % 4];
  return [
    Sh(15.8, 24.6, 8.8, 2.0, 0.36),
    prism(10.6, 24.2, 13.6, 3.4, -26, false),
    prism(21.6, 24.6, 17.6, 2.6, 30, false),
    prism(16.0, 24.4, 4.6, 6.0, 12, true),
    X(sp[0] - 0.4, sp[1] - 0.4, 0.8, 0.8, '#ffffff', { em: true }),
    Lt(16.4, 15.0, 11, '#ffd27a', 0.6 + pulse * 1.5),
  ];
}
