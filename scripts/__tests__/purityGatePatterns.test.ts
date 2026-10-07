import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * R-tool-6: forms of a banned import or call that check-engine-purity's patterns did not
 * see. Each snippet is planted at an engine, content or presentation path, and the gate must
 * report it at that path and line.
 *
 * The file is written to a temp directory and handed to the gate with `--overlay`, which
 * scans it as though it sat at its tree path, so the gate's own roots decide how it is
 * checked; nothing is written under src/, where other suites walk in parallel and would race
 * a file appearing and vanishing.
 */

const ROOT = process.cwd();
let scratchDir: string;

const scratchFileFor = (treePath: string): string => path.join(scratchDir, path.basename(treePath));

/** Writes a planted file's text to the temp directory; returns the tree path it is planted at. */
function plant(treePath: string, lines: string[]): string {
  fs.writeFileSync(scratchFileFor(treePath), lines.join('\n'));
  return treePath;
}

/** Runs the gate with each planted file overlaid at its tree path. */
function runGate(...planted: string[]): { status: number; output: string } {
  const overlays = planted.flatMap((treePath) => ['--overlay', `${treePath}=${scratchFileFor(treePath)}`]);
  try {
    // No shell: a shell would split a temp path with a space in it.
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/check-engine-purity.ts', ...overlays], {
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

/** The `[CATEGORY] path:line` lines the gate printed for one planted file. */
function reported(output: string, treePath: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('[') && l.includes(` ${treePath}:`));
}

describe('check-engine-purity sees every form of a barred import', () => {
  beforeAll(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'purity-gate-'));
  });

  afterAll(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  });

  it('fails on side-effect, dynamic, multi-line dynamic and require imports', () => {
    const engine = plant('src/engine/__scratch_purity_engine__.ts', [
      "import '../ui/styles/hud.css';",
      'export async function scratch(): Promise<unknown[]> {',
      "  const pack = await import('../content/cotw');",
      '  const later = await import(',
      "    '../rendering/fxRunner'",
      '  );',
      "  const fx = require('../rendering/fxRunner');",
      "  type Item = import('../items/item').Item;",
      '  return [pack, later, fx];',
      '}',
      '',
    ]);
    const content = plant('src/content/cotw/__scratch_purity_content__.ts', [
      "import '../../ui/toast';",
      "export const lazyEngine = () => import('../../engine/engine');",
      '',
    ]);
    const presentation = plant('src/ui/__scratch_purity_ui__.ts', [
      "export const lazyPack = () => import('../content/cotw');",
      "export const lazyMap = () => import('../engine/grid/map');",
      "export const barrel = () => import('../engine');",
      '',
    ]);

    const { status, output } = runGate(engine, content, presentation);

    expect(status).not.toBe(0);
    expect(reported(output, engine)).toEqual([
      `[REVERSE_IMPORT] ${engine}:1`,
      `[REVERSE_IMPORT_CONTENT] ${engine}:3`,
      `[REVERSE_IMPORT] ${engine}:5`,
      `[REVERSE_IMPORT] ${engine}:7`,
    ]);
    expect(reported(output, content)).toEqual([
      `[CONTENT_REVERSE_IMPORT] ${content}:1`,
      `[CONTENT_DEEP_ENGINE_IMPORT] ${content}:2`,
    ]);
    expect(reported(output, presentation)).toEqual([
      `[FORBIDDEN_CONTENT_IMPORT] ${presentation}:1`,
      `[DEEP_ENGINE_IMPORT] ${presentation}:2`,
    ]);
  }, 120_000);
});
