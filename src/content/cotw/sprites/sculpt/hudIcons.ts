import { E, K, P, X, Lt, type PrimTree } from './kit';
import './materials';

/*
 * The HUD's own drawings of four things the map also draws: the backpack, coins, the chest and
 * the Rune of Return. The header shows an icon at about 15 px, where a map sprite (an object
 * drawn across half its cell) smears; these fill the cell with a few bold parts and are baked
 * at 16 px (uiIcons.ts), so every part is two pixels or more.
 */

/** A rucksack from the front: carrying loop, buckled flap, a pocket below. */
export function hudPackModel(): PrimTree {
  return [
    K(12.5, 8, 12.5, 4, 1.3, 1.3, 'leatherDark'),
    K(12.5, 4, 19.5, 4, 1.3, 1.3, 'leatherDark'),
    K(19.5, 4, 19.5, 8, 1.3, 1.3, 'leatherDark'),
    P([10, 7.5, 22, 7.5, 25.5, 11, 26, 26, 23, 29, 9, 29, 6, 26, 6.5, 11], 'leather', { bv: 3 }),
    P([7, 9.5, 25, 9.5, 25, 17, 16, 20, 7, 17], 'leatherDark', { bv: 2 }),
    P([10.5, 21.5, 21.5, 21.5, 21.5, 27, 10.5, 27], 'leatherDark', { bv: 1.2 }),
    E(16, 18, 2.2, 2.2, 'gold', { fl: 0.6 }),
  ];
}

/** A stack of coins edge-on beside one standing face-up, gold. */
export function hudCoinsModel(): PrimTree {
  const stack: PrimTree[number][] = [];
  for (const y of [25, 19.5, 14]) {
    stack.push(E(8.5, y + 2, 5.5, 2.6, 'gold', { ink: -0.5, fl: 0.3 }), E(8.5, y, 5.5, 2.6, 'gold', { fl: 0.85 }));
  }
  return [
    stack,
    E(21.5, 17.5, 8, 8.5, 'gold', { fl: 0.7 }),
    E(21.5, 17.5, 4.6, 5, 'gold', { fl: 1, ink: -0.4, ol: false, occ: false }),
    K(21.5, 14.5, 21.5, 20.5, 1.2, 1.2, 'gold', { ink: 0.25, ol: false, occ: false }),
  ];
}

/** A shut chest, square to the viewer: barrel lid, two iron bands, a gold lock. */
export function hudChestModel(): PrimTree {
  return [
    P([3.5, 15, 28.5, 15, 28.5, 28, 3.5, 28], 'wood', { bv: 1.5 }),
    P([3.5, 15.5, 3.5, 10.5, 7, 6.5, 25, 6.5, 28.5, 10.5, 28.5, 15.5], 'wood', { bv: 2.6 }),
    K(3.5, 15.2, 28.5, 15.2, 1.1, 1.1, 'iron'),
    K(9, 7, 9, 28, 1.4, 1.4, 'iron'),
    K(23, 7, 23, 28, 1.4, 1.4, 'iron'),
    P([13, 13, 19, 13, 19, 21, 16, 22.5, 13, 21], 'gold', { bv: 1 }),
    X(15.2, 16.2, 1.6, 3, 'stoneDark:0'),
  ];
}

/** The Rune of Return: a rounded standing stone, Raidho cut deep and glowing. */
export function hudRuneModel(): PrimTree {
  const groove = (x1: number, y1: number, x2: number, y2: number) => [
    K(x1, y1, x2, y2, 2.1, 2.1, 'stoneDark', { ink: -0.25, occ: false, ol: false }),
    K(x1, y1, x2, y2, 1.1, 1.1, 'emArcane', { ink: 0.25, occ: false, ol: false }),
  ];
  const stone: number[] = [];
  const jit = [0, 0.5, -0.4, 0.6, -0.3, 0.4, -0.5, 0.3, 0.6, -0.4, 0.3, -0.3];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * 2 * Math.PI - Math.PI / 2;
    stone.push(16 + (9.5 + jit[i]) * Math.cos(t), 16.5 + (12.5 + jit[(i + 3) % 12] * 0.6) * Math.sin(t));
  }
  return [
    P(stone, 'item_slab', { bv: 3.5 }),
    groove(13, 8.5, 13, 24.5),
    groove(13, 8.5, 19, 11.5),
    groove(19, 11.5, 13.5, 16),
    groove(14.5, 16, 19.5, 24),
    Lt(15.5, 16, 9, '#6aa6ff', 0.6),
  ];
}
