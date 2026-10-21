import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { Player } from '../../../engine/entities/player';
import { cotwManifest } from '../index';

// The engine's stock sayings (`runAdvisor.ts`), which the pack's own replace.
const ENGINE_DEFAULTS = [
  '"Steel sharpens steel, but forethought preserves the flesh."',
  '"Ancient lore tells of heroes felled not by monsters, but by an overfilled pack."',
  '"Fortune favors the brave, but only when they bring potions to battle."',
  '"He who descends unwarded into the frost will leave only bone for the ravens."',
];

const quotes = cotwManifest.advisorQuotes ?? [];

/** A fresh hero in town, light pack, nothing cursed: the advisor finds nothing to warn of. */
function allClearEngine(): GameEngine {
  const player = new Player({ id: 'p1', name: 'Hero', position: { x: 0, y: 0 }, stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 } });
  return new GameEngine({ map: new GameMap(10, 10), player, floor: 0, manifest: cotwManifest });
}

function adviseAt(engine: GameEngine, turn: number): string {
  engine.turnCount = turn;
  const res = engine.commandBus.dispatch({ type: 'sage_advisory' });
  expect(res.success).toBe(true);
  return res.message ?? '';
}

describe("Sage Mimir's all-clear advice ends with a saying in the pack's voice (U5)", () => {
  it('the pack declares 4 to 6 sayings, quoted like the defaults and under 120 characters', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(4);
    expect(quotes.length).toBeLessThanOrEqual(6);
    for (const q of quotes) {
      expect(q).toMatch(/^".+"$/);
      expect(q.length).toBeLessThan(120);
    }
    expect(new Set(quotes).size).toBe(quotes.length);
  });

  it('the advice ends with one of the pack sayings and with none of the engine defaults', () => {
    const engine = allClearEngine();
    const message = adviseAt(engine, 0);

    expect(message.startsWith('Sage Mimir: "')).toBe(true);
    expect(quotes.some((q) => message.endsWith(q))).toBe(true);
    for (const d of ENGINE_DEFAULTS) expect(message).not.toContain(d);
  });

  it('every saying is reached over turns 0..n-1', () => {
    expect(quotes.length).toBeGreaterThan(0);
    const engine = allClearEngine();
    const seen = new Set<string>();
    for (let turn = 0; turn < quotes.length; turn++) {
      const message = adviseAt(engine, turn);
      const match = quotes.find((q) => message.endsWith(q));
      expect(match).toBeDefined();
      seen.add(match!);
    }
    expect([...seen].sort()).toEqual([...quotes].sort());
  });

  it('the sayings are flavour: no retired spell named', () => {
    expect(quotes.length).toBeGreaterThan(0);
    for (const q of quotes) expect(q).not.toMatch(/lightning/i);
  });
});
