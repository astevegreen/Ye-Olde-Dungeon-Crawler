import { describe, it, expect } from 'vitest';
import type { PixelSprite } from '../../../engine';
import { cotwManifest } from '..';
import { COTW_FIXTURE_ART } from '../sprites/fixtureSprites';

const tiles = cotwManifest.tiles ?? [];
const art = cotwManifest.fixtureArt ?? {};
const drawnTiles = art.tiles ?? {};

describe('the cotw fixtures', () => {
  it('are the pack’s fixture art, keyed by real tile types', () => {
    expect(art).toBe(COTW_FIXTURE_ART);
    const types = new Set(tiles.map((t) => t.type));
    for (const type of Object.keys(drawnTiles)) expect([type, types.has(type)]).toEqual([type, true]);
  });

  it('draw every portal and altar, and the Siphon Altar and core, which had no mark', () => {
    const marked = tiles.filter((t) => t.visual === 'portal' || t.visual === 'altar').map((t) => t.type);
    expect(marked.filter((type) => !(type in drawnTiles))).toEqual([]);
    expect(Object.keys(drawnTiles)).toEqual(expect.arrayContaining(['siphon_altar', 'siphon_core']));
  });
});

/** A shut or emptied chest and a heap have nothing to move; the bible bakes them one frame. */
const STILL = ['chest unopened', 'chest empty', 'pile small', 'pile large'];

describe('the cotw fixture sprites draw their own pixels', () => {
  const sprites: Record<string, PixelSprite> = {
    ...Object.fromEntries(Object.entries(drawnTiles).map(([type, s]) => [`tile ${type}`, s])),
    ...Object.fromEntries(Object.entries(art.containers?.chest ?? {}).map(([state, s]) => [`chest ${state}`, s])),
    'pile small': art.lootPile!.small,
    'pile large': art.lootPile!.large!,
  };
  // Every frame is baked once and shared, as the family sprites' test does.
  const baked = Object.fromEntries(
    Object.entries(sprites).map(([name, s]) => [name, Array.from({ length: s.frames ?? 1 }, (_, f) => s.render(f, 64))]),
  );

  it('bake 64 × 64 pixels, the same every time; what idles moves, and still chests and heaps bake once', () => {
    for (const [name, s] of Object.entries(sprites)) {
      expect([name, s.frames]).toEqual([name, STILL.includes(name) ? 1 : 4]);
      expect(baked[name][0].length).toBe(64 * 64 * 4);
      expect(s.render(0, 64)).toEqual(baked[name][0]);
      if (baked[name].length > 1) expect([name, baked[name].slice(1).some((f) => !sameBytes(f, baked[name][0]))]).toEqual([name, true]);
    }
    // Re-rendering every fixture took 0.6 s alone and 6.2–6.5 s under the full suite, past the 5 s default.
  }, 30_000);

  it('give every place, chest state and heap size its own look; the two Týr altars share one, as do the barrows', () => {
    expect(drawnTiles.altar_tyr).toBe(drawnTiles.galdr_altar_tyr);
    expect(drawnTiles.duergar_barrow_1).toBe(drawnTiles.duergar_barrow_2);
    expect(drawnTiles.duergar_barrow_1).toBe(drawnTiles.duergar_barrow_3);
    // A sprite shared between tiles is one look: compare each drawing once.
    const names = Object.keys(sprites).filter((name, i, all) => all.findIndex((n) => sprites[n] === sprites[name]) === i);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        expect([names[i], names[j], sameBytes(baked[names[i]][0], baked[names[j]][0])]).toEqual([names[i], names[j], false]);
      }
    }
  });
});

function sameBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
