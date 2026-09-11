import * as fs from 'node:fs';
import * as path from 'node:path';

const ENGINE_DIR = path.resolve(process.cwd(), 'src/engine');

interface Violation {
  file: string;
  line: number;
  category: string;
  detail: string;
}

const violations: Violation[] = [];

function walkDirectory(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__fixtures__') {
        continue;
      }
      walkDirectory(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const engineFiles = walkDirectory(ENGINE_DIR);

// Matches any imports from ui, rendering, or content directories
const REVERSE_IMPORT_REGEX = /from\s+['"][^'"]*(?:ui|rendering|content)[/'"]/i;

const DOM_GLOBALS = [
  'window.',
  'document.',
  'navigator.',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
];

for (const filePath of engineFiles) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Check 1: Reverse Imports
    if (REVERSE_IMPORT_REGEX.test(line)) {
      violations.push({
        file: relativePath,
        line: lineNum,
        category: 'REVERSE_IMPORT',
        detail: line.trim(),
      });
    }

    // Check 2: DOM & Browser Globals
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

console.log(`\n======================================================`);
console.log(`ENGINE PURITY VERIFICATION AUDIT`);
console.log(`Files inspected: ${engineFiles.length}`);
console.log(`======================================================\n`);

if (violations.length > 0) {
  console.error(`❌ Found ${violations.length} engine purity violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.category}] ${v.file}:${v.line}`);
    console.error(`    ${v.detail}\n`);
  }
  process.exit(1);
} else {
  console.log(`✓ Engine Purity: 0 reverse imports, 0 DOM globals across ${engineFiles.length} engine source files.`);
  console.log(`All architectural boundaries verified intact!\n`);
  process.exit(0);
}
