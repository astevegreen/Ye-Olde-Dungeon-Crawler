import { describe, it, expect } from 'vitest';
import { DungeonGeneratorRegistry, BspDungeonGenerator, type DungeonGenParams, type GeneratedFloorData } from '../generator';
import { LayoutStrategy } from '../layout/layoutStrategy';
import { draftCaverns, draftHalls, draftRift, draftLattice, draftWarrens, draftSpine } from '../layout/drafts';
import { COTW_VAULTS } from '../../../content/cotw/vaults';
import type { GameMap } from '../../grid/map';

/**
 * Property tests for the character-grid layouts (ARCHITECTURE.md §3, `layout/`): across
 * many seeds and every strategy, a floor is always playable and always the same for a seed.
 */
const SIZE = { width: 57, height: 40 };
const SEEDS = 60;

const DRAFTS = {
  caverns: draftCaverns,
  halls: draftHalls,
  rift: draftRift,
  lattice: draftLattice,
  warrens: draftWarrens,
  spine: draftSpine,
};

/** A threshold room using every layout character: pillars, a barred gate with a door, a chasm, two exits. */
const GATEHOUSE = [
  '#############',
  '#P....@....P#',
  '#...........#',
  '#XX.......XX#',
  '#####B+B#####',
  '#...........#',
  '.....~~~.....',
  '#############',
];
const THRESHOLD_TILE: Record<string, string> = {
  '#': 'wall',
  '.': 'floor',
  '@': 'floor',
  P: 'pillar',
  B: 'iron_bars',
  '+': 'door_closed',
  "'": 'door_open',
  '~': 'shallow_water',
  X: 'chasm',
};

const CASES: Array<{
  strategy: keyof typeof DRAFTS;
  params: Record<string, unknown>;
  floor: number;
  forcedVaultId?: string;
  threshold?: string[];
}> = [
  { strategy: 'caverns', params: { lake: true }, floor: 3 },
  { strategy: 'caverns', params: { lake: true }, floor: 5, forcedVaultId: 'floor5_rune_vault' },
  { strategy: 'caverns', params: { wallChance: 0.42, pools: 3, pits: 2, groves: 3 }, floor: 40 },
  { strategy: 'halls', params: { centralPit: true, randomVaults: false }, floor: 12 },
  { strategy: 'rift', params: { bridges: 3 }, floor: 20 },
  { strategy: 'rift', params: { bridges: 3 }, floor: 22, forcedVaultId: 'siphon_altar_vault' },
  { strategy: 'lattice', params: { sump: true }, floor: 28 },
  { strategy: 'warrens', params: { grove: true }, floor: 36 },
  { strategy: 'spine', params: { pool: true, pits: 2 }, floor: 44 },
  { strategy: 'spine', params: { pool: true, pits: 2 }, floor: 45, forcedVaultId: 'floor45_fang_vault' },
  // A band's first floor opens in its threshold room.
  { strategy: 'caverns', params: { lake: true }, floor: 1, threshold: GATEHOUSE },
  { strategy: 'halls', params: { centralPit: true, randomVaults: false }, floor: 10, threshold: GATEHOUSE },
  { strategy: 'rift', params: { bridges: 3 }, floor: 18, threshold: GATEHOUSE },
  { strategy: 'rift', params: { bridges: 3 }, floor: 22, forcedVaultId: 'siphon_altar_vault', threshold: GATEHOUSE },
  { strategy: 'lattice', params: { sump: true }, floor: 26, threshold: GATEHOUSE },
  { strategy: 'warrens', params: { grove: true }, floor: 34, threshold: GATEHOUSE },
  { strategy: 'spine', params: { pool: true, pits: 2 }, floor: 43, threshold: GATEHOUSE },
  { strategy: 'caverns', params: { wallChance: 0.42, pools: 3, pits: 2, groves: 3 }, floor: 50, threshold: GATEHOUSE },
];

function params(c: (typeof CASES)[number], seed: number): DungeonGenParams {
  return {
    ...SIZE,
    seed,
    floorNumber: c.floor,
    vaults: COTW_VAULTS,
    forcedVaultId: c.forcedVaultId,
    layoutParams: c.params,
    threshold: c.threshold ? { layout: c.threshold } : undefined,
  };
}

function strategyFor(id: keyof typeof DRAFTS, onFallback: () => void): LayoutStrategy {
  return new LayoutStrategy(id, id, DRAFTS[id], (p) => {
    onFallback();
    return new BspDungeonGenerator().generate(p);
  });
}

/** 4-connected flood over tiles a walker can cross; closed doors open, secret doors only when asked. */
function reachable(map: GameMap, from: { x: number; y: number }, secretsOpen: boolean): Set<string> {
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !map.inBounds(nx, ny)) continue;
      const t = map.getTile(nx, ny);
      if (!t) continue;
      if (t.passable || t.type === 'door_closed' || (secretsOpen && t.type === 'secret_door')) {
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

function tileTypes(r: GeneratedFloorData): string {
  const rows: string[] = [];
  for (let y = 0; y < r.map.height; y++) {
    let row = '';
    for (let x = 0; x < r.map.width; x++) row += r.map.getTile(x, y)?.type.slice(0, 2) ?? '??';
    rows.push(row);
  }
  return rows.join('\n');
}

describe('Character-grid layout strategies', () => {
  it('registers every strategy', () => {
    for (const id of Object.keys(DRAFTS)) expect(DungeonGeneratorRegistry.get(id)).toBeDefined();
  });

  for (const c of CASES) {
    const label = `${c.strategy} (floor ${c.floor}${c.forcedVaultId ? `, forced ${c.forcedVaultId}` : ''}${c.threshold ? ', threshold' : ''})`;

    it(`${label}: playable on every seed`, () => {
      let fallbacks = 0;
      let fellBack = false;
      const strategy = strategyFor(c.strategy, () => {
        fallbacks++;
        fellBack = true;
      });
      for (let seed = 1; seed <= SEEDS; seed++) {
        fellBack = false;
        const r = strategy.generate(params(c, seed * 7919));
        const where = `seed ${seed * 7919}`;
        const spawnTile = r.map.getTile(r.playerSpawn.x, r.playerSpawn.y);
        expect(spawnTile?.type, `${where}: spawn on ${spawnTile?.type}`).toBe('floor');

        const open = reachable(r.map, r.playerSpawn, false);
        expect(open.has(`${r.stairsDown.x},${r.stairsDown.y}`), `${where}: stairs unreachable`).toBe(true);
        if (fellBack) continue; // rooms and corridors has its own tests

        const vaults = r.vaultRects ?? [];
        const inVault = (x: number, y: number) => vaults.some((v) => x >= v.x1 && x <= v.x2 && y >= v.y1 && y <= v.y2);
        expect(inVault(r.playerSpawn.x, r.playerSpawn.y), `${where}: spawned in a vault`).toBe(false);
        expect(inVault(r.stairsDown.x, r.stairsDown.y), `${where}: stairs in a vault`).toBe(false);

        // No sealed regions: every walkable tile outside a vault's authored interior is
        // reachable once secret doors open, and every vault can be entered.
        const all = reachable(r.map, r.playerSpawn, true);
        for (let y = 0; y < r.map.height; y++) {
          for (let x = 0; x < r.map.width; x++) {
            const t = r.map.getTile(x, y);
            if (t && (t.passable || t.type === 'door_closed') && !inVault(x, y)) expect(all.has(`${x},${y}`), `${where}: sealed tile ${x},${y}`).toBe(true);
          }
        }
        for (const v of vaults) {
          let entered = false;
          for (let y = v.y1; y <= v.y2; y++) for (let x = v.x1; x <= v.x2; x++) if (all.has(`${x},${y}`)) entered = true;
          expect(entered, `${where}: vault at ${v.x1},${v.y1} can't be entered`).toBe(true);
        }

        expect(r.rooms.length, `${where}: no rooms`).toBeGreaterThan(1);
        const home = r.rooms[0];
        expect(r.playerSpawn.x >= home.x1 && r.playerSpawn.x <= home.x2 && r.playerSpawn.y >= home.y1 && r.playerSpawn.y <= home.y2, `${where}: rooms[0] isn't the spawn room`).toBe(true);

        if (c.forcedVaultId) {
          expect((r.forcedVaultChestSpawns?.length ?? 0) + (r.forcedVaultNpcSpawns?.length ?? 0), `${where}: forced vault missing`).toBeGreaterThan(0);
        }

        if (c.threshold) {
          // The room is stamped whole (no tunnel cut its walls), the player arrives on its '@',
          // it is the spawn room, and no other room reaches into it.
          const t = r.thresholdRect;
          expect(t, `${where}: no threshold room`).toBeDefined();
          if (!t) continue;
          c.threshold.forEach((row, dy) => {
            [...row].forEach((ch, dx) => {
              if (ch === '@') expect(r.playerSpawn, `${where}: arrival`).toEqual({ x: t.x1 + dx, y: t.y1 + dy });
              expect(r.map.getTile(t.x1 + dx, t.y1 + dy)?.type, `${where}: threshold cell ${dx},${dy}`).toBe(THRESHOLD_TILE[ch]);
            });
          });
          expect(r.rooms[0]).toMatchObject(t);
          for (const room of r.rooms.slice(1)) {
            const overlaps = room.x1 <= t.x2 && room.x2 >= t.x1 && room.y1 <= t.y2 && room.y2 >= t.y1;
            expect(overlaps, `${where}: room ${room.x1},${room.y1} reaches into the threshold`).toBe(false);
          }
          expect(inVault(r.stairsDown.x, r.stairsDown.y) || (r.stairsDown.x >= t.x1 && r.stairsDown.x <= t.x2 && r.stairsDown.y >= t.y1 && r.stairsDown.y <= t.y2), `${where}: stairs in the threshold`).toBe(false);
        }
      }
      expect(fallbacks, `${label} fell back to rooms and corridors ${fallbacks}/${SEEDS} times`).toBeLessThanOrEqual(Math.ceil(SEEDS * 0.05));
    });

    it(`${label}: same seed, same floor`, () => {
      const a = strategyFor(c.strategy, () => {}).generate(params(c, 424242));
      const b = strategyFor(c.strategy, () => {}).generate(params(c, 424242));
      expect(tileTypes(a)).toBe(tileTypes(b));
      expect(a.playerSpawn).toEqual(b.playerSpawn);
      expect(a.stairsDown).toEqual(b.stairsDown);
    });
  }
});
