/**
 * The Heartwood: Níðhögg's lair (`bossFloorLayout.layout`), 57x40. A root-choked gallery
 * leads north into a round hollow; flanking passages loop around it; rot pools and
 * heartwood pillars give cover; the boss waits on a dais across a pit, reached by a root
 * bridge. Built from shapes rather than typed out, but fixed: the same every run.
 */
const W = 57;
const H = 40;
const CX = 28;

export const LAIR_BOSS_SPAWN = { x: CX, y: 4 };
export const LAIR_PLAYER_SPAWN = { x: CX, y: 35 };
export const LAIR_STAIRS_UP = { x: CX, y: 36 };

function buildHeartwood(): string[] {
  const g: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill('#'));
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (inEllipse(x, y, CX, 18, 19, 11) || inEllipse(x, y, CX, 4, 6, 2.4)) g[y][x] = '.';
    }
  }
  // The pit under the dais, and the root bridge across it.
  for (let y = 6; y <= 13; y++) for (let x = CX - 5; x <= CX + 5; x++) if (inEllipse(x, y, CX, 9.5, 4, 1.8)) g[y][x] = 'X';
  for (let y = 5; y <= 12; y++) for (let x = CX - 1; x <= CX + 1; x++) g[y][x] = '.';
  // Heartwood pillars.
  for (const [x, y] of [[17, 16], [17, 22], [39, 16], [39, 22], [22, 27], [34, 27]]) g[y][x] = 'P';
  // Rot pools.
  for (const [cx, cy] of [[12, 15], [44, 15], [14, 23], [42, 23]]) {
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) if (inEllipse(x, y, cx, cy, 2.4, 1.4)) g[y][x] = '~';
  }
  // The approach gallery, narrowed by stalks.
  for (let y = 29; y <= 36; y++) for (let x = CX - 5; x <= CX + 5; x++) g[y][x] = '.';
  for (const [x, y] of [[CX - 4, 31], [CX + 4, 31], [CX - 4, 34], [CX + 4, 34]]) g[y][x] = 'P';
  // Flanking passages loop from the gallery into the hollow's sides.
  for (let x = 13; x <= CX - 5; x++) g[35][x] = '.';
  for (let y = 24; y <= 35; y++) g[y][13] = '.';
  for (let x = CX + 5; x <= W - 14; x++) g[35][x] = '.';
  for (let y = 24; y <= 35; y++) g[y][W - 14] = '.';
  return g.map((row) => row.join(''));
}

export const HEARTWOOD_LAIR: string[] = buildHeartwood();
export const LAIR_WIDTH = W;
export const LAIR_HEIGHT = H;
