import * as fs from 'node:fs';
import * as path from 'node:path';

const ENGINE_DIR = path.resolve(process.cwd(), 'src/engine');
const UI_DIR = path.resolve(process.cwd(), 'src/ui');
const RENDERING_DIR = path.resolve(process.cwd(), 'src/rendering');
const CONTENT_DIR = path.resolve(process.cwd(), 'src/content');
// Composition-root helpers, if the root is ever split out of src/main.ts (ARCHITECTURE.md §3, §7.2).
// Presentation scope for import purposes, but — unlike src/main.ts itself — never gets the
// content-pack import privilege: that stays on src/main.ts alone so the composition-root
// invariant still means something.
const MAIN_DIR = path.resolve(process.cwd(), 'src/main');

interface Violation {
  file: string;
  line: number;
  category: string;
  detail: string;
}

const violations: Violation[] = [];

function walkDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const engineFiles = walkDirectory(ENGINE_DIR);
const uiFiles = walkDirectory(UI_DIR);
const renderingFiles = walkDirectory(RENDERING_DIR);
const contentFiles = walkDirectory(CONTENT_DIR);
const mainDirFiles = walkDirectory(MAIN_DIR);

// Matches any reverse imports from ui or rendering inside engine
const ENGINE_REVERSE_IMPORT_REGEX = /from\s+['"][^'"]*(?:ui|rendering)[/'"]/i;

// In engine source files (excluding tests/fixtures), content imports are also barred
const ENGINE_SOURCE_CONTENT_IMPORT_REGEX = /from\s+['"][^'"]*content[/'"]/i;

// In content source files, imports from UI or rendering are strictly forbidden (Architecture Section 3)
const CONTENT_REVERSE_IMPORT_REGEX = /from\s+['"][^'"]*(?:ui|rendering)[/'"]/i;

const DOM_GLOBALS = [
  'window.',
  'document.',
  'navigator.',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
  'CanvasRenderingContext2D',
  'HTMLCanvasElement',
  'ImageData',
];

// Timing and audio globals: simulation code must be deterministic and headless (ARCHITECTURE.md §2),
// so it may not schedule work off the turn loop or touch audio APIs.
const TIMING_AUDIO_GLOBALS = [
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'performance.now',
  'AudioContext',
  'webkitAudioContext',
  'HTMLAudioElement',
  'new Audio',
];

// Simulation randomness must come from the engine's seeded PRNG (ARCHITECTURE.md §7.2).
// Scope is engine + content source: presentation code may use Math.random for effects that
// draw no simulation state (e.g. particle jitter in rendering/fxRunner.ts).
const SIMULATION_RANDOMNESS = ['Math.random'];

// Wall-clock reads in simulation code (ARCHITECTURE.md §7.2: no Date.now() for outcomes or
// IDs). Timestamps and the new-run entropy boundary are legitimate, so whole files are
// allowlisted with a reason in scripts/purity-clock-allowlist.json; a stale entry fails.
const WALL_CLOCK = 'Date.now(';
const CLOCK_ALLOWLIST_PATH = path.resolve(process.cwd(), 'scripts/purity-clock-allowlist.json');
const clockAllowlist: Array<{ file: string; reason: string }> = fs.existsSync(CLOCK_ALLOWLIST_PATH)
  ? JSON.parse(fs.readFileSync(CLOCK_ALLOWLIST_PATH, 'utf-8')).entries
  : [];
const clockAllowed = new Set(clockAllowlist.map((e) => e.file));
const clockAllowlistUsed = new Set<string>();

// Matches deep imports into engine internals (beyond the public engine barrel export)
const DEEP_ENGINE_IMPORT_REGEX = /from\s+['"][^'"]*engine\/[^'"]+['"]/i;

// Non-test engine/content files actually scanned for globals; test and fixture files are exempt.
const purityScannedFiles = new Set<string>();

// 1. Audit Engine & Content Purity
for (const filePath of [...engineFiles, ...contentFiles]) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const isEngine = relativePath.startsWith('src/engine/');
  const isContent = relativePath.startsWith('src/content/');
  const isTestOrFixture = relativePath.includes('__tests__') || relativePath.includes('__fixtures__');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check: Reverse Imports into Engine from UI/Rendering (forbidden in all engine files including tests)
    if (isEngine && ENGINE_REVERSE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'REVERSE_IMPORT',
        detail: line.trim(),
      });
    }

    // Check: Content imports forbidden in engine source files
    if (isEngine && !isTestOrFixture && ENGINE_SOURCE_CONTENT_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'REVERSE_IMPORT_CONTENT',
        detail: line.trim(),
      });
    }

    // Check: Content importing UI or Rendering (Architecture Section 3: Content NEVER imports UI or rendering)
    if (isContent && !isTestOrFixture && CONTENT_REVERSE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'CONTENT_REVERSE_IMPORT',
        detail: `Content package importing UI or rendering: ${line.trim()}`,
      });
    }

    // Check: Content deep imports into engine internals (ARCHITECTURE.md §2, §3).
    // Content reaches the engine only through src/engine/index.ts; test files may deep-import.
    if (isContent && !isTestOrFixture && DEEP_ENGINE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'CONTENT_DEEP_ENGINE_IMPORT',
        detail: `Content deep import bypassing engine public API barrel: ${line.trim()}`,
      });
    }

    // Check: DOM & Browser Globals (forbidden in engine and content source files)
    if (!isTestOrFixture) {
      purityScannedFiles.add(relativePath);
      for (const globalToken of DOM_GLOBALS) {
        if (line.includes(globalToken)) {
          violations.push({
            file: relativePath,
            line: lineNum,
            category: 'DOM_GLOBAL',
            detail: `Found '${globalToken}' in line: ${line.trim()}`,
          });
        }
      }

      // Check: Unseeded randomness. Full-line comments are skipped so prose may name the
      // banned call (e.g. a doc comment telling content authors not to use it).
      const trimmed = line.trimStart();
      const isCommentLine = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      // An explicit, reasoned exemption for the entropy boundary (e.g. profile ids, which
      // must not collide when two characters share a seed). Mirrors the encapsulation allowlist.
      const allowed = line.includes('purity-allow:') || (lines[i - 1] ?? '').includes('purity-allow:');
      if (!isCommentLine && !allowed) {
        for (const token of SIMULATION_RANDOMNESS) {
          if (line.includes(token)) {
            violations.push({
              file: relativePath,
              line: lineNum,
              category: 'UNSEEDED_RANDOMNESS',
              detail: `Simulation randomness must draw from engine.prng/engine.rng: ${line.trim()}`,
            });
          }
        }
      }

      if (!isCommentLine && line.includes(WALL_CLOCK)) {
        if (clockAllowed.has(relativePath)) {
          clockAllowlistUsed.add(relativePath);
        } else if (!allowed) {
          violations.push({
            file: relativePath,
            line: lineNum,
            category: 'WALL_CLOCK',
            detail: `Simulation outcomes and IDs must not read the wall clock (use engine.prng / an existing id), or allowlist a timestamp with a reason: ${line.trim()}`,
          });
        }
      }

      // Check: Timing & Audio Globals (same execution-path rule as DOM globals)
      for (const globalToken of TIMING_AUDIO_GLOBALS) {
        if (line.includes(globalToken)) {
          violations.push({
            file: relativePath,
            line: lineNum,
            category: 'TIMING_AUDIO_GLOBAL',
            detail: `Found '${globalToken}' in line: ${line.trim()}`,
          });
        }
      }
    }
  }
}

// 2. Audit UI, Rendering, and src/main/** Public API Surface (No deep imports into engine
//    internals, and no content-pack imports — src/main.ts alone keeps that privilege, see §3).
for (const filePath of [...uiFiles, ...renderingFiles, ...mainDirFiles]) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const isTestOrFixture = relativePath.includes('__tests__') || relativePath.includes('__fixtures__');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (DEEP_ENGINE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'DEEP_ENGINE_IMPORT',
        detail: `Deep import bypassing engine public API barrel: ${line.trim()}`,
      });
    }

    if (!isTestOrFixture && ENGINE_SOURCE_CONTENT_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'FORBIDDEN_CONTENT_IMPORT',
        detail: `Content pack imported outside Composition Root (src/main.ts): ${line.trim()}`,
      });
    }
  }
}

// 3. Composition root: src/main.ts is the one module that may import content packs,
// but its engine imports must still resolve through the barrel (ARCHITECTURE.md §2, §3).
const mainPath = path.resolve(process.cwd(), 'src/main.ts');
if (fs.existsSync(mainPath)) {
  const mainLines = fs.readFileSync(mainPath, 'utf-8').split(/\r?\n/);
  for (let i = 0; i < mainLines.length; i++) {
    if (DEEP_ENGINE_IMPORT_REGEX.test(mainLines[i])) {
      violations.push({
        file: 'src/main.ts',
        line: i + 1,
        category: 'DEEP_ENGINE_IMPORT',
        detail: `Deep import bypassing engine public API barrel: ${mainLines[i].trim()}`,
      });
    }
  }
}

console.log(`\n======================================================`);
console.log(`ARCHITECTURAL BOUNDARY & PURITY VERIFICATION AUDIT`);
console.log(`Engine files inspected: ${engineFiles.length}`);
console.log(`Content files inspected: ${contentFiles.length}`);
console.log(`UI files inspected: ${uiFiles.length}`);
console.log(`Rendering files inspected: ${renderingFiles.length}`);
console.log(`src/main/** files inspected: ${mainDirFiles.length}`);
console.log(`Total files inspected: ${engineFiles.length + contentFiles.length + uiFiles.length + renderingFiles.length + mainDirFiles.length}`);
console.log(`======================================================\n`);

for (const entry of clockAllowlist) {
  if (!clockAllowlistUsed.has(entry.file)) {
    violations.push({
      file: 'scripts/purity-clock-allowlist.json',
      line: 0,
      category: 'STALE_CLOCK_ALLOWLIST',
      detail: `${entry.file} no longer reads Date.now(); remove its entry.`,
    });
  }
}

if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} architectural boundary violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.category}] ${v.file}:${v.line}`);
    console.error(`    ${v.detail}\n`);
  }
  process.exit(1);
} else {
  const exemptCount = engineFiles.length + contentFiles.length - purityScannedFiles.size;
  console.log(
    `✓ Headless Simulation Purity: 0 DOM/Canvas/timing/audio globals and 0 unseeded Math.random or unallowlisted Date.now() across ${purityScannedFiles.size} engine & content source files ` +
      `(${exemptCount} test/fixture files exempt).`
  );
  console.log(`✓ Engine Boundary Isolation: 0 reverse imports in engine source and test files.`);
  console.log(`✓ Content Boundary Isolation: 0 UI/Rendering imports and 0 deep engine imports across ${contentFiles.length} content files.`);
  console.log(`✓ Public API Surface: 0 deep imports into engine internals across ${uiFiles.length + renderingFiles.length + mainDirFiles.length} UI/Rendering/src/main/** files and the composition root (src/main.ts).`);
  console.log(`✓ Composition Root Scope: 0 content-pack imports across ${mainDirFiles.length} src/main/** files (privilege stays on src/main.ts alone).`);
  console.log(`All architectural boundaries verified intact!\n`);
  process.exit(0);
}

