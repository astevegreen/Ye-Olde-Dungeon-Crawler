import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Regression test for ARCHITECTURE.md §3 / §7.2: check-engine-purity and
 * check-engine-encapsulation must treat src/main/** as presentation scope —
 * scanned for deep engine imports, forbidden content-pack imports, and
 * direct engine-object mutation — even though src/main/ does not exist yet
 * (splitting the composition root out of src/main.ts is Phase 3 work).
 *
 * Plants a scratch violation file under src/main/, asserts the relevant gate
 * script fails on it, then always removes the scratch file so nothing here
 * is ever committed.
 */

const ROOT = process.cwd();
const MAIN_DIR = path.resolve(ROOT, 'src/main');
const SCRATCH_FILE = path.join(MAIN_DIR, '__scratch_gate_violation__.ts');
const MAIN_DIR_PREEXISTED = fs.existsSync(MAIN_DIR);

function runScript(scriptPath: string): { status: number; output: string } {
  try {
    const output = execSync(`npx tsx ${scriptPath}`, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function cleanupScratchFile(): void {
  if (fs.existsSync(SCRATCH_FILE)) fs.unlinkSync(SCRATCH_FILE);
  if (!MAIN_DIR_PREEXISTED && fs.existsSync(MAIN_DIR) && fs.readdirSync(MAIN_DIR).length === 0) {
    fs.rmdirSync(MAIN_DIR);
  }
}

describe('gate scripts cover src/main/** (ARCHITECTURE.md §7.2 widened scope)', () => {
  afterEach(() => {
    cleanupScratchFile();
  });

  it('check-engine-purity fails on a deep engine import and a content-pack import planted under src/main/', () => {
    fs.mkdirSync(MAIN_DIR, { recursive: true });
    fs.writeFileSync(
      SCRATCH_FILE,
      [
        "import type { GameEngine } from '../engine/engine';",
        "import { COTW_MANIFEST } from '../content/cotw';",
        '',
        'export function scratchGateViolation(engine: GameEngine): typeof COTW_MANIFEST {',
        '  void engine;',
        '  return COTW_MANIFEST;',
        '}',
        '',
      ].join('\n')
    );

    const result = runScript('scripts/check-engine-purity.ts');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('DEEP_ENGINE_IMPORT');
    expect(result.output).toContain('FORBIDDEN_CONTENT_IMPORT');
    expect(result.output).toContain('__scratch_gate_violation__.ts');
  }, 30000);

  it('check-engine-encapsulation fails on a direct engine-property mutation planted under src/main/', () => {
    fs.mkdirSync(MAIN_DIR, { recursive: true });
    fs.writeFileSync(
      SCRATCH_FILE,
      [
        "import type { GameEngine } from '../engine/engine';",
        '',
        'export function scratchGateViolation(engine: GameEngine): void {',
        '  engine.turnCount = 0;',
        '}',
        '',
      ].join('\n')
    );

    const result = runScript('scripts/check-engine-encapsulation.ts');

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('PROPERTY_WRITE');
    expect(result.output).toContain('GameEngine.turnCount');
    expect(result.output).toContain('__scratch_gate_violation__.ts');
  }, 30000);
});
