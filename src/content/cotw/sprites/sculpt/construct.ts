import { E, K, P, X, Lt, Sh, arc, breath, sway, type Prim, type PrimTree } from './kit';
import { claws, limb, spike, type FamilyVariant } from './family';
import './materials';

type Out = PrimTree[number][];

/** Bark-Husk Miner: a hollow trunk banded in iron and set to dig. Leans on one fist like an ape; the other arm is a pick. Sap-light inside. */
function barkhusk(f: number): PrimTree {
  const b = breath(f);
  const sw = sway(f);
  const out: Out = [Sh(15.6, 28.6, 11.4, 2.4)];
  // knuckle arm
  out.push(limb([10.4, 12, 7.4, 18.6, 6.8, 24.4], 2.2, 1.8, 'bark', { ink: -0.08 }));
  out.push(E(6.8, 26.2, 2.4, 2, 'bark', { ink: -0.08 }), K(4.8, 23.4, 8.8, 23.4, 0.6, 0.6, 'blackIron'));
  // legs
  out.push(K(12, 21.6, 11.2, 27, 2.4, 2.1, 'bark'), K(18.6, 21.6, 19.2, 27, 2.4, 2.1, 'bark'));
  out.push(E(11, 27.8, 2.8, 1.3, 'blackIron'), E(19.6, 27.8, 2.8, 1.3, 'blackIron'));
  // barrel trunk
  out.push(E(15, 15.6 + b * 0.2, 7.2, 7.6, 'bark', { a: -0.12 }));
  // sap seeping from the split
  const pl = [0, 0.06, 0.1, 0.04][f];
  out.push(P([15.4, 9.6, 16.8, 12.4, 15.8, 14.6, 17.2, 17.6, 16, 21, 14.8, 17.6, 15.4, 15, 14.4, 12.4], 'mon2_sap', { ink: pl }));
  out.push(X(15.6, 21.2, 0.6, 1.4 + f * 0.3, 'mon2_sap:4'));
  // iron bands
  out.push(arc(15, 11.4, 6.2, 1.4, 0.05, Math.PI - 0.05, 8, 0.6, 0.6, 'blackIron'));
  out.push(arc(15, 19.6, 6.6, 1.5, 0.05, Math.PI - 0.05, 8, 0.6, 0.6, 'blackIron'));
  out.push(X(9.6, 12.2, 0.6, 0.6, 'steel:5'), X(20.2, 12.4, 0.6, 0.6, 'steel:5'), X(9.4, 20.4, 0.6, 0.6, 'steel:5'), X(20.8, 20.6, 0.6, 0.6, 'steel:5'));
  out.push(E(10.6, 9.4, 2.2, 1, 'mon2_lichen'), E(13.6, 8.4, 1.4, 0.8, 'mon2_lichen'));
  // head sunk between the shoulders, under a miner's iron cap
  out.push(E(21.2, 10, 3, 2.6, 'bark'));
  out.push(X(20.6, 10.6, 4.2, 1.2, 'mon2_hollow:1'));
  out.push(X(21.2, 10.7, 1.1, 0.8, 'mon2_sap:4'), X(23, 10.6, 0.9, 0.8, 'mon2_sap:4'));
  out.push(P([17.8, 9.4, 18.6, 7, 21.2, 6, 23.8, 7, 24.6, 9.2], 'blackIron', { bv: 1 }), K(17.6, 9.4, 25.4, 9.2, 0.5, 0.5, 'iron'));
  // the pick arm, raised
  const ps = sw * 0.3;
  out.push(K(20.8, 12.6, 23.6, 17.2, 2.3, 1.9, 'bark'), K(23.6, 17.2, 25.2 + ps, 10.2, 1.9, 1.4, 'bark'));
  out.push(K(22.6, 16.8, 24.8, 17.6, 0.6, 0.6, 'blackIron'), K(24.2 + ps, 11.8, 26.2 + ps, 12.2, 0.55, 0.55, 'blackIron'));
  out.push(K(25.2 + ps, 10.2, 25.8 + ps, 6.4, 0.75, 0.75, 'woodDark'));
  // the back point stops short of the cell's right edge
  out.push(K(25.8 + ps, 6.6, 20.8 + ps, 4.8, 1.15, 0.25, 'steel'), K(25.8 + ps, 6.6, 30 + ps, 9, 1.15, 0.25, 'steel'));
  out.push(E(25.8 + ps, 6.6, 1.3, 1.3, 'iron'));
  out.push(Lt(15.8, 15.4, 10, '#cddc52', 0.9));
  return out;
}

/** Bellows-Automaton: dwarven bellows on brass bird-legs. The boards open and close as it breathes; soot rolls from its stack; the firebox glows. */
function bellows(f: number): PrimTree {
  const b = breath(f);
  const op = b * 1.1;
  const out: Out = [Sh(16, 28.6, 9.4, 2.2)];
  // soot rolling up from the stack, kept a unit below the cell's top row
  const r = f * 0.35;
  out.push(E(13.2 + r * 0.3, 4.4 - r, 2.2, 1.8, 'mon2_soot'), E(15.8 + r * 0.5, 2.8 - r * 0.4, 1.7 + r * 0.3, 1.3, 'mon2_soot'), E(11, 2.4 - r * 0.3, 1.2, 1, 'mon2_soot'));
  // far leg
  out.push(limb([18.6, 20.6, 21, 23.6, 19.6, 27.6], 1.2, 0.85, 'bronze', { ink: -0.14 }));
  out.push(claws(19.6, 27.8, 0, 1.6, 'bronze', 3, 0.4));
  // smokestack
  out.push(K(12.6, 11.8, 12.6, 6, 1.2, 1.4, 'iron'), E(12.6, 5.4, 1.9, 0.7, 'blackIron'));
  // bottom board with its handle, leather belly, top board hinged at the nozzle
  const tb = 12.6 - op; // the back edge of the top board rises as it breathes
  out.push(K(7, 21.2, 3.2, 22.6, 0.7, 0.6, 'woodDark'));
  out.push(P([6.6, 20, 22.6, 18.8, 23, 20, 7, 22.4], 'woodDark', { bv: 0.6 }));
  // the leather: an accordion wedge whose back edge zig-zags out past the boards (the
  // silhouette says "bellows"), creases running to the hinge
  const ya = tb + 0.8;
  const yb = 20.4;
  const nz = 3;
  const zz = [22.4, 15.4, 7.4, ya];
  for (let i = 0; i < nz; i++) {
    const yo = ya + ((yb - ya) * (i + 0.5)) / nz;
    const yi = ya + ((yb - ya) * (i + 1)) / nz;
    zz.push(4.2 - op * 0.3, yo, 7.4, yi);
  }
  zz.push(22.4, 18.8);
  out.push(P(zz, 'mon2_bellowsHide', { bv: 0.5 }));
  for (let i = 1; i < nz; i++) {
    const yi = ya + ((yb - ya) * i) / nz;
    out.push(K(7.6, yi, 19.6, 16.4 + (yi - 16.6) * 0.18, 0.4, 0.2, 'mon2_bellowsHide', { ink: -0.38, ol: false }));
  }
  out.push(K(6.6, tb + 0.4, 2.4, tb - 1.2, 0.7, 0.6, 'wood'));
  out.push(P([6, tb - 0.4, 23, 13.2, 23.2, 14.6, 6.4, tb + 1.4], 'wood', { bv: 0.7 }));
  out.push(X(9, tb + 0.1, 0.6, 0.6, 'bronze:5'), X(13, tb + 0.3 + op * 0.3, 0.6, 0.6, 'bronze:5'), X(17, tb + 0.6 + op * 0.6, 0.6, 0.6, 'bronze:5'));
  // nozzle
  out.push(K(22.2, 16.4, 28.6, 17.8, 1.9, 0.9, 'bronze'), E(28.8, 17.9, 0.8, 0.95, 'blackIron'));
  out.push(K(22.2, 14.4, 22.4, 18.6, 0.7, 0.7, 'blackIron'));
  // firebox and ember grille
  const fl = [0, 0.08, -0.04, 0.06][f];
  out.push(P([11.4, 21.4, 20, 20.8, 19.6, 25.2, 11.8, 25.4], 'bronze', { bv: 0.7 }));
  out.push(P([12.6, 22, 18.8, 21.6, 18.6, 24.4, 12.8, 24.6], 'emFire', { ink: fl }));
  for (const x of [14, 15.6, 17.2]) out.push(K(x, 21.8, x, 24.6, 0.3, 0.3, 'blackIron'));
  out.push(X(14.4, 24, 2.4, 0.5, 'emFireCore:4'));
  // near leg
  out.push(limb([12.6, 22.4, 10.2, 24.6, 11.6, 27.6], 1.25, 0.85, 'bronze'));
  out.push(E(10.2, 24.6, 0.9, 0.9, 'iron'));
  out.push(claws(11.6, 27.8, 0, 1.7, 'bronze', 3, 0.42));
  out.push(Lt(15.8, 23, 9, '#ff8a2c', 0.9));
  return out;
}

/** Prismatic Mirror-Skulker: a crawler cut from glass and mirror. Its facets catch every light; the lens in front focuses sunlight into a beam. */
function mirror(f: number): PrimTree {
  const b = breath(f);
  const out: Out = [Sh(16, 28.6, 11, 2)];
  // a leg is two shards: thigh up to a sharp knee, shin down to a point
  const leg = (x0: number, y0: number, kx: number, ky: number, fx: number, ink: number): Prim[] => [
    P([x0, y0 - 0.6, kx, ky - 0.4, kx + 0.4 * Math.sign(kx - x0), ky + 0.6, x0, y0 + 0.7], 'mon2_mirror', { bv: 0.4, ink }),
    P([kx - 0.5, ky, kx + 0.5, ky, fx, 28.4], 'mon2_mirror', { bv: 0.3, ink }),
  ];
  out.push(leg(12, 19.6, 6.6, 14, 4, -0.18), leg(15, 20.4, 11.6, 14.6, 9.2, -0.18), leg(19.6, 20.4, 23.8, 14.2, 26.4, -0.18));
  // body: a cut gem, each facet its own normal
  out.push(P([7.6, 19.6, 10.4, 14.4, 16.4, 11.8, 22.6, 13.2, 25.4, 17.6, 23, 21.4, 15, 22.8, 9.4, 22], 'mon2_mirror', { bv: 0.6 }));
  out.push(P([10.4, 14.4, 16.4, 11.8, 22.6, 13.2, 19.6, 16, 13, 16.6], 'mon2_mirror', { n: [-0.35, -0.7, 0.62] }));
  out.push(P([7.6, 19.6, 10.4, 14.4, 13, 16.6], 'mon2_mirror', { n: [-0.8, -0.1, 0.6] }));
  out.push(P([7.6, 19.6, 13, 16.6, 19.6, 16, 23, 21.4, 15, 22.8, 9.4, 22], 'mon2_mirror', { n: [0.15, 0.45, 0.88] }));
  out.push(P([22.6, 13.2, 25.4, 17.6, 23, 21.4, 19.6, 16], 'mon2_glass', { n: [0.6, -0.1, 0.8] }));
  // crystal spines
  out.push(spike(13.4, 14.6, 1.8, -1.2, -6.2, 'mon2_glass', { bv: 0.4 }), spike(16.8, 12.6, 2, 0.2, -6.4, 'mon2_glass', { bv: 0.4 }), spike(20.2, 13.4, 1.6, 1.2, -4.4, 'mon2_glass', { bv: 0.4 }), spike(10.8, 15.6, 1.4, -1.8, -3.4, 'mon2_glass', { bv: 0.3 }));
  // near legs
  out.push(leg(10.6, 21.2, 5.8, 17.6, 2.6, 0), leg(17.4, 21.6, 15.6, 17.4, 14, 0), leg(21.4, 20.6, 27.2, 16.4, 29.6, 0));
  // the sun lens
  out.push(E(23.6, 17.6, 2.7, 2.7, 'mon2_mirror', { fl: 0.3 }), E(23.8, 17.5, 2, 2, 'mon2_glass', { fl: 0.2 }));
  out.push(E(24, 17.4, 1.2 + b * 0.15, 1.2 + b * 0.15, 'mon2_sun'), X(24.2, 16.8, 0.6, 0.6, '#ffffff', { em: true }));
  // prismatic glints wander the edges
  const pc = ['#ff9ae8', '#9af0ff', '#fff59a', '#ffffff'];
  const spots = [[12.2, 8.6], [17, 6.4], [21.4, 9.2], [16.4, 11.8], [9.4, 12.4], [25.2, 15.4]];
  for (let i = 0; i < 3; i++) {
    const s = spots[(i * 2 + f) % spots.length];
    out.push(X(s[0], s[1], 0.6, 0.6, pc[(i + f) % 4], { em: true }));
  }
  out.push(Lt(24, 17.4, 8, '#fff1ba', 0.8));
  return out;
}

/** Made things: each construct is the tool it was made from, walking. Kinds: `husk` (a banded trunk with a pick), `bellows`, `mirror` (a cut gem with a lens). */
export function constructModel(f: number, v: FamilyVariant): PrimTree {
  switch (v.kind) {
    case 'bellows': return bellows(f);
    case 'mirror': return mirror(f);
    default: return barkhusk(f);
  }
}
