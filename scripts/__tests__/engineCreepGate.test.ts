import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Regression test for ARCHITECTURE.md §3 No Engine Creep: check-engine-creep must fail
 * on campaign logic pasted into src/engine/, the pattern dc5de31 slipped past every
 * import-topology gate with (cotw spell IDs and story flags inside GameEngine).
 *
 * The violations are planted in a temp directory and handed to the gate with
 * `--engine-file` / `--presentation-file`, never under src/: other tests walk src/engine
 * (campaignSeparation.test.ts) and would race a file appearing and vanishing there.
 */

const ROOT = process.cwd();
let scratchDir: string;

function runGate(...args: string[]): { status: number; output: string } {
  try {
    // No shell: a shell would split a temp path with a space in it.
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/check-engine-creep.ts', ...args], {
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

function scratch(name: string, lines: string[]): string {
  const file = path.join(scratchDir, name);
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

describe('check-engine-creep (ARCHITECTURE.md §3, §7.2)', () => {
  beforeAll(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'creep-gate-'));
  });

  afterAll(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('fails on a content-pack spell ID in engine source, but not on one named in a comment', () => {
    const file = scratch('engineScratch.ts', [
      "// Prose may mention 'crimson_ward' without tripping the gate.",
      'export function scratchCreep(learn: (id: string) => void): void {',
      "  learn('blood_tap');",
      '}',
      '',
    ]);

    const { status, output } = runGate('--engine-file', file);

    expect(status).not.toBe(0);
    expect(output).toContain("'blood_tap' (declared by cotw)");
    expect(output).not.toContain("'crimson_ward'");
  }, 60_000);

  it('fails on a content-pack identifier or namespaced literal in presentation source', () => {
    const file = scratch('uiScratch.ts', ["export const testVal = 'cotw:giant_blood';", '']);

    const { status, output } = runGate('--presentation-file', file);

    expect(status).not.toBe(0);
    expect(output).toContain('Found 1 content-pack identifier(s) in presentation source');
    expect(output).toContain("'cotw:giant_blood'");
  }, 60_000);

  it('passes on the tree as it is, scanning the real engine and presentation sources', () => {
    const { status, output } = runGate();

    expect(status).toBe(0);
    expect(Number(/Engine source files inspected: (\d+)/.exec(output)?.[1])).toBeGreaterThan(100);
    expect(Number(/Presentation source files inspected: (\d+)/.exec(output)?.[1])).toBeGreaterThan(50);
  }, 60_000);
});
