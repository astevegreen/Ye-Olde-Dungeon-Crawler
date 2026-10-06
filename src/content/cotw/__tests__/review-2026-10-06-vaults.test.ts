import { describe, it, expect } from 'vitest';
import { VaultStamper } from '../../../engine/dungeon/vaultStamp';
import { COTW_VAULTS } from '../vaults';

/**
 * Whole-codebase review, 2026-10-06, area 4 (dungeon generation). R-ai-2: the Abyssal
 * Treasury (`chasm_treasury`) seals both chests behind chasm and bars — 238 of 238 such
 * chests were unreachable across 980 generated floors. This test walks the blueprint
 * itself (doors open, bars and chasm closed, no secrets) from every `@` connector and
 * asks that every `C` be reachable. Marked `it.fails` until the blueprint gets a route.
 */

function reachableChests(layout: readonly string[], legend?: Record<string, string>): { chests: number; reachable: number } {
  const h = layout.length;
  const w = layout[0].length;
  const walkable = (x: number, y: number) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    const ch = layout[y][x];
    if (ch === '+') return true; // a closed door opens
    return VaultStamper.parseSymbol(ch, legend).tile.walkable;
  };
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (layout[y][x] === '@') { queue.push([x, y]); seen.add(`${x},${y}`); }
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (!seen.has(k) && walkable(nx, ny)) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  let chests = 0, reachable = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (layout[y][x] === 'C') { chests++; if (seen.has(`${x},${y}`)) reachable++; }
  return { chests, reachable };
}

describe('R-ai-2 · every chest in every cotw vault blueprint is reachable from a connector without crossing chasm or bars', () => {
  it('the Abyssal Treasury (chasm_treasury) has a route to its chests', () => {
    const vault = COTW_VAULTS.find((v) => v.id === 'chasm_treasury')!;
    const { chests, reachable } = reachableChests(vault.layout, (vault as { legend?: Record<string, string> }).legend);
    expect(chests).toBe(2); // (passes today)
    expect(reachable).toBe(chests);
  });

  it('every other vault with a chest has a route to all of them (guards the fix from regressing elsewhere)', () => {
    const sealed = COTW_VAULTS.filter((v) => v.id !== 'chasm_treasury')
      .map((v) => ({ id: v.id, ...reachableChests(v.layout, (v as { legend?: Record<string, string> }).legend) }))
      .filter((r) => r.chests > 0 && r.reachable < r.chests);
    expect(sealed).toEqual([]);
  });
});
