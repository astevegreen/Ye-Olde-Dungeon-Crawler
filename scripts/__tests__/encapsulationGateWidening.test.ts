import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * R-tool-5: the encapsulation gate let through a subsystem mutator its verb list didn't
 * name (`consolidateCoins`, `markOpened`, `triggerDeath`, ...), a write by bracket
 * (`player['hp'] = 0`), a method called by bracket, and `Reflect.set`. Plants each in a
 * scratch presentation file, asserts the gate fails on it, and always removes the file.
 */

const ROOT = process.cwd();
const SCRATCH_FILE = path.resolve(ROOT, 'src/ui/__scratch_encapsulation_violation__.ts');

function runGate(): { status: number; output: string } {
  try {
    const output = execSync('npx tsx scripts/check-engine-encapsulation.ts', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the encapsulation gate catches what its verb list and AST walk missed', () => {
  afterEach(() => {
    if (fs.existsSync(SCRATCH_FILE)) fs.unlinkSync(SCRATCH_FILE);
  });

  it('fails on an unlisted mutator, bracket writes and calls, and Reflect.set', () => {
    fs.writeFileSync(
      SCRATCH_FILE,
      [
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
      ].join('\n')
    );

    const { status, output } = runGate();

    expect(status).not.toBe(0);
    expect(output).toContain('InventoryManager.consolidateCoins');
    expect(output).toContain('INDEXED_WRITE');
    expect(output).toContain('GameMap.setTile');
    expect(output).toContain('OBJECT_ASSIGN');
  }, 120_000);
});
