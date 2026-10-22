import { describe, expect, it } from 'vitest';
import { sonarReport } from '../lib/sonar-findings';

/** `npm run sonar -- <pr>` (scripts/sonar.ts) reads SonarCloud's findings from a PR's check run, through a fake gh here. */

const SHA = '75195eaf2689bef13343464d2eece4a833a3d7f2';
const SUMMARY = [
  'Issues  ',
  "![](https://sonarsource.github.io/passed.svg '') [3 New issues](https://sonarcloud.io/project/issues?id=x&pullRequest=7)  ",
  "![](https://sonarsource.github.io/accepted.svg '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=x&pullRequest=7&issueStatuses=ACCEPTED)",
  '',
  'Measures  ',
  "![](https://sonarsource.github.io/passed.svg '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=x)  ",
  "![](https://sonarsource.github.io/passed.svg '') [0.0% Coverage on New Code](https://sonarcloud.io/component_measures?id=x)  ",
  '',
  '[See analysis details on SonarQube Cloud](https://sonarcloud.io/dashboard?id=x&pullRequest=7)',
].join('\n');

const sonarRun = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: 'SonarCloud Code Analysis',
  status: 'completed',
  conclusion: 'success',
  html_url: `https://github.com/o/r/runs/${id}`,
  app: { slug: 'sonarqubecloud' },
  output: { title: 'Quality Gate passed', summary: SUMMARY },
  ...over,
});

const finding = (path: string, line: number, title: string) => ({
  path,
  start_line: line,
  title,
  message: `See more on https://sonarcloud.io/project/issues?id=x&open=AZ${line}`,
});

/** A fake gh answering the three reads; `calls` keeps every argument list it was given. */
function fakeGh(checkRuns: object[], pages: object[][] = []) {
  const calls: string[][] = [];
  const gh = (args: string[]) => {
    calls.push(args);
    if (args[0] === 'pr') return JSON.stringify({ headRefOid: SHA });
    const path = args.at(-1)!;
    if (path.includes('/commits/')) return JSON.stringify({ total_count: checkRuns.length, check_runs: checkRuns });
    if (path.includes('/annotations')) return JSON.stringify(pages);
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
  return { gh, calls };
}

describe('sonarReport', () => {
  it('asks for a PR number, calling gh not at all, for a missing or non-numeric argument', () => {
    for (const arg of [undefined, '', 'abc', '12;rm', '-1', '0', '7.5']) {
      const { gh, calls } = fakeGh([]);
      expect(sonarReport(arg, gh)).toEqual({ ok: false, lines: ['Usage: npm run sonar -- <pull request number>'] });
      expect(calls).toEqual([]);
    }
  });

  it('fails, saying so, when the PR head has no SonarCloud check run', () => {
    const { gh } = fakeGh([{ ...sonarRun(1), name: 'gates', app: { slug: 'github-actions' } }]);
    expect(sonarReport('7', gh)).toEqual({ ok: false, lines: ['PR 7 (75195eaf): no SonarCloud check run yet.'] });
  });

  it('fails, saying so, while the newest analysis is still running', () => {
    const { gh } = fakeGh([sonarRun(5), sonarRun(9, { status: 'in_progress', conclusion: null })]);
    const report = sonarReport('7', gh);
    expect(report.ok).toBe(false);
    expect(report.lines).toEqual(['PR 7 (75195eaf): SonarCloud Code Analysis is in_progress, not finished: https://github.com/o/r/runs/9']);
  });

  it('reads the newest Sonar run, matched by name or app slug, and prints gate, counts and findings by message', () => {
    const older = sonarRun(40, { output: { title: 'Quality Gate failed', summary: '' } });
    const byAppOnly = sonarRun(50, { name: 'Code Analysis' });
    const { gh, calls } = fakeGh(
      [older, byAppOnly, { ...sonarRun(99), name: 'test', app: { slug: 'github-actions' } }],
      [
        [finding('src/a.ts', 3, 'Remove this unused import.'), finding('src/b.ts', 8, 'Prefer `globalThis` over `window`.')],
        [finding('src/c.ts', 12, 'Remove this unused import.')],
      ],
    );
    expect(sonarReport('7', gh)).toEqual({
      ok: true,
      lines: [
        'PR 7 (75195eaf), Code Analysis: Quality Gate passed',
        '  3 New issues · 0 Accepted issues · 0 Security Hotspots · 0.0% Coverage on New Code',
        '  https://github.com/o/r/runs/50',
        'Findings (3):',
        '  Remove this unused import.',
        '    src/a.ts:3',
        '    src/c.ts:12',
        '  Prefer `globalThis` over `window`.',
        '    src/b.ts:8',
        'Read each flagged line and fix a finding only where the change improves that code; list each one rejected in the PR description with a one-line reason.',
      ],
    });
    expect(calls.at(-1)).toEqual(['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/check-runs/50/annotations?per_page=100']);
  });

  it('says the list is incomplete when SonarCloud counts more new issues than it sent GitHub', () => {
    const { gh } = fakeGh([sonarRun(3)], [[finding('src/a.ts', 1, 'Remove this unused import.')]]);
    const lines = sonarReport('7', gh).lines;
    expect(lines).toContain(
      'Incomplete: SonarCloud counts 3 new issues but sent GitHub 1; the rest are on sonarcloud.io, for the owner to read signed in: https://sonarcloud.io/project/issues?id=x&pullRequest=7',
    );
  });

  it('notes under S2187 that tests a shared helper creates are hidden from Sonar', () => {
    const { gh } = fakeGh([sonarRun(3)], [[finding('src/x.test.ts', 1, 'Add some tests to this file or delete it.')]]);
    const lines = sonarReport('7', gh).lines;
    expect(lines[lines.indexOf('    src/x.test.ts:1') + 1]).toBe(
      '    (S2187 cannot see tests a shared helper creates: in such a file, reject it with that reason)',
    );
  });

  it('prints "No findings." for a clean analysis with no summary links', () => {
    const { gh } = fakeGh([sonarRun(3, { output: { title: 'Quality Gate passed', summary: null } })]);
    expect(sonarReport('7', gh).lines).toEqual(['PR 7 (75195eaf), SonarCloud Code Analysis: Quality Gate passed', '  https://github.com/o/r/runs/3', 'No findings.']);
  });

  it('only reads: gh pr view and GET-only gh api calls, with no method or body flags', () => {
    const { gh, calls } = fakeGh([sonarRun(3)], [[finding('src/a.ts', 1, 'x')]]);
    sonarReport('7', gh);
    expect(calls.map((args) => args.slice(0, 2).join(' '))).toEqual(['pr view', 'api repos/{owner}/{repo}/commits/' + SHA + '/check-runs?per_page=100', 'api --paginate']);
    const writeFlags = ['-X', '--method', '-f', '-F', '--field', '--raw-field', '--input'];
    expect(calls.flat().filter((arg) => writeFlags.includes(arg))).toEqual([]);
  });
});
