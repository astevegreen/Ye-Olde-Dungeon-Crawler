import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { replayActionTrail } from '../replay';

/**
 * Every action the game constructs can reach `handlePlayerAction`, and so the trail, unless
 * only monsters take it. An action with no replay builder stops a replay dead at its first
 * entry (R-dbg-1), so each one needs a builder in `debug/replay.ts`, or a place below.
 */

/** Taken only by monsters, never by the hero: never in the trail. */
const MONSTER_ONLY = new Set(['WindUpDeclareAction', 'WindUpExecuteAction', 'ChannelRiteAction']);
/** Kept out of the trail by the flight recorder (`UNTRAILED`): the next action checkpoints. */
const UNTRAILED = new Set(['ExecuteChoiceAction']);

const SRC = path.resolve(__dirname, '../../..');

function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== '__fixtures__') productionSources(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(fs.readFileSync(full, 'utf8'));
    }
  }
  return out;
}

describe('every action the game issues can be replayed', () => {
  const sources = productionSources(SRC).join('\n');
  const actionClasses = [...sources.matchAll(/class (\w+)(?: extends \w+)? implements Action\b/g)].map((m) => m[1]);

  it('finds the action classes', () => {
    expect(actionClasses).toContain('MovementAction');
    expect(actionClasses.length).toBeGreaterThan(20);
  });

  it('has a replay builder for each one production code constructs', () => {
    const engine = new GameEngine({ map: new GameMap(8, 8, TILES.FLOOR), player: new Player({ position: { x: 2, y: 2 } }) });
    const issued = actionClasses.filter((name) => new RegExp(`new ${name}\\(`).test(sources));
    const missing = issued.filter((name) => {
      if (MONSTER_ONLY.has(name) || UNTRAILED.has(name)) return false;
      const res = replayActionTrail(engine, [{ seq: 0, turn: 0, floor: 0, action: name, params: {} }]);
      return /no replay builder/.test(res.stoppedAt?.reason ?? '');
    });
    expect(missing).toEqual([]);
  });
});
