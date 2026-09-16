import * as fs from 'node:fs';
import * as path from 'node:path';

const ENGINE_DIR = path.resolve(process.cwd(), 'src/engine');
const UI_DIR = path.resolve(process.cwd(), 'src/ui');
const RENDERING_DIR = path.resolve(process.cwd(), 'src/rendering');
const CONTENT_DIR = path.resolve(process.cwd(), 'src/content');

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

// 2. Audit UI and Rendering Public API Surface (No deep imports into engine internals)
for (const filePath of [...uiFiles, ...renderingFiles]) {
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
console.log(`Total files inspected: ${engineFiles.length + contentFiles.length + uiFiles.length + renderingFiles.length}`);
console.log(`======================================================\n`);

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
    `✓ Headless Simulation Purity: 0 DOM/Canvas/timing/audio globals across ${purityScannedFiles.size} engine & content source files ` +
      `(${exemptCount} test/fixture files exempt).`
  );
  console.log(`✓ Engine Boundary Isolation: 0 reverse imports in engine source and test files.`);
  console.log(`✓ Content Boundary Isolation: 0 UI/Rendering imports across ${contentFiles.length} content files.`);
  console.log(`✓ Public API Surface: 0 deep imports into engine internals across ${uiFiles.length + renderingFiles.length} UI/Rendering files and the composition root (src/main.ts).`);
  console.log(`All architectural boundaries verified intact!\n`);
  process.exit(0);
}

