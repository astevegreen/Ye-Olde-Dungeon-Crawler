import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Regression test for ARCHITECTURE.md §3 / §7.2: check-engine-purity and
 * check-engine-encapsulation must treat src/main/** as presentation scope —
 * scanned for deep engine imports, forbidden content-pack imports, and
 * direct engine-object mutation.
 *
 * Plants a violation at src/main/ and asserts the relevant gate script fails on it.
 * The file is written to a temp directory and handed to the gate with `--overlay`,
 * which scans it as though it sat at PLANTED_AT, so the gate's own src/main/** scoping
 * decides whether it is checked; nothing is written under src/, where other suites
 * walk in parallel and would race a file appearing and vanishing.
 */

const ROOT = process.cwd();
const PLANTED_AT = 'src/main/__scratch_gate_violation__.ts';
let scratchDir: string;

function runScript(scriptPath: string, lines: string[]): { status: number; output: string } {
  const file = path.join(scratchDir, path.basename(PLANTED_AT));
  fs.writeFileSync(file, lines.join('\n'));
  try {
    // No shell: a shell would split a temp path with a space in it.
    const output = execFileSync(process.execPath, ['--import', 'tsx', scriptPath, '--overlay', `${PLANTED_AT}=${file}`], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('gate scripts cover src/main/** (ARCHITECTURE.md §7.2 widened scope)', () => {
  beforeAll(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'main-scope-gate-'));
  });

  afterAll(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('check-engine-purity fails on a deep engine import and a content-pack import planted under src/main/', () => {
    const result = runScript('scripts/check-engine-purity.ts', [
      "import type { GameEngine } from '../engine/engine';",
      "import { cotwManifest } from '../content/cotw';",
      '',
      'export function scratchGateViolation(engine: GameEngine): typeof cotwManifest {',
      '  void engine;',
      '  return cotwManifest;',
      '}',
      '',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('DEEP_ENGINE_IMPORT');
    expect(result.output).toContain('FORBIDDEN_CONTENT_IMPORT');
    expect(result.output).toContain(PLANTED_AT);
  }, 120_000);

  it('check-engine-encapsulation fails on a direct engine-property mutation planted under src/main/', () => {
    const result = runScript('scripts/check-engine-encapsulation.ts', [
      "import type { GameEngine } from '../engine/engine';",
      '',
      'export function scratchGateViolation(engine: GameEngine): void {',
      '  engine.turnCount = 0;',
      '}',
      '',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('PROPERTY_WRITE');
    expect(result.output).toContain('GameEngine.turnCount');
    expect(result.output).toContain(PLANTED_AT);
  }, 120_000);

  it('check-engine-encapsulation fails on a write into plain engine state reached through a member', () => {
    // The shape of the old src/main.ts bug: ActionResult is an interface, so the field
    // written is not a class member, but the object belongs to the engine.
    const result = runScript('scripts/check-engine-encapsulation.ts', [
      "import type { GameEngine } from '../engine/engine';",
      '',
      'export function scratchGateViolation(engine: GameEngine): void {',
      '  if (engine.lastActionResult) engine.lastActionResult.pipelineError = false;',
      '}',
      '',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('NESTED_WRITE');
    expect(result.output).toContain('GameEngine.lastActionResult');
  }, 120_000);
});
