import * as fs from 'node:fs';
import * as path from 'node:path';

const ENGINE_DIR = path.resolve(process.cwd(), 'src/engine');
const UI_DIR = path.resolve(process.cwd(), 'src/ui');
const RENDERING_DIR = path.resolve(process.cwd(), 'src/rendering');

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

// Matches any reverse imports from ui or rendering inside engine
const ENGINE_REVERSE_IMPORT_REGEX = /from\s+['"][^'"]*(?:ui|rendering)[/'"]/i;

// In engine source files (excluding tests/fixtures), content imports are also barred
const ENGINE_SOURCE_CONTENT_IMPORT_REGEX = /from\s+['"][^'"]*content[/'"]/i;

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

// Matches deep imports into engine internals (beyond the public engine barrel export)
const DEEP_ENGINE_IMPORT_REGEX = /from\s+['"][^'"]*engine\/[^'"]+['"]/i;

// 1. Audit Engine Purity
for (const filePath of engineFiles) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const isTestOrFixture = relativePath.includes('__tests__') || relativePath.includes('__fixtures__');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check: Reverse Imports from UI/Rendering (forbidden in all engine files including tests)
    if (ENGINE_REVERSE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'REVERSE_IMPORT',
        detail: line.trim(),
      });
    }

    // Check: Content imports forbidden in engine source files
    if (!isTestOrFixture && ENGINE_SOURCE_CONTENT_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'REVERSE_IMPORT_CONTENT',
        detail: line.trim(),
      });
    }

    // Check: DOM & Browser Globals (forbidden in engine source files)
    if (!isTestOrFixture) {
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

console.log(`\n======================================================`);
console.log(`ARCHITECTURAL BOUNDARY & PURITY VERIFICATION AUDIT`);
console.log(`Engine files inspected: ${engineFiles.length}`);
console.log(`UI files inspected: ${uiFiles.length}`);
console.log(`Rendering files inspected: ${renderingFiles.length}`);
console.log(`Total files inspected: ${engineFiles.length + uiFiles.length + renderingFiles.length}`);
console.log(`======================================================\n`);

if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} architectural boundary violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.category}] ${v.file}:${v.line}`);
    console.error(`    ${v.detail}\n`);
  }
  process.exit(1);
} else {
  console.log(`✓ Headless Simulation Purity: 0 DOM/Canvas globals across ${engineFiles.length} engine files.`);
  console.log(`✓ Boundary Isolation: 0 reverse imports in engine source and test files.`);
  console.log(`✓ Public API Surface: 0 deep imports into engine internals across ${uiFiles.length + renderingFiles.length} UI/Rendering files.`);
  console.log(`All architectural boundaries verified intact!\n`);
  process.exit(0);
}
