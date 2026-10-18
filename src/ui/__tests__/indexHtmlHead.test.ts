import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('index.html head', () => {
  it('declares its icon inline, so the browser never requests a missing /favicon.ico', () => {
    const html = readFileSync('index.html', 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toMatch(/<link rel="icon" href="data:[^"]*"/);
  });
});
