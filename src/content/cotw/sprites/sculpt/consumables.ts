import { E, K, P, X, Lt, Sh, T, type PrimTree } from './kit';
import { glint, lay, rot, stroke, type ItemVariant, type Out } from './itemKit';

/** The vessel names the kind before colour does: red flask, blue phial, mead horn, stew, poultice. */
export function potionModel(_f: number, v: ItemVariant): PrimTree {
  const k = v.kind || 'heal';
  if (k === 'heal') {
    // squat round flask, red
    const cx = 16, cy = 18.4, r = 5.2, lv = cy - 1.0, ri = r - 0.55;
    const cap: number[] = [];
    const h = Math.acos((cy - lv) / ri);
    for (let i = 0; i <= 10; i++) { const t = -Math.PI / 2 - h + (2 * h * i) / 10; cap.push(cx + ri * Math.cos(t), cy + ri * Math.sin(t)); }
    const half = ri * Math.sin(h);
    const parts = [
      E(cx, cy, r, r * 0.96, 'item_glass'),
      E(cx, cy, ri, ri * 0.96, 'item_heal'),
      P(cap, 'item_glass', { n: [-0.2, -0.45, 0.87], bv: 0.8 }),
      E(cx, lv, half, 0.75, 'item_heal', { ink: 0.18, fl: 0.9 }),
      K(cx, cy - r + 0.8, cx, cy - r - 2.4, 1.2, 1.05, 'item_glass'),
      E(cx, cy - r - 2.5, 1.55, 0.6, 'item_glass'),
      K(cx, cy - r - 2.6, cx, cy - r - 4.2, 1.05, 0.95, 'wood'),
      K(cx - 1.25, cy - r - 1.2, cx + 1.25, cy - r - 1.2, 0.38, 0.38, 'item_twine', { occ: false }),
      glint(cx - 3.3, cy - 1.8, cx - 2.4, cy - 3.4, 0.45),
    ];
    return [Sh(16.8, 23.8, 5.8, 1.9, 0.4), rot(parts, -10, 16, 23)];
  }
  if (k === 'mana') {
    // tall phial, blue
    const parts = [
      K(16, 23.0, 16, 12.8, 2.35, 2.0, 'item_glass'),
      K(16, 23.1, 16, 15.8, 1.9, 1.75, 'item_mana'),
      E(16, 15.6, 1.72, 0.55, 'item_mana', { ink: 0.18 }),
      K(16, 12.8, 16, 9.4, 0.85, 0.8, 'item_glass'),
      E(16, 9.3, 1.35, 0.55, 'item_glass'),
      K(16, 9.2, 16, 7.6, 0.85, 0.8, 'wood'),
      E(16, 7.4, 1.1, 0.7, 'woodDark'),
      glint(14.6, 21.4, 14.7, 15.0, 0.42),
    ];
    return [Sh(17.6, 24.2, 4.2, 1.7, 0.4), rot(parts, 14, 16, 24)];
  }
  if (k === 'mead') {
    // drinking horn resting on its belly, gold mead at the mouth
    const c = [[10.6, 12.6, 2.9], [11.4, 16.8, 2.6], [13.8, 20.2, 2.1], [17.6, 21.6, 1.55], [21.2, 20.2, 1.05], [23.0, 17.2, 0.6], [23.2, 15.4, 0.35]];
    const out: Out = [Sh(17.0, 23.2, 8.4, 2.0, 0.38)];
    for (let i = 0; i < c.length - 1; i++) out.push(K(c[i][0], c[i][1], c[i + 1][0], c[i + 1][1], c[i][2], c[i + 1][2], 'horn'));
    out.push(K(9.0, 14.6, 13.6, 14.0, 0.5, 0.5, 'bronze', { occ: false }));
    out.push(E(23.2, 15.2, 0.7, 0.7, 'bronze'));
    out.push(E(10.6, 12.4, 3.0, 1.3, 'bronze', { a: 0.12 }));
    out.push(E(10.6, 12.4, 2.3, 0.85, 'item_mead', { a: 0.12, ink: 0.1 }));
    return out;
  }
  if (k === 'stew') {
    // wooden bowl of stew, a spoon left in it
    const out: Out = [Sh(16.8, 22.4, 7.6, 2.0, 0.4)];
    out.push(P([8.8, 15.4, 23.2, 15.4, 22.2, 18.6, 19.6, 20.6, 16, 21.2, 12.4, 20.6, 9.8, 18.6], 'wood', { bv: 1.6 }));
    out.push(E(16, 21.0, 3.0, 0.9, 'woodDark'));
    out.push(E(16, 15.4, 7.2, 2.7, 'wood'));
    out.push(E(16, 15.5, 6.1, 2.0, 'item_stew'));
    out.push(E(13.6, 15.2, 1.1, 0.7, 'item_crumb'), E(16.8, 14.6, 0.9, 0.6, 'item_crumb'), E(15.0, 16.2, 0.8, 0.5, 'leather'), E(18.2, 16.0, 0.9, 0.55, 'item_crumb'));
    out.push(K(18.4, 15.2, 24.4, 9.4, 0.62, 0.72, 'wood'));
    out.push(E(24.6, 9.2, 0.9, 0.75, 'wood'));
    return out;
  }
  // poultice: a linen bundle of herbs tied with twine, seeping birch tar
  return [
    Sh(16.8, 23.4, 6.6, 1.9, 0.4),
    K(15.4, 13.6, 12.2, 8.6, 0.32, 0.28, 'item_herb'), E(12.0, 8.6, 1.3, 0.7, 'item_herb', { a: -1.0 }), E(13.4, 10.6, 1.2, 0.6, 'item_herb', { a: 0.5 }),
    K(16.6, 13.4, 18.6, 8.8, 0.3, 0.26, 'item_herb'), E(18.8, 8.6, 1.2, 0.65, 'item_herb', { a: 1.1 }),
    E(16, 18.8, 5.6, 4.6, 'linen', { fl: 0.25 }),
    E(17.8, 20.6, 1.9, 1.2, 'item_tar', { fl: 0.85, a: 0.3, ink: 0.12 }),
    P([12.4, 14.6, 13.6, 11.6, 15.0, 13.0, 16.2, 11.2, 17.4, 12.8, 19.0, 11.6, 19.8, 14.4, 18.2, 15.6, 13.8, 15.6], 'linen', { bv: 0.9 }),
    K(13.4, 15.0, 18.6, 15.0, 0.55, 0.55, 'item_twine'),
    K(18.2, 15.2, 20.0, 17.6, 0.32, 0.25, 'item_twine'),
    K(17.6, 15.4, 18.4, 18.0, 0.3, 0.25, 'item_twine'),
  ];
}

/** A sheet between two rolls, ruled with dark lines of runes. */
export function scrollModel(): PrimTree {
  const parts = [
    P([10.4, 9.2, 21.6, 9.2, 21.6, 22.0, 10.4, 22.0], 'item_parch', { bv: 0.6 }),
    K(12.6, 12.4, 19.4, 12.4, 0.38, 0.38, 'item_ink', { occ: false }),
    K(12.6, 14.6, 18.0, 14.6, 0.38, 0.38, 'item_ink', { occ: false }),
    K(12.6, 16.8, 19.4, 16.8, 0.38, 0.38, 'item_ink', { occ: false }),
    K(12.6, 19.0, 16.6, 19.0, 0.38, 0.38, 'item_ink', { occ: false }),
    K(9.4, 9.0, 22.6, 9.0, 1.6, 1.6, 'item_parch'),
    E(9.2, 9.0, 0.8, 1.55, 'item_parch', { ink: -0.18 }), E(22.8, 9.0, 0.8, 1.55, 'item_parch', { ink: -0.18 }),
    K(9.4, 22.2, 22.6, 22.2, 1.6, 1.6, 'item_parch'),
    E(9.2, 22.2, 0.8, 1.55, 'item_parch', { ink: -0.18 }), E(22.8, 22.2, 0.8, 1.55, 'item_parch', { ink: -0.18 }),
  ];
  return [Sh(17.0, 22.8, 8.2, 2.6, 0.36), rot(T(parts, { sy: 0.88, py: 16 }), -18)];
}

const WAND_EL: Record<string, { c: string; m: string; core: string }> = {
  fire: { c: '#ff8a2c', m: 'emFire', core: 'emFireCore' },
  frost: { c: '#9fe6ff', m: 'emFrost', core: 'item_glint' },
  bolt: { c: '#fff27a', m: 'emBolt', core: 'item_glint' },
};

/** The wand takes the shape of its element and the tip holds it: ember claw, ice crystal, spark. */
export function wandModel(f: number, v: ItemVariant): PrimTree {
  const k = v.kind || 'fire', el = WAND_EL[k], c = 16, out: Out = [], p = f % 2;
  if (k === 'fire') {
    // dark wood, a two-pronged claw holding an ember
    out.push(K(c, 25.4, c, 9.6, 0.88, 0.6, 'woodDark'));
    out.push(K(c, 25.6, c, 21.2, 0.98, 0.95, 'leather'));
    out.push(E(c, 25.9, 1.0, 0.8, 'bronze'));
    for (const y of [12.6, 15.0, 17.4]) out.push(K(c - 0.7, y + 0.3, c + 0.7, y - 0.3, 0.22, 0.22, 'wood', { occ: false, ol: false }));
    out.push(K(c, 10.2, c - 1.9, 6.4, 0.5, 0.3, 'woodDark'), K(c, 10.2, c + 1.9, 6.4, 0.5, 0.3, 'woodDark'));
    out.push(E(c, 7.4, 1.65 + p * 0.15, 1.65 + p * 0.15, el.m), E(c - 0.2, 7.2, 0.8, 0.8, el.core));
    out.push(Lt(c, 7.4, 7, el.c, 0.8 + p * 0.12));
  } else if (k === 'frost') {
    // pale birch, a six-sided ice crystal at the tip
    out.push(K(c, 25.4, c, 10.0, 0.82, 0.62, 'item_birch'));
    for (const [y, w] of [[13.4, 0.9], [17.8, 0.7], [21.6, 1.0]]) out.push(X(c - 0.5, y, w, 0.5, 'woodDark:2'));
    out.push(E(c, 25.8, 0.9, 0.75, 'silver'));
    out.push(K(c - 0.9, 10.4, c + 0.9, 10.4, 0.45, 0.45, 'silver'));
    out.push(P([c, 3.8 - p * 0.2, c + 1.15, 5.6, c + 1.15, 8.6, c, 10.2, c - 1.15, 8.6, c - 1.15, 5.6], el.m));
    out.push(P([c - 0.4, 5.4, c + 0.3, 5.0, c + 0.3, 8.4, c - 0.4, 8.8], el.core));
    out.push(Lt(c, 7.0, 7, el.c, 0.75 + p * 0.12));
  } else {
    // a jagged black wand, bent like the bolt it throws, an iron fork and a spark
    const z = [[c, 25.6], [c + 0.8, 20.4], [c - 0.7, 16.2], [c + 0.6, 12.0], [c, 9.6]];
    for (let i = 0; i < z.length - 1; i++) out.push(K(z[i][0], z[i][1], z[i + 1][0], z[i + 1][1], 0.82 - i * 0.06, 0.78 - i * 0.06, 'blackIron'));
    out.push(E(c, 25.9, 1.0, 0.8, 'iron'));
    out.push(K(c, 9.8, c - 1.4, 6.4, 0.42, 0.28, 'iron'), K(c, 9.8, c + 1.4, 6.4, 0.42, 0.28, 'iron'));
    out.push(E(c, 7.2, 0.95 + p * 0.2, 0.95 + p * 0.2, el.m), E(c, 7.2, 0.45, 0.45, el.core));
    out.push(K(c - 0.4, 6.4, c + 0.6, 4.8 - p * 0.3, 0.25, 0.2, el.m), K(c + 0.6, 4.8 - p * 0.3, c - 0.2, 3.8 - p * 0.4, 0.2, 0.15, el.m));
    out.push(Lt(c, 7.2, 7, el.c, 0.75 + p * 0.15));
  }
  return lay(out, 45, 4.0, 26.4, 1.0);
}

/** A Rune Tablet: a small hewn slab lying flat, Ansuz (lore) carved in it and lit rune-blue. */
export function tabletModel(f: number): PrimTree {
  const ink = f % 2 ? 0.12 : 0;
  const top = [8.4, 12.4, 20.8, 9.8, 22.2, 10.8, 23.6, 19.8, 11.0, 22.6, 9.8, 21.4];
  const side = [9.8, 21.4, 11.0, 22.6, 23.6, 19.8, 23.6, 21.8, 11.0, 24.6, 9.8, 23.2];
  return [
    Sh(17.0, 23.8, 8.4, 2.4, 0.4),
    P(side, 'item_slab', { bv: 0.5, n: [0.1, 0.6, 0.8] }),
    P(top, 'item_slab', { bv: 1.2, n: [-0.1, -0.3, 0.95] }),
    X(10.6, 13.2, 0.8, 0.8, 'item_slab:2'), X(21.0, 18.6, 0.8, 0.8, 'item_slab:2'),
    stroke(14.0, 13.0, 15.2, 20.6, 'emArcane', ink),
    stroke(14.3, 13.8, 18.4, 15.4, 'emArcane', ink),
    stroke(14.7, 16.6, 18.8, 18.2, 'emArcane', ink),
    Lt(16.2, 16.6, 6.5, '#6aa6ff', 0.45 + (f % 2) * 0.12),
  ];
}

/** Rune of Return: a standing rune-stone carved with Raidho, the road home. */
export function runeStoneModel(f: number): PrimTree {
  const ink = f % 2 ? 0.12 : 0;
  const stone: number[] = [];
  const jit = [0, 0.4, -0.3, 0.5, -0.2, 0.3, -0.4, 0.2, 0.5, -0.3, 0.2, -0.2];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * 2 * Math.PI - Math.PI / 2;
    stone.push(16 + (5.8 + jit[i]) * Math.cos(t), 16.6 + (7.6 + jit[(i + 3) % 12] * 0.6) * Math.sin(t));
  }
  const parts = [
    P(stone, 'item_slab', { bv: 2.8 }),
    X(19.4, 13.0, 0.8, 0.8, 'item_slab:2'), X(12.0, 20.6, 0.8, 0.8, 'item_slab:2'),
    stroke(14.0, 11.6, 14.0, 21.8, 'emArcane', ink),
    stroke(14.2, 11.6, 17.8, 13.6, 'emArcane', ink),
    stroke(17.8, 13.6, 14.4, 16.6, 'emArcane', ink),
    stroke(15.0, 16.4, 18.4, 21.6, 'emArcane', ink),
    Lt(15.8, 16.4, 7, '#6aa6ff', 0.5 + (f % 2) * 0.12),
  ];
  return [Sh(16.8, 24.2, 6.6, 2.0, 0.42), rot(parts, 8, 16, 24)];
}

/** A round rye loaf, its scored crust split open, a slice leaning on it. */
export function breadModel(): PrimTree {
  return [
    Sh(16.8, 22.4, 8.2, 2.2, 0.4),
    E(14.8, 17.0, 6.6, 4.8, 'item_crust', { fl: 0.1 }),
    K(10.6, 17.6, 13.2, 13.6, 0.55, 0.45, 'item_crumb', { occ: false }),
    K(13.4, 18.4, 16.0, 14.0, 0.55, 0.45, 'item_crumb', { occ: false }),
    K(16.2, 18.8, 18.6, 14.8, 0.55, 0.45, 'item_crumb', { occ: false }),
    // the slice: a domed crumb face inside its crust
    E(22.0, 18.8, 3.3, 3.6, 'item_crust', { fl: 0.85, a: 0.25 }),
    E(21.8, 19.0, 2.6, 2.9, 'item_crumb', { fl: 0.9, a: 0.25 }),
    X(21.0, 18.4, 0.6, 0.6, 'item_crumb:2'), X(22.6, 19.8, 0.6, 0.6, 'item_crumb:2'),
    X(12.0, 14.0, 0.8, 0.8, 'item_crumb:5'), X(17.4, 13.4, 0.8, 0.8, 'item_crumb:5'),
  ];
}

/** A pitch torch dropped on the floor, its flame still climbing. */
export function torchModel(f: number): PrimTree {
  const sx = [0, 0.7, 0.2, -0.6][f % 4], sh = [0, -0.7, 0.3, -0.3][f % 4];
  const out: Out = [Sh(15.4, 24.4, 8.4, 2.0, 0.42)];
  out.push(K(6.6, 24.6, 19.4, 18.0, 0.82, 0.95, 'wood'));
  out.push(E(6.4, 24.7, 0.95, 0.85, 'woodDark'));
  out.push(K(18.6, 18.4, 22.6, 16.4, 1.6, 1.85, 'item_pitch'));
  out.push(K(19.6, 17.0, 20.4, 19.2, 0.32, 0.32, 'item_twine', { occ: false }), K(21.4, 16.0, 22.2, 18.2, 0.32, 0.32, 'item_twine', { occ: false }));
  // flame
  out.push(P([19.4, 15.8, 20.2, 12.0, 21.8 + sx * 0.5, 9.4 + sh * 0.5, 22.8 + sx, 5.6 + sh, 23.6 + sx * 0.6, 9.2, 25.2 + sx * 0.3, 8.6 + sh * 0.4, 25.4, 11.8, 25.0, 15.0, 22.4, 16.8], 'emFire'));
  out.push(P([21.4, 15.0, 21.9, 13.0, 22.7 + sx * 0.5, 11.2 + sh * 0.5, 23.4, 13.0, 23.4, 15.0, 22.4, 15.8], 'emFireCore'));
  const ember = [[24.6, 4.4], [21.0, 5.2], [25.8, 3.0], [22.2, 3.4]][f % 4];
  out.push(X(ember[0], ember[1], 0.8, 0.8, 'emFire:4', { em: true }));
  out.push(Lt(22.6, 12.0, 11, '#ff9a40', 0.95));
  return out;
}
