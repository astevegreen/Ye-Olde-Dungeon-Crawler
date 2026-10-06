import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { colorLiterals } from '../check-ui-palette';
import { THEME_CSS_VARIABLES } from '../../src/rendering/theme';

describe('check:ui-palette', () => {
  it('counts hex and rgb/hsl colors, not black, white or HTML entities', () => {
    const text = `
      color: #f59e0b; border: 1px solid #333; background: rgba(245, 158, 11, 0.4);
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8); color: #fff; color: #000000;
      <span>&#128202;</span> <div id="add"></div> hsl(200, 50%, 50%)`;
    expect(colorLiterals(text)).toEqual(['#f59e0b', '#333', 'rgba(245, 158, 11, 0.4)', 'hsl(200, 50%, 50%)']);
  });

  it('counts 4-digit hex, the CSS Color 4 functions and 0xRRGGBB, not black or white in those forms', () => {
    // R-tool-6: these colors passed uncounted.
    const text = `
      el.style.cssText = 'color: #f59b; background: oklch(70% 0.1 200); border-color: lab(50% 40 59.5)';
      ctx.fillStyle = 'hwb(194 0% 0%)'; const c = 'lch(52% 72 56)'; const d = 'oklab(0.7 0.1 0.1)';
      fill: color(display-p3 1 0.5 0); const tint = 0xf59e0b;
      stroke: rgb(0 0 0 / 50%); outline: #0000; caret-color: #ffff; const white = 0xffffff;
      theme.color('accent'); const lab = (n: number) => n;`;
    expect(colorLiterals(text)).toEqual([
      '#f59b',
      'oklch(70% 0.1 200)',
      'lab(50% 40 59.5)',
      'hwb(194 0% 0%)',
      'lch(52% 72 56)',
      'oklab(0.7 0.1 0.1)',
      'color(display-p3 1 0.5 0)',
      '0xf59e0b',
    ]);
  });
});

/**
 * Every `--ui-*` variable presentation code reads is defined: either written by
 * applyThemeTokens() or declared in tokens.css. Variables read but never set
 * (`--ui-modal-bg`, `--ui-card-border`) once survived on silent fallbacks.
 */
describe('--ui-* variables', () => {
  const ROOT = process.cwd();
  const walk = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(rel);
      return /\.(ts|css)$/.test(e.name) ? [rel] : [];
    });

  it('are all defined', () => {
    const tokensCss = fs.readFileSync(path.join(ROOT, 'src/ui/styles/tokens.css'), 'utf-8');
    const defined = new Set<string>([
      ...THEME_CSS_VARIABLES.map(([name]) => name),
      ...[...tokensCss.matchAll(/(--ui-[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
    ]);
    const files = [...walk('src/ui'), ...walk('src/rendering'), 'src/main.ts', 'index.html'];
    const undefinedUses: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      for (const m of text.matchAll(/var\((--ui-[a-z0-9-]+)/g)) {
        if (!defined.has(m[1])) undefinedUses.push(`${file}: ${m[1]}`);
      }
      // Template strings build `var(--ui-${role})`; the roles themselves are checked where they are written.
    }
    expect(undefinedUses).toEqual([]);
  });
});
