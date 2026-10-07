import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * R-tool-5: the encapsulation gate let through a subsystem mutator its verb list didn't
 * name (`consolidateCoins`, `markOpened`, `triggerDeath`, ...), a write by bracket
 * (`player['hp'] = 0`), a method called by bracket, and `Reflect.set`. Plants each in a
 * presentation file and asserts the gate fails on it.
 *
 * The file is written to a temp directory and handed to the gate with `--overlay`, which
 * compiles it as though it sat at PLANTED_AT; nothing is written under src/, where other
 * suites walk in parallel and would race a file appearing and vanishing.
 */

const ROOT = process.cwd();
const PLANTED_AT = 'src/ui/__scratch_encapsulation_violation__.ts';
let scratchDir: string;

function runGate(lines: string[]): { status: number; output: string } {
  const file = path.join(scratchDir, path.basename(PLANTED_AT));
  fs.writeFileSync(file, lines.join('\n'));
  try {
    // No shell: a shell would split a temp path with a space in it.
    const output = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/check-engine-encapsulation.ts', '--overlay', `${PLANTED_AT}=${file}`],
      { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }
    );
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the encapsulation gate catches what its verb list and AST walk missed', () => {
  beforeAll(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encapsulation-gate-'));
  });

  afterAll(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('fails on an unlisted mutator, bracket writes and calls, and Reflect.set', () => {
    const { status, output } = runGate([
      "import type { GameEngine } from '../engine';",
      '',
      'export function scratchViolations(engine: GameEngine): void {',
      '  engine.player.inventory.consolidateCoins();',
      "  (engine.player as unknown as Record<string, number>)['hp'] = 0;",
      "  engine.player['hp'] = 0;",
      "  engine.map['setTile'](0, 0, engine.map.getTile(1, 1)!);",
      "  Reflect.set(engine.player, 'hp', 0);",
      '}',
      '',
    ]);

    expect(status).not.toBe(0);
    expect(output).toContain('InventoryManager.consolidateCoins');
    expect(output).toContain('INDEXED_WRITE');
    expect(output).toContain('GameMap.setTile');
    expect(output).toContain('OBJECT_ASSIGN');
    expect(output).toContain(PLANTED_AT);
  }, 120_000);
});
