/**
 * Maps positions in a bug report's stack trace (`…/:2187:14979`) back to source.
 *
 *   npm run map:stack -- <build-id> "<stack text>"     downloads that deploy's source maps
 *   npm run map:stack -- --dir <folder> "<stack text>"  uses a local folder (html + .js.map)
 *
 * The deploy workflow builds with hidden source maps and keeps them, with the deployed
 * HTML, as the `sourcemaps-<full sha>` artifact (90 days). The bundle is one HTML file
 * with the JS inlined, so a stack position is an HTML line/column; this finds where the
 * inlined script starts and converts to the chunk's own position before the lookup.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RawMap {
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes a mappings string into per-line segments [genCol, src, line, col, name?]. */
function decodeMappings(mappings: string): number[][][] {
  const lines: number[][][] = [];
  let src = 0, oLine = 0, oCol = 0, name = 0;
  for (const lineStr of mappings.split(';')) {
    const segs: number[][] = [];
    let gCol = 0;
    for (const segStr of lineStr.split(',')) {
      if (!segStr) continue;
      const vals: number[] = [];
      let shift = 0, value = 0;
      for (const ch of segStr) {
        const digit = B64.indexOf(ch);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          vals.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      gCol += vals[0];
      const seg = [gCol];
      if (vals.length >= 4) {
        src += vals[1]; oLine += vals[2]; oCol += vals[3];
        seg.push(src, oLine, oCol);
        if (vals.length >= 5) {
          name += vals[4];
          seg.push(name);
        }
      }
      segs.push(seg);
    }
    lines.push(segs);
  }
  return lines;
}

/** Where the largest inline <script> starts, as a 1-based line and 0-based column. */
function scriptStart(html: string): { line: number; col: number } {
  let best = { start: -1, length: -1 };
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1].length > best.length) best = { start: m.index + m[0].indexOf('>') + 1, length: m[1].length };
  }
  if (best.start < 0) throw new Error('no inline <script> found in the HTML');
  const before = html.slice(0, best.start);
  const line = before.split('\n').length;
  return { line, col: best.start - (before.lastIndexOf('\n') + 1) };
}

function fetchArtifact(buildId: string): string {
  const sha = buildId.replace(/-dirty$/, '');
  if (sha !== buildId) console.warn(`! ${buildId} was built from uncommitted changes; mapping against ${sha} may be off.`);
  const full = execSync(`git rev-parse ${sha}`, { encoding: 'utf-8' }).trim();
  const dir = mkdtempSync(join(tmpdir(), 'yodc-sourcemaps-'));
  execSync(`gh run download --name sourcemaps-${full} --dir "${dir}"`, { stdio: 'inherit' });
  return dir;
}

/** Every folder under `root` that holds an .html file and a .js.map. */
function findBundles(root: string): Array<{ html: string; map: string; name: string }> {
  const out: Array<{ html: string; map: string; name: string }> = [];
  const walk = (dir: string): void => {
    const entries = readdirSync(dir);
    const html = entries.find((e) => e.endsWith('.html'));
    const map = entries.find((e) => e.endsWith('.js.map'));
    if (html && map) out.push({ html: join(dir, html), map: join(dir, map), name: dir });
    for (const e of entries) if (statSync(join(dir, e)).isDirectory()) walk(join(dir, e));
  };
  walk(root);
  return out;
}

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--dir');
let root: string;
let stack: string;
if (dirFlag >= 0) {
  root = args[dirFlag + 1];
  stack = args.filter((_, i) => i !== dirFlag && i !== dirFlag + 1).join(' ');
} else {
  if (args.length < 2) {
    console.error('usage: npm run map:stack -- <build-id> "<stack>"  |  --dir <folder> "<stack>"');
    process.exit(2);
  }
  root = fetchArtifact(args[0]);
  stack = args.slice(1).join(' ');
}
if (!existsSync(root)) {
  console.error(`✗ ${root} does not exist`);
  process.exit(1);
}

const positions = [...stack.matchAll(/:(\d+):(\d+)/g)].map((m) => ({ line: Number(m[1]), col: Number(m[2]) }));
if (positions.length === 0) {
  console.error('✗ no line:column positions found in the stack text');
  process.exit(2);
}

for (const bundle of findBundles(root)) {
  const map = JSON.parse(readFileSync(bundle.map, 'utf-8')) as RawMap;
  const lines = decodeMappings(map.mappings);
  const start = scriptStart(readFileSync(bundle.html, 'utf-8'));
  console.log(`\n${bundle.name} (script starts at line ${start.line}, column ${start.col})`);
  for (const pos of positions) {
    // Stack columns are 1-based; the first script line shares its HTML line with the tag.
    const gLine = pos.line - start.line;
    const gCol = pos.col - 1 - (gLine === 0 ? start.col : 0);
    const segs = lines[gLine] ?? [];
    let hit: number[] | undefined;
    for (const s of segs) if (s[0] <= gCol && s.length >= 4) hit = s;
    if (!hit) {
      console.log(`  ${pos.line}:${pos.col} -> (no mapping)`);
      continue;
    }
    const [, src, oLine, oCol, name] = hit;
    const file = map.sources[src].replace(/^(\.\.\/)+/, '').replace(/^.*?\/(?=src\/)/, '');
    const text = map.sourcesContent?.[src]?.split('\n')[oLine]?.trim() ?? '';
    console.log(`  ${pos.line}:${pos.col} -> ${file}:${oLine + 1}:${oCol + 1}${name !== undefined ? ` (${map.names[name]})` : ''}`);
    if (text) console.log(`      ${text.slice(0, 140)}`);
  }
}
