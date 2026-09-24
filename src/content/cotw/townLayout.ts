/**
 * Bjarnarhaven's ground plan (`TownLayoutDefinition.layout`), 56x36: a clearing in the pine
 * woods with an uneven edge, cobbled lanes that wind between the buildings, and a plaza
 * with a fountain. Built from shapes and a fixed seed, so it is the same every run.
 *
 * Legend: '#' rock or wall, '.' snow, ',' cobbled road, 'T' pine, 'F' fountain (2x2),
 * 'A' statue, 'H' hay cart, 'C' goods cart, 'O' barrels, 'L' woodpile, 'M' market stall,
 * '+'/"'" doors, '>' the cellar stairs.
 */
const W = 56;
const H = 36;

export const TOWN_LEGEND: Record<string, string> = {
  ',': 'town_road',
  T: 'town_pine',
  F: 'town_fountain',
  A: 'town_statue',
  H: 'town_hay_cart',
  C: 'town_goods_cart',
  O: 'town_barrels',
  L: 'town_woodpile',
  M: 'town_market_stall',
};

export interface TownBuildingPlan {
  name: string;
  buildingType: 'temple' | 'bank' | 'shop' | 'smithy' | 'house';
  bounds: { x1: number; y1: number; x2: number; y2: number };
  door: { x: number; y: number; isOpen?: boolean };
}

export const TOWN_BUILDINGS: TownBuildingPlan[] = [
  { name: "Olaf's General Store", buildingType: 'shop', bounds: { x1: 6, y1: 5, x2: 17, y2: 11 }, door: { x: 12, y: 11 } },
  { name: 'Longhouse', buildingType: 'house', bounds: { x1: 21, y1: 3, x2: 27, y2: 8 }, door: { x: 24, y: 8 } },
  { name: "Gunther's Armory", buildingType: 'smithy', bounds: { x1: 37, y1: 4, x2: 48, y2: 10 }, door: { x: 42, y: 10 } },
  { name: "Astrid's Alchemy", buildingType: 'shop', bounds: { x1: 5, y1: 23, x2: 14, y2: 30 }, door: { x: 10, y: 23 } },
  { name: 'Temple of Thor', buildingType: 'temple', bounds: { x1: 23, y1: 26, x2: 33, y2: 33 }, door: { x: 28, y: 26, isOpen: true } },
  { name: 'Sage Study & Vault', buildingType: 'bank', bounds: { x1: 39, y1: 22, x2: 50, y2: 29 }, door: { x: 44, y: 22 } },
];

export const TOWN_STAIRS_DOWN = { x: 31, y: 7 };
export const TOWN_PLAYER_SPAWN = { x: 19, y: 16 };
/** Where the victory portal returns the hero: the plaza, south-west of the fountain. */
export const TOWN_RETURN_POSITION = { x: 26, y: 20 };

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTown(): string[] {
  const rand = seeded(0x6a0dbeef);
  const g: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill('#'));
  const inside = (x: number, y: number) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const wobble = Array.from({ length: 72 }, () => 0.86 + rand() * 0.2);

  // The clearing: a rounded, uneven shape inside the woods.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const dx = (x - 27.5) / 29.5;
      const dy = (y - 17.5) / 19.5;
      const a = Math.atan2(dy, dx);
      const w = wobble[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 72) % 72];
      if (dx * dx + dy * dy < w * w) g[y][x] = '.';
    }
  }
  // Pines thicken toward the edge of the clearing, with a few groves inside.
  const dist = (x: number, y: number) => {
    let d = 9;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) if (g[y + oy]?.[x + ox] === '#') d = Math.min(d, Math.max(Math.abs(ox), Math.abs(oy)));
    return d;
  };
  const edge: Array<[number, number, number]> = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === '.') edge.push([x, y, dist(x, y)]);
  for (const [x, y, d] of edge) {
    const p = d === 1 ? 0.92 : d === 2 ? 0.62 : d === 3 ? 0.22 : 0;
    if (rand() < p) g[y][x] = 'T';
  }
  for (const [cx, cy] of [[4, 18], [51, 16], [34, 2], [18, 33], [52, 31], [3, 8]]) {
    for (let k = 0; k < 6; k++) {
      const x = cx + Math.round((rand() - 0.5) * 5);
      const y = cy + Math.round((rand() - 0.5) * 4);
      if (inside(x, y) && g[y][x] === '.') g[y][x] = 'T';
    }
  }

  // Buildings: walls, interiors, doors, and a clear yard around each.
  for (const b of TOWN_BUILDINGS) {
    const { x1, y1, x2, y2 } = b.bounds;
    for (let y = y1 - 1; y <= y2 + 1; y++) for (let x = x1 - 1; x <= x2 + 1; x++) if (inside(x, y)) g[y][x] = '.';
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = y === y1 || y === y2 || x === x1 || x === x2 ? '#' : '.';
    g[b.door.y][b.door.x] = b.door.isOpen ? "'" : '+';
  }

  // Cobbled lanes: a winding main street, a round plaza, and a lane to every door.
  const road = (x: number, y: number) => {
    if (inside(x, y) && (g[y][x] === '.' || g[y][x] === 'T')) g[y][x] = ',';
  };
  for (let x = 2; x < W - 2; x++) {
    const y = 15 + Math.round(Math.sin(x * 0.17 + 0.6) * 1.6);
    road(x, y);
    road(x, y + 1);
  }
  for (let y = 12; y <= 23; y++) for (let x = 21; x <= 35; x++) if (((x - 28.5) / 6.5) ** 2 + ((y - 18.5) / 4.6) ** 2 < 1) road(x, y);
  const lane = (x: number, fromY: number, toY: number) => {
    for (let y = Math.min(fromY, toY); y <= Math.max(fromY, toY); y++) road(x, y);
  };
  const mainY = (x: number) => 15 + Math.round(Math.sin(x * 0.17 + 0.6) * 1.6);
  for (const b of TOWN_BUILDINGS) {
    const outY = b.door.y === b.bounds.y2 ? b.door.y + 1 : b.door.y - 1;
    lane(b.door.x, outY, mainY(b.door.x) + (outY > mainY(b.door.x) ? 1 : 0));
  }
  lane(TOWN_STAIRS_DOWN.x, TOWN_STAIRS_DOWN.y + 1, mainY(TOWN_STAIRS_DOWN.x));
  for (let x = TOWN_STAIRS_DOWN.x - 1; x <= TOWN_STAIRS_DOWN.x + 1; x++) for (let y = TOWN_STAIRS_DOWN.y - 1; y <= TOWN_STAIRS_DOWN.y + 1; y++) road(x, y);
  g[TOWN_STAIRS_DOWN.y][TOWN_STAIRS_DOWN.x] = '>';

  // The plaza's fountain (2x2 on even coordinates, so its quadrants line up) and the town's things.
  for (const [x, y] of [[28, 18], [29, 18], [28, 19], [29, 19]]) g[y][x] = 'F';
  const place = (ch: string, x: number, y: number) => {
    if (inside(x, y) && (g[y][x] === '.' || g[y][x] === ',')) g[y][x] = ch;
  };
  place('A', 25, 24); // statues flank the temple approach
  place('A', 31, 24);
  place('M', 22, 19); // market stalls on the plaza's rim
  place('M', 34, 17);
  place('C', 19, 13); // a goods cart outside Olaf's
  place('H', 36, 13); // a hay cart by the smithy
  place('O', 5, 13);
  place('O', 49, 12);
  place('O', 51, 24);
  place('L', 20, 6); // the longhouse woodpile
  place('L', 36, 7);

  // Anything the lanes don't reach becomes woods, so every open cell is walkable to.
  const seen = new Set<number>();
  const walk = [TOWN_PLAYER_SPAWN];
  seen.add(TOWN_PLAYER_SPAWN.y * W + TOWN_PLAYER_SPAWN.x);
  const open = (c: string) => c === '.' || c === ',' || c === '+' || c === "'" || c === '>';
  while (walk.length > 0) {
    const p = walk.pop()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!inside(x, y) || seen.has(y * W + x) || !open(g[y][x])) continue;
      seen.add(y * W + x);
      walk.push({ x, y });
    }
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if ((g[y][x] === '.' || g[y][x] === ',') && !seen.has(y * W + x)) g[y][x] = 'T';
  return g.map((row) => row.join(''));
}

export const TOWN_ROWS: string[] = buildTown();
export const TOWN_WIDTH = W;
export const TOWN_HEIGHT = H;
