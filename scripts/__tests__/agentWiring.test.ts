import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The frontmatter of every Claude agent and skill in `.claude/`, and the sprint's wiring (docs/sprint.md,
 * Machinery): each unattended skill and agent keeps its guard mode and its model. An edit that drops a
 * guard hook leaves an unattended session unguarded, and nothing else would notice.
 */

const ROOT = path.resolve(__dirname, '../..');
const AGENTS = fs.readdirSync(path.join(ROOT, '.claude/agents')).filter((f) => f.endsWith('.md')).map((f) => `.claude/agents/${f}`);
const SKILLS = fs
  .readdirSync(path.join(ROOT, '.claude/skills'))
  .filter((d) => fs.existsSync(path.join(ROOT, '.claude/skills', d, 'SKILL.md')))
  .map((d) => `.claude/skills/${d}/SKILL.md`);

function frontmatter(file: string): string[] {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  return m ? m[1]!.split(/\r?\n/) : [];
}
const value = (lines: string[], key: string) => lines.find((l) => l.startsWith(`${key}:`))?.slice(key.length + 1).trim();

/** Each `- matcher: "<tools>"` hook block's sprint-guard mode. */
function guards(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let matcher: string | null = null;
  for (const line of lines) {
    const m = /^\s*- matcher:\s*"([^"]+)"/.exec(line);
    if (m) matcher = m[1]!;
    const g = /sprint-guard\.mjs"?\s+(--[a-z-]+)/.exec(line);
    if (g && matcher) out[matcher] = g[1]!;
  }
  return out;
}

/** The sessions and helpers that run with nobody watching. */
const WIRING: Record<string, { model: string; guards: Record<string, string> }> = {
  '.claude/skills/sprint-supervisor/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-lane/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-plan/SKILL.md': { model: 'opus', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-research/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-integrate/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--integrator', 'mcp__plugin_github_.*': '--integrator' } },
  '.claude/skills/sprint-status/SKILL.md': { model: 'sonnet', guards: {} },
  '.claude/skills/sprint-start/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-stop/SKILL.md': { model: 'sonnet', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/skills/sprint-archive/SKILL.md': { model: 'haiku', guards: { 'Bash|PowerShell': '--lane', 'mcp__plugin_github_.*': '--lane' } },
  '.claude/agents/implementer.md': { model: 'opus', guards: { 'Edit|Write': '--file-lock', 'Bash|PowerShell': '--lane' } },
  '.claude/agents/reviewer.md': { model: 'opus', guards: { 'Bash|PowerShell': '--read-only' } },
};

describe('agent and skill frontmatter', () => {
  it.each([...AGENTS, ...SKILLS])('%s has a name and a description', (file) => {
    const lines = frontmatter(file);
    expect(value(lines, 'name')).toBeTruthy();
    expect(value(lines, 'description')).toBeTruthy();
  });

  it.each([...AGENTS, ...SKILLS])('%s: no unquoted top-level value holds ": " or " #"', (file) => {
    // Strict YAML reads `a: b: c` as a nested mapping and refuses it, and cuts a value at ` #` (#71).
    const bad = frontmatter(file).filter((l) => {
      const m = /^[A-Za-z][\w-]*:\s+(.*)$/.exec(l);
      return m && !/^["'>|[{]/.test(m[1]!) && /: | #/.test(m[1]!);
    });
    expect(bad).toEqual([]);
  });
});

describe('sprint wiring', () => {
  it('every sprint skill is listed here, so a new one declares its guard', () => {
    const sprintSkills = SKILLS.filter((f) => /\/sprint-[^/]+\//.test(f));
    expect(sprintSkills.filter((f) => !(f in WIRING))).toEqual([]);
  });

  it.each(AGENTS.filter((f) => f in WIRING))('%s lists its tools, so no connector or plugin tool reaches it', (file) => {
    expect(value(frontmatter(file), 'tools')).toMatch(/^[A-Za-z, ]+$/);
  });

  it.each(Object.entries(WIRING))('%s keeps its model and guard modes', (file, want) => {
    const lines = frontmatter(file);
    expect(value(lines, 'model')).toBe(want.model);
    expect(guards(lines)).toEqual(want.guards);
  });
});
