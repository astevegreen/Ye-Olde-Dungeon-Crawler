import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Regression test for ARCHITECTURE.md §3 No Engine Creep: check-engine-creep must fail
 * on campaign logic pasted into src/engine/, the pattern dc5de31 slipped past every
 * import-topology gate with (cotw spell IDs and story flags inside GameEngine).
 *
 * Plants a scratch file under src/engine/, asserts the gate fails on it, and always
 * removes it so nothing here is ever committed.
 */

const ROOT = process.cwd();
const SCRATCH_FILE = path.resolve(ROOT, 'src/engine/__scratch_creep_violation__.ts');

function runGate(): { status: number; output: string } {
  try {
    const output = execSync('npx tsx scripts/check-engine-creep.ts', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
    return { status: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('check-engine-creep (ARCHITECTURE.md §3, §7.2)', () => {
  afterEach(() => {
    if (fs.existsSync(SCRATCH_FILE)) fs.unlinkSync(SCRATCH_FILE);
  });

  it('fails on a content-pack spell ID in engine source, but not on one named in a comment', () => {
    fs.writeFileSync(
      SCRATCH_FILE,
      [
        "// Prose may mention 'crimson_ward' without tripping the gate.",
        'export function scratchCreep(learn: (id: string) => void): void {',
        "  learn('blood_tap');",
        '}',
        '',
      ].join('\n')
    );

    const { status, output } = runGate();

    expect(status).not.toBe(0);
    expect(output).toContain("'blood_tap' (declared by cotw)");
    expect(output).not.toContain("'crimson_ward'");
  }, 60_000);
});
