import type { SpriteRecipe } from '../../../engine';
import { COTW_ITEM_SPRITES } from './items';
import { COTW_MONSTER_SPRITES } from './monsters';

/**
 * UI icons (`ui~<name>`, the vocabulary in src/ui/icons.ts): the pixel art the HUD,
 * dialogs and title screen show in place of emoji. Drawn on the same 32x32 grid as every
 * other sprite; a few reuse item and hero art.
 */

const C = {
  ink: '#1e293b',
  iron: '#334155',
  steelDark: '#64748b',
  steel: '#cbd5e1',
  white: '#f8fafc',
  bone: '#e7e5e4',
  wood: '#92400e',
  woodDark: '#78350f',
  gold: '#f59e0b',
  goldLight: '#fcd34d',
  parch: '#fde68a',
  parchDark: '#d97706',
  red: '#ef4444',
  redDark: '#991b1b',
  green: '#22c55e',
  greenDark: '#15803d',
  blue: '#38bdf8',
  blueDark: '#0369a1',
  violet: '#a855f7',
  violetDark: '#581c87',
  ember: '#fb923c',
};

/** The canvas a recipe draws on, as `SpriteRecipe` types it. */
type Ctx = Parameters<SpriteRecipe>[0];

/** Rectangles in recipe space, offset to the cell. */
function pen(ctx: Ctx, ox: number, oy: number) {
  return (color: string, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
}

function circle(ctx: Ctx, ox: number, oy: number, color: string, x: number, y: number, r: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ox + x, oy + y, r, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx: Ctx, ox: number, oy: number, color: string, points: Array<[number, number]>): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(ox + x, oy + y) : ctx.lineTo(ox + x, oy + y)));
  ctx.closePath();
  ctx.fill();
}

/** A disc with a light rim, the base of the four notice icons. */
function badge(ctx: Ctx, ox: number, oy: number, fill: string, rim: string): void {
  circle(ctx, ox, oy, rim, 16, 16, 13);
  circle(ctx, ox, oy, fill, 16, 16, 11);
}

/** A sheet of parchment with a curled lower edge. */
function sheet(ctx: Ctx, ox: number, oy: number, x: number, y: number, w: number, h: number): void {
  const r = pen(ctx, ox, oy);
  r(C.parchDark, x, y, w, h);
  r(C.parch, x + 1, y + 1, w - 2, h - 2);
  r(C.parchDark, x + 3, y + 4, w - 6, 1);
  r(C.parchDark, x + 3, y + 7, w - 8, 1);
  r(C.parchDark, x + 3, y + 10, w - 6, 1);
}

/** A blade from (x1,y1) hilt end to (x2,y2) point, with a cross-guard. */
function sword(ctx: Ctx, ox: number, oy: number, x1: number, y1: number, x2: number, y2: number): void {
  ctx.save();
  ctx.lineCap = 'square';
  ctx.strokeStyle = C.steel;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + x1 + (x2 - x1) * 0.25, oy + y1 + (y2 - y1) * 0.25);
  ctx.lineTo(ox + x2, oy + y2);
  ctx.stroke();
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + x1, oy + y1);
  ctx.lineTo(ox + x1 + (x2 - x1) * 0.22, oy + y1 + (y2 - y1) * 0.22);
  ctx.stroke();
  // Guard, across the blade.
  const gx = ox + x1 + (x2 - x1) * 0.25;
  const gy = oy + y1 + (y2 - y1) * 0.25;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx - nx * 5, gy - ny * 5);
  ctx.lineTo(gx + nx * 5, gy + ny * 5);
  ctx.stroke();
  ctx.restore();
}

function arrow(ctx: Ctx, ox: number, oy: number, color: string, dir: 'up' | 'down' | 'left', cx: number, cy: number): void {
  const r = pen(ctx, ox, oy);
  if (dir === 'down') {
    r(color, cx - 2, cy - 9, 5, 9);
    poly(ctx, ox, oy, color, [[cx - 7, cy], [cx + 8, cy], [cx + 0.5, cy + 8]]);
  } else if (dir === 'up') {
    r(color, cx - 2, cy, 5, 9);
    poly(ctx, ox, oy, color, [[cx - 7, cy], [cx + 8, cy], [cx + 0.5, cy - 8]]);
  } else {
    r(color, cx, cy - 2, 9, 5);
    poly(ctx, ox, oy, color, [[cx, cy - 7], [cx, cy + 8], [cx - 8, cy + 0.5]]);
  }
}

export const COTW_UI_ICONS: Record<string, SpriteRecipe> = {
  // ---- HUD bars -------------------------------------------------------------------------

  'ui~bestiary': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.woodDark, 7, 5, 19, 23);
    r(C.wood, 9, 5, 17, 21);
    r(C.bone, 9, 26, 17, 2);
    r(C.goldLight, 7, 5, 2, 23);
    // A claw's three scratches across the cover.
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2;
    for (const dx of [0, 4, 8]) {
      ctx.beginPath();
      ctx.moveTo(ox + 12 + dx, oy + 9);
      ctx.lineTo(ox + 16 + dx, oy + 21);
      ctx.stroke();
    }
    ctx.restore();
  },

  'ui~commands': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.steelDark, 3, 9, 26, 15);
    r(C.iron, 4, 10, 24, 13);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col > 0 && col < 4) continue;
        r(C.steel, 6 + col * 4 + (row === 1 ? 1 : 0), 12 + row * 4, 3, 2);
      }
    }
    r(C.steel, 10, 20, 12, 2);
  },

  'ui~help': (ctx, ox, oy) => {
    badge(ctx, ox, oy, C.blueDark, C.blue);
    const r = pen(ctx, ox, oy);
    r(C.white, 12, 9, 8, 2);
    r(C.white, 18, 10, 3, 5);
    r(C.white, 15, 14, 4, 2);
    r(C.white, 15, 15, 3, 4);
    r(C.white, 15, 21, 3, 3);
  },

  'ui~feedback': (ctx, ox, oy) => {
    // A quill over a sheet: writing to the makers.
    sheet(ctx, ox, oy, 5, 9, 16, 18);
    ctx.save();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox + 27, oy + 4);
    ctx.lineTo(ox + 17, oy + 18);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + 17, oy + 18);
    ctx.lineTo(ox + 14, oy + 23);
    ctx.stroke();
    ctx.restore();
  },

  'ui~tools': (ctx, ox, oy) => {
    ctx.save();
    ctx.translate(ox + 16, oy + 16);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = C.wood;
    ctx.fillRect(-2, -4, 4, 17);
    ctx.fillStyle = C.steelDark;
    ctx.fillRect(-8, -11, 16, 7);
    ctx.fillStyle = C.steel;
    ctx.fillRect(-8, -11, 16, 2);
    ctx.restore();
  },

  'ui~inventory': COTW_ITEM_SPRITES.backpack,

  'ui~cast': (ctx, ox, oy) => {
    poly(ctx, ox, oy, C.goldLight, [[19, 2], [7, 18], [15, 18], [11, 30], [25, 12], [17, 12]]);
    poly(ctx, ox, oy, C.gold, [[17, 12], [25, 12], [11, 30], [14, 18]]);
  },

  'ui~look': (ctx, ox, oy) => {
    ctx.save();
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 16, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    circle(ctx, ox, oy, C.blueDark, 16, 16, 6);
    circle(ctx, ox, oy, C.ink, 16, 16, 3);
    pen(ctx, ox, oy)(C.white, 17, 13, 2, 2);
  },

  'ui~map': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    poly(ctx, ox, oy, C.parchDark, [[3, 7], [11, 4], [21, 7], [29, 4], [29, 25], [21, 28], [11, 25], [3, 28]]);
    poly(ctx, ox, oy, C.parch, [[5, 8], [11, 6], [21, 9], [27, 6], [27, 24], [21, 26], [11, 23], [5, 26]]);
    for (const [x, y] of [[8, 21], [11, 18], [14, 16], [17, 14]] as Array<[number, number]>) r(C.woodDark, x, y, 2, 2);
    ctx.save();
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + 19, oy + 9);
    ctx.lineTo(ox + 24, oy + 14);
    ctx.moveTo(ox + 24, oy + 9);
    ctx.lineTo(ox + 19, oy + 14);
    ctx.stroke();
    ctx.restore();
  },

  'ui~rest': (ctx, ox, oy) => {
    // A crescent moon and a "z".
    circle(ctx, ox, oy, C.goldLight, 12, 17, 9);
    circle(ctx, ox, oy, C.ink, 16, 14, 8);
    const r = pen(ctx, ox, oy);
    r(C.blue, 19, 5, 9, 2);
    poly(ctx, ox, oy, C.blue, [[26, 7], [28, 7], [21, 14], [19, 14]]);
    r(C.blue, 19, 14, 9, 2);
  },

  'ui~wait': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.wood, 7, 3, 18, 3);
    r(C.wood, 7, 26, 18, 3);
    poly(ctx, ox, oy, C.steel, [[9, 6], [23, 6], [17, 16], [23, 26], [9, 26], [15, 16]]);
    poly(ctx, ox, oy, C.gold, [[12, 9], [20, 9], [16, 15]]);
    poly(ctx, ox, oy, C.gold, [[11, 25], [21, 25], [16, 19]]);
  },

  'ui~search': (ctx, ox, oy) => {
    ctx.save();
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox + 19, oy + 19);
    ctx.lineTo(ox + 27, oy + 27);
    ctx.stroke();
    ctx.restore();
    circle(ctx, ox, oy, C.steel, 13, 13, 10);
    circle(ctx, ox, oy, C.blueDark, 13, 13, 7);
    pen(ctx, ox, oy)(C.blue, 9, 9, 3, 3);
  },

  'ui~stairs': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    for (let i = 0; i < 4; i++) {
      r(C.steelDark, 4 + i * 6, 6 + i * 5, 24 - i * 6, 5);
      r(C.steel, 4 + i * 6, 6 + i * 5, 24 - i * 6, 1);
    }
    r(C.iron, 4, 26, 24, 2);
  },

  // ---- The context action, tray chips and the ground line --------------------------------

  'ui~attack': (ctx, ox, oy) => {
    sword(ctx, ox, oy, 6, 27, 26, 5);
    sword(ctx, ox, oy, 26, 27, 6, 5);
  },

  'ui~loot': COTW_ITEM_SPRITES.gold_coins,
  'ui~chest': COTW_ITEM_SPRITES.chest,

  'ui~talk': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.steel, 4, 6, 24, 15);
    r(C.white, 5, 7, 22, 13);
    poly(ctx, ox, oy, C.white, [[9, 20], [16, 20], [8, 27]]);
    for (const x of [10, 15, 20]) r(C.iron, x, 12, 3, 3);
  },

  'ui~door': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.iron, 7, 7, 18, 22);
    circle(ctx, ox, oy, C.iron, 16, 9, 9);
    r(C.wood, 9, 9, 14, 20);
    circle(ctx, ox, oy, C.wood, 16, 10, 7);
    r(C.woodDark, 15, 4, 2, 25);
    r(C.steelDark, 9, 12, 14, 2);
    r(C.steelDark, 9, 22, 14, 2);
    r(C.gold, 19, 17, 2, 3);
  },

  'ui~rune': COTW_ITEM_SPRITES.rune_stone,

  'ui~debt': (ctx, ox, oy) => {
    // A violet void-eye: what overcasting owes.
    ctx.save();
    ctx.fillStyle = C.violetDark;
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 16, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 16, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(ox + 16, oy + 16, 2.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    pen(ctx, ox, oy)(C.white, 19, 12, 2, 2);
  },

  'ui~pact': (ctx, ox, oy) => {
    poly(ctx, ox, oy, C.redDark, [[16, 3], [7, 19], [25, 19]]);
    circle(ctx, ox, oy, C.redDark, 16, 20, 9);
    poly(ctx, ox, oy, C.red, [[16, 6], [9, 19], [23, 19]]);
    circle(ctx, ox, oy, C.red, 16, 20, 7);
    pen(ctx, ox, oy)(C.white, 12, 18, 2, 4);
  },

  'ui~location': (ctx, ox, oy) => {
    poly(ctx, ox, oy, C.redDark, [[8, 14], [24, 14], [16, 30]]);
    circle(ctx, ox, oy, C.red, 16, 12, 9);
    circle(ctx, ox, oy, C.white, 16, 12, 3);
  },

  'ui~retreat': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    arrow(ctx, ox, oy, C.steel, 'left', 14, 16);
    r(C.steelDark, 24, 9, 5, 2);
    r(C.steelDark, 22, 15, 7, 3);
    r(C.steelDark, 24, 22, 5, 2);
  },

  'ui~shield': (ctx, ox, oy) => {
    poly(ctx, ox, oy, C.steelDark, [[5, 4], [27, 4], [27, 15], [16, 30], [5, 15]]);
    poly(ctx, ox, oy, C.blueDark, [[8, 7], [24, 7], [24, 15], [16, 26], [8, 15]]);
    const r = pen(ctx, ox, oy);
    r(C.gold, 15, 7, 3, 18);
    r(C.gold, 8, 13, 16, 3);
  },

  // ---- Status and notices -----------------------------------------------------------------

  'ui~info': (ctx, ox, oy) => {
    badge(ctx, ox, oy, C.blueDark, C.blue);
    const r = pen(ctx, ox, oy);
    r(C.white, 15, 8, 3, 3);
    r(C.white, 13, 13, 5, 2);
    r(C.white, 15, 13, 3, 10);
    r(C.white, 13, 22, 7, 2);
  },

  'ui~success': (ctx, ox, oy) => {
    badge(ctx, ox, oy, C.greenDark, C.green);
    ctx.save();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(ox + 10, oy + 16);
    ctx.lineTo(ox + 14, oy + 20);
    ctx.lineTo(ox + 22, oy + 11);
    ctx.stroke();
    ctx.restore();
  },

  'ui~warning': (ctx, ox, oy) => {
    poly(ctx, ox, oy, C.parchDark, [[16, 2], [30, 28], [2, 28]]);
    poly(ctx, ox, oy, C.gold, [[16, 6], [27, 26], [5, 26]]);
    const r = pen(ctx, ox, oy);
    r(C.ink, 15, 11, 3, 8);
    r(C.ink, 15, 21, 3, 3);
  },

  'ui~error': (ctx, ox, oy) => {
    badge(ctx, ox, oy, C.redDark, C.red);
    ctx.save();
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox + 11, oy + 11);
    ctx.lineTo(ox + 21, oy + 21);
    ctx.moveTo(ox + 21, oy + 11);
    ctx.lineTo(ox + 11, oy + 21);
    ctx.stroke();
    ctx.restore();
  },

  // ---- Saves, the title screen and the end of a run ------------------------------------------

  'ui~save': (ctx, ox, oy) => {
    // A rolled record, sealed in wax.
    const r = pen(ctx, ox, oy);
    r(C.parchDark, 5, 9, 22, 14);
    r(C.parch, 6, 10, 20, 12);
    r(C.parchDark, 4, 8, 3, 16);
    r(C.parchDark, 25, 8, 3, 16);
    r(C.red, 6, 15, 20, 2);
    circle(ctx, ox, oy, C.redDark, 16, 16, 5);
    circle(ctx, ox, oy, C.red, 16, 16, 3);
  },

  'ui~load': (ctx, ox, oy) => {
    // An open book.
    const r = pen(ctx, ox, oy);
    poly(ctx, ox, oy, C.woodDark, [[2, 9], [16, 11], [30, 9], [30, 26], [16, 28], [2, 26]]);
    poly(ctx, ox, oy, C.parch, [[4, 8], [15, 10], [15, 25], [4, 23]]);
    poly(ctx, ox, oy, C.parch, [[17, 10], [28, 8], [28, 23], [17, 25]]);
    for (const y of [13, 16, 19]) {
      r(C.parchDark, 6, y, 7, 1);
      r(C.parchDark, 19, y, 7, 1);
    }
  },

  'ui~delete': (ctx, ox, oy) => {
    // A flame: the record burns.
    poly(ctx, ox, oy, C.redDark, [[16, 2], [26, 16], [24, 26], [16, 30], [8, 26], [6, 16], [11, 11]]);
    poly(ctx, ox, oy, C.ember, [[16, 7], [23, 17], [21, 25], [16, 28], [11, 25], [9, 18], [13, 14]]);
    poly(ctx, ox, oy, C.goldLight, [[16, 14], [20, 21], [16, 27], [12, 21]]);
  },

  'ui~autosave': (ctx, ox, oy) => {
    ctx.save();
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ox + 16, oy + 16, 10, Math.PI * 0.15, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
    poly(ctx, ox, oy, C.green, [[20, 3], [29, 10], [20, 14]]);
    poly(ctx, ox, oy, C.goldLight, [[17, 9], [12, 17], [16, 17], [14, 23], [20, 15], [16, 15]]);
  },

  'ui~clock': (ctx, ox, oy) => {
    circle(ctx, ox, oy, C.parchDark, 16, 16, 13);
    circle(ctx, ox, oy, C.parch, 16, 16, 11);
    const r = pen(ctx, ox, oy);
    r(C.ink, 15, 8, 2, 9);
    r(C.ink, 15, 15, 7, 2);
    for (const [x, y] of [[15, 6], [24, 15], [15, 24], [6, 15]] as Array<[number, number]>) r(C.woodDark, x, y, 2, 2);
  },

  'ui~import': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.wood, 4, 20, 24, 8);
    r(C.woodDark, 4, 20, 24, 2);
    arrow(ctx, ox, oy, C.gold, 'down', 15.5, 12);
  },

  'ui~share': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.wood, 4, 20, 24, 8);
    r(C.woodDark, 4, 20, 24, 2);
    arrow(ctx, ox, oy, C.blue, 'up', 15.5, 12);
  },

  'ui~copy': (ctx, ox, oy) => {
    sheet(ctx, ox, oy, 4, 3, 17, 20);
    sheet(ctx, ox, oy, 11, 9, 17, 20);
  },

  'ui~epitaph': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    r(C.iron, 4, 27, 24, 3);
    r(C.steelDark, 8, 11, 16, 17);
    circle(ctx, ox, oy, C.steelDark, 16, 12, 8);
    r(C.steel, 10, 12, 12, 14);
    circle(ctx, ox, oy, C.steel, 16, 12, 6);
    r(C.steelDark, 15, 8, 2, 12);
    r(C.steelDark, 12, 11, 8, 2);
  },

  'ui~trophy': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    poly(ctx, ox, oy, C.gold, [[8, 4], [24, 4], [22, 15], [16, 19], [10, 15]]);
    r(C.goldLight, 11, 5, 3, 8);
    ctx.save();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox + 8, oy + 9, 4, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(ox + 24, oy + 9, 4, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
    r(C.parchDark, 15, 18, 3, 5);
    r(C.gold, 10, 23, 13, 3);
    r(C.woodDark, 8, 26, 17, 3);
  },

  'ui~fallen': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    circle(ctx, ox, oy, C.bone, 16, 13, 10);
    r(C.bone, 10, 18, 12, 8);
    circle(ctx, ox, oy, C.ink, 12, 13, 3);
    circle(ctx, ox, oy, C.ink, 20, 13, 3);
    poly(ctx, ox, oy, C.ink, [[16, 16], [14, 20], [18, 20]]);
    for (const x of [12, 15, 18]) r(C.ink, x, 23, 2, 3);
  },

  // The paperdoll's figure (tracker 4.7): a standing body, drawn as one flat silhouette and
  // shown faint behind the equipment slots, so the slots read as worn on it.
  'ui~doll': (ctx, ox, oy) => {
    const r = pen(ctx, ox, oy);
    const body = C.steel;
    circle(ctx, ox, oy, body, 16, 4, 3.4); // head
    r(body, 15, 7, 2, 2); // neck
    poly(ctx, ox, oy, body, [[9, 9], [23, 9], [21, 19], [11, 19]]); // shoulders and chest
    poly(ctx, ox, oy, body, [[9, 9], [7, 10], [5, 19], [7, 19], [10, 12]]); // left arm
    poly(ctx, ox, oy, body, [[23, 9], [25, 10], [27, 19], [25, 19], [22, 12]]); // right arm
    r(body, 11, 19, 10, 3); // hips
    poly(ctx, ox, oy, body, [[11, 22], [15.5, 22], [15, 31], [12, 31]]); // left leg
    poly(ctx, ox, oy, body, [[16.5, 22], [21, 22], [20, 31], [17, 31]]); // right leg
  },

  'ui~hero': COTW_MONSTER_SPRITES.player,
  'ui~heroine': COTW_MONSTER_SPRITES.player_female,
};
