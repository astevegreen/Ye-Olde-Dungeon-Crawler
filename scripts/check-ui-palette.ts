import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * UI palette ratchet (ARCHITECTURE.md §7.2, ADR-0011).
 *
 * Presentation code names role tokens (`var(--ui-accent)`, `theme.textMuted`), never hues.
 * About 1,600 color literals predate that rule, so this is a ratchet rather than a ban: the
 * baseline (scripts/ui-palette-baseline.json) records each file's count, and
 *  - a file whose count rises above its baseline fails (a new file starts at zero);
 *  - a file whose count falls below its baseline also fails, until the baseline is lowered
 *    with `npm run check:ui-palette -- --update`, so the count can only go down.
 *
 * Scope: src/ui/, src/rendering/, src/main.ts, src/main/ and index.html (.ts, .css, .html),
 * minus tests. The token modules themselves (src/rendering/theme.ts, src/ui/styles/tokens.css)
 * are where colors are meant to live and are exempt. Pure black and white (shadows, glass
 * shine) carry no pack identity and are not counted.
 */

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'scripts', 'ui-palette-baseline.json');
const SCOPE_DIRS = ['src/ui', 'src/rendering', 'src/main'];
const SCOPE_FILES = ['src/main.ts', 'index.html'];
const EXEMPT = new Set(['src/rendering/theme.ts', 'src/ui/styles/tokens.css']);

const NEUTRAL = /^(#000|#000000|#fff|#ffffff|rgba?\(\s*0\s*,\s*0\s*,\s*0\b.*|rgba?\(\s*255\s*,\s*255\s*,\s*255\b.*)$/i;

/** Color literals in a source text: hex colors (not HTML entities) and rgb()/rgba()/hsl()/hsla() calls. */
export function colorLiterals(text: string): string[] {
  const found = text.match(/(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?)\([^)]*\)/g) ?? [];
  return found.filter((c) => !NEUTRAL.test(c.trim()));
}

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(rel);
    return /\.(ts|css|html)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [rel] : [];
  });
}

export function scanPalette(): Record<string, number> {
  const files = [...SCOPE_DIRS.flatMap(walk), ...SCOPE_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))];
  const counts: Record<string, number> = {};
  for (const file of files.sort()) {
    if (EXEMPT.has(file)) continue;
    const n = colorLiterals(fs.readFileSync(path.join(ROOT, file), 'utf-8')).length;
    if (n > 0) counts[file] = n;
  }
  return counts;
}

function main(): void {
  const counts = scanPalette();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (process.argv.includes('--update')) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify({ total, files: counts }, null, 2)}\n`);
    console.log(`ui-palette baseline written: ${total} color literals in ${Object.keys(counts).length} files.`);
    return;
  }

  const baseline: Record<string, number> = fs.existsSync(BASELINE_PATH)
    ? (JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')).files ?? {})
    : {};
  const rose: string[] = [];
  const fell: string[] = [];
  for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
    const now = counts[file] ?? 0;
    const was = baseline[file] ?? 0;
    if (now > was) rose.push(`  ${file}: ${was} -> ${now}`);
    else if (now < was) fell.push(`  ${file}: ${was} -> ${now}`);
  }

  console.log('\n======================================================');
  console.log('UI PALETTE RATCHET');
  console.log(`Color literals in presentation source: ${total}`);
  console.log('======================================================\n');

  // A run that inspects nothing (the wrong cwd, a moved directory) is a failure, not a pass.
  if (SCOPE_DIRS.flatMap(walk).length === 0) {
    console.error('❌ Inspected no presentation files: run from the repository root.');
    process.exit(1);
  }

  if (rose.length) {
    console.error('✗ Color literals added. Use a role token (var(--ui-*) in CSS, the resolved theme on canvas):');
    console.error(rose.join('\n'));
  }
  if (fell.length) {
    console.error('✗ Color literals removed — lower the baseline so they stay gone: npm run check:ui-palette -- --update');
    console.error(fell.join('\n'));
  }
  if (rose.length || fell.length) process.exit(1);
  console.log('✓ UI Palette: no color literals added since the baseline.');
}

// Run only when invoked as a script, so tests can import colorLiterals().
if (process.argv[1] && /check-ui-palette\.ts$/.test(process.argv[1])) {
  main();
}
