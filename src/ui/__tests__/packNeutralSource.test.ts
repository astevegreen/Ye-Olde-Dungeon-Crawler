import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cotwManifest } from '../../content/cotw';
import { warcraftManifest } from '../../content/warcraft';
import type { GameContentManifest } from '../../engine';

// ARCHITECTURE.md §3 Pack-Neutral Presentation. check:engine-creep only catches declared
// identifiers; this scans presentation source for the packs' own proper nouns as plain words.

const ROOT = join(__dirname, '..', '..', '..');
const SCANNED = ['src/ui', 'src/rendering', 'src/main', 'index.html'];
const RUNIC = /[ᚠ-᛿]/u;

function packNouns(manifest: GameContentManifest): string[] {
  const b = manifest.branding ?? {};
  const names = [
    manifest.town.name,
    b.worldName,
    b.hallOfFameShortName,
    b.xpName,
    ...(manifest.presetNames ?? []),
    ...manifest.town.npcs.map((npc) => npc.name),
    ...(manifest.magic?.altars ?? []).map((altar) => altar.name),
  ];
  // Titles and roles ("Banker", "Rune-Smith", "Grave-Altar") are generic English; the
  // proper noun beside them is the leak.
  const generic = new Set([
    'The', 'Town', 'Heroes', 'Outpost',
    'Banker', 'Sage', 'Father', 'Brother', 'Commander', 'Guard', 'Chandler', 'Smith', 'Alchemist', 'Armorer',
    'Dwarven', 'Hound', 'Warden', 'Rune', 'Altar', 'Grave', 'Stone', 'Oath', 'Gallows', 'Cairn',
  ]);
  return [
    ...new Set(
      names
        .filter((n): n is string => Boolean(n))
        .flatMap((n) => n.split(/[\s'’-]+/))
        .filter((w) => /^[A-Z][a-z]{2,}$/.test(w) && !generic.has(w))
    ),
  ];
}

function sourceFiles(path: string): string[] {
  const abs = join(ROOT, path);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((entry) => {
    if (entry === '__tests__') return [];
    const child = join(path, entry);
    const childAbs = join(ROOT, child);
    if (statSync(childAbs).isDirectory()) return sourceFiles(child);
    return /\.(ts|html)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [childAbs] : [];
  });
}

/** Drops comments, which may cite a pack when explaining where data comes from. */
function stripComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('pack-neutral presentation source', () => {
  const files = SCANNED.flatMap(sourceFiles);
  const nouns = [...packNouns(cotwManifest), ...packNouns(warcraftManifest)];

  it('derives a meaningful denylist from the packs', () => {
    expect(nouns).toEqual(expect.arrayContaining(['Haakon', 'Thrain', 'Midgard', 'Loki', 'Sven', 'Azeroth']));
  });

  it('names no pack NPC, place, or hero in src/ui, src/rendering, src/main, or index.html', () => {
    // Case-sensitive, plus shouted forms ("MIDGARD"), so ids like `btn-valhalla` stay legal.
    const pattern = new RegExp(`\\b(${nouns.flatMap((n) => [n, n.toUpperCase()]).join('|')})\\b`);
    const leaks = files.flatMap((file) =>
      stripComments(readFileSync(file, 'utf-8'))
        .split('\n')
        .filter((line) => pattern.test(line))
        .map((line) => `${relative(ROOT, file)}: ${line.trim().slice(0, 120)}`)
    );
    expect(leaks).toEqual([]);
  });

  it('carries no runic glyphs outside pack data', () => {
    const leaks = files.filter((file) => RUNIC.test(readFileSync(file, 'utf-8'))).map((f) => relative(ROOT, f));
    expect(leaks).toEqual([]);
  });
});
