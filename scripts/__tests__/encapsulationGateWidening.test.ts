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

function runGate(lines: string[], plantedAt = PLANTED_AT): { status: number; output: string } {
  const file = path.join(scratchDir, path.basename(plantedAt));
  fs.writeFileSync(file, lines.join('\n'));
  try {
    // No shell: a shell would split a temp path with a space in it.
    const output = execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/check-engine-encapsulation.ts', '--overlay', `${plantedAt}=${file}`],
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

  it('fails on a write into plain engine state reached through an element access', () => {
    const { status, output } = runGate([
      "import type { GameEngine } from '../engine';",
      '',
      'export function scratchViolations(engine: GameEngine): void {',
      '  engine.recentGameEvents[0].turn = 0;',
      '  const result = engine.lastActionResult;',
      '  if (result?.events && engine.lastActionResult?.events) engine.lastActionResult.events[0] = result.events[1];',
      '}',
      '',
    ]);

    expect(status).not.toBe(0);
    expect(output).toMatch(/\[NESTED_WRITE\] src\/ui\/__scratch_encapsulation_violation__\.ts:4 {2}\(GameEngine\.recentGameEvents\)/);
    expect(output).toMatch(/\[NESTED_WRITE\] src\/ui\/__scratch_encapsulation_violation__\.ts:6 {2}\(GameEngine\.lastActionResult\)/);
  }, 120_000);

  // R-cotw-19: cotw's narrative hook wrote NPC dialogue through `const o = npc as unknown as
  // { greeting: string }; o.greeting = …`, a local alias of a cast, which the cast rule missed.
  it('fails on a write through a local alias of a cast, as on the cast written inline', () => {
    const plantedAt = 'src/content/cotw/__scratch_cast_alias__.ts';
    const { status, output } = runGate(
      [
        "import type { NPC } from '../../engine';",
        '',
        'export function scratchViolations(npc: NPC): void {',
        '  const o = npc as unknown as { greeting: string };',
        "  o.greeting = 'x';",
        '  const a = npc as any;',
        "  a['dialogText'] = 'y';",
        "  (npc as unknown as { greeting: string }).greeting = 'z';",
        '  Object.assign(o, { greeting: "w" });',
        '}',
        '',
      ],
      plantedAt
    );

    expect(status).not.toBe(0);
    expect(output).toMatch(/\[ANY_CAST_WRITE\] src\/content\/cotw\/__scratch_cast_alias__\.ts:5 {2}\(NPC\.greeting\)/);
    expect(output).toMatch(/\[INDEXED_WRITE\] src\/content\/cotw\/__scratch_cast_alias__\.ts:7 {2}\(NPC\.dialogText\)/);
    expect(output).toMatch(/\[ANY_CAST_WRITE\] src\/content\/cotw\/__scratch_cast_alias__\.ts:8 {2}\(NPC\.greeting\)/);
    expect(output).toMatch(/\[OBJECT_ASSIGN\] src\/content\/cotw\/__scratch_cast_alias__\.ts:9 {2}\(NPC\.\*\)/);
  }, 120_000);
});
