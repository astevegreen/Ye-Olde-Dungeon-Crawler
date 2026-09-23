import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Governance references resolve (ARCHITECTURE.md §8.2). Agent files, sub-docs, and code
 * comments cite ARCHITECTURE.md by section (§N) and Planned Work ID (P-NN); both kinds
 * have drifted before (a stale P-10, an ID reused while still cited). This fails on a
 * section that doesn't exist, a P-ID that is neither registered nor retired, and a
 * relative doc link to a missing file.
 */

const ROOT = process.cwd();
const ARCH = fs.readFileSync(path.join(ROOT, 'ARCHITECTURE.md'), 'utf-8');

function filesUnder(dir: string, ext: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : filesUnder(rel, ext);
    return e.name.endsWith(ext) ? [rel] : [];
  });
}

const DOCS = [
  'ARCHITECTURE.md',
  'CLAUDE.md',
  ...filesUnder('docs', '.md'),
  ...filesUnder('.antigravity', '.md'),
  ...filesUnder('.claude/commands', '.md'),
];
const SOURCES = [...filesUnder('src', '.ts'), ...filesUnder('scripts', '.ts')].filter(
  (f) => !f.endsWith('docReferences.test.ts')
);

const sections = new Set([
  ...[...ARCH.matchAll(/^## (\d+)\./gm)].map((m) => m[1]),
  ...[...ARCH.matchAll(/^### (\d+\.\d+)/gm)].map((m) => m[1]),
]);
const registered = new Set([...ARCH.matchAll(/^\*\*(P-\d+) —/gm)].map((m) => m[1]));
const nextFree = Number(/Next free ID: P-(\d+)/.exec(ARCH)?.[1]);

function citations(pattern: RegExp): { file: string; ref: string }[] {
  return [...DOCS, ...SOURCES].flatMap((file) =>
    [...fs.readFileSync(path.join(ROOT, file), 'utf-8').matchAll(pattern)].map((m) => ({ file, ref: m[1] }))
  );
}

describe('governance references resolve', () => {
  it('every cited §section exists in ARCHITECTURE.md', () => {
    const broken = citations(/§(\d+(?:\.\d+)?)/g).filter(({ ref }) => !sections.has(ref));
    expect(broken).toEqual([]);
  });

  it('every cited P-ID is registered in §9 or retired below the next free ID', () => {
    expect(Number.isInteger(nextFree)).toBe(true);
    const broken = citations(/\b(P-\d{2,})\b/g).filter(
      ({ file, ref }) =>
        !registered.has(ref) &&
        Number(ref.slice(2)) >= nextFree &&
        !(file === 'ARCHITECTURE.md' && ref === `P-${nextFree}`) // the "Next free ID" line itself
    );
    expect(broken).toEqual([]);
    for (const id of registered) expect(Number(id.slice(2))).toBeLessThan(nextFree);
  });

  it('every [Planned: P-NN] tag has a §9 entry', () => {
    const orphans = citations(/\[Planned: (P-\d+)\]/g).filter(({ ref }) => !registered.has(ref));
    expect(orphans).toEqual([]);
  });

  it('relative links in the architecture docs point at files that exist', () => {
    const broken = DOCS.flatMap((file) =>
      [...fs.readFileSync(path.join(ROOT, file), 'utf-8').matchAll(/\]\(([^)#:\s]+)(?:#[^)]*)?\)/g)]
        .map((m) => m[1])
        .filter((target) => !fs.existsSync(path.resolve(ROOT, path.dirname(file), target)))
        .map((target) => `${file} -> ${target}`)
    );
    expect(broken).toEqual([]);
  });
});
