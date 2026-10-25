import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { readCommand, Unreadable } from '../../.claude/hooks/shell-reader.mjs';

/**
 * The shell reader the sprint guard reads commands with (.claude/hooks/shell-reader.mjs). Terminal Dusk and the
 * blockchain course carry identical copies; shell-reader.cases.json beside it holds the cases all three must pass.
 */

interface Case {
  shell: 'bash' | 'powershell';
  command: string;
  textReadHas?: string;
  textLacks?: string;
  literalsLack?: string;
  literalsHas?: string;
  at?: string;
}
const cases = JSON.parse(readFileSync(path.resolve(__dirname, '../../.claude/hooks/shell-reader.cases.json'), 'utf-8')) as {
  push: Case[];
  refused: Case[];
  clean: Case[];
  reads: Case[];
};

// What a guard sees: whether the reader refuses the line, and whether any command it runs is a git push.
function seen({ shell, command }: Case): { refused: boolean; pushes: boolean } {
  const read = readCommand(command, shell);
  let refused = read.refusal !== null || read.gitHidden;
  let pushes = false;
  for (const part of read.parts) {
    try {
      for (const { w } of read.commandsIn(read.words(part))) {
        if (w[0] === 'git' && w.includes('push') && !w.includes('stash')) pushes = true;
      }
    } catch (e) {
      if (!(e instanceof Unreadable)) throw e;
      refused = true;
    }
  }
  return { refused, pushes };
}
const label = (c: Case): string => `[${c.shell}] ${c.command.replace(/\n/g, '\\n')}`;

describe('shell-reader', () => {
  it.each(cases.push.map((c) => [label(c), c] as const))('sees the push in %s', (_, c) => {
    const { refused, pushes } = seen(c);
    expect(refused || pushes).toBe(true);
  });
  it.each(cases.refused.map((c) => [label(c), c] as const))('refuses %s', (_, c) => {
    expect(seen(c).refused).toBe(true);
  });
  it.each(cases.clean.map((c) => [label(c), c] as const))('reads %s as no push', (_, c) => {
    expect(seen(c)).toEqual({ refused: false, pushes: false });
  });
  it.each(cases.reads.map((c) => [label(c), c] as const))('reads the words of %s', (_, c) => {
    const read = readCommand(c.command, c.shell);
    if (c.textReadHas) expect(read.textRead).toContain(c.textReadHas);
    if (c.textLacks) expect(read.text).not.toContain(c.textLacks);
    if (c.literalsLack) expect(read.literalsBlank).not.toContain(c.literalsLack);
    if (c.literalsHas) expect(read.literalsBlank).toContain(c.literalsHas);
    if (c.at) expect(read.commandsIn(read.words(read.parts[0] ?? ''))[0]?.at).toBe(c.at);
  });
});
