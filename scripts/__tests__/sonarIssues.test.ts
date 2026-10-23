import { describe, expect, it } from 'vitest';
import { sonarIssues } from '../lib/sonar-issues';

/** `npm run sonar:issues` (scripts/sonar-issues.ts) reads the project's open issues from SonarCloud's public API, through a fake GET here. */

const KEY = 'astevegreen_Ye-Olde-Dungeon-Crawler';

const issue = (severity: string, type: string, rule: string, path: string, line: number | undefined, message: string) => ({
  severity,
  type,
  rule,
  component: `${KEY}:${path}`,
  line,
  message,
});

/** A fake GET: `routes` maps a URL fragment to its answer; `urls` keeps every URL it was asked for. */
function fakeGet(routes: Record<string, { status: number; body: unknown }>) {
  const urls: string[] = [];
  const get = async (url: string) => {
    urls.push(url);
    const hit = Object.entries(routes).find(([fragment]) => url.includes(fragment));
    if (!hit) throw new Error(`unexpected GET ${url}`);
    return { status: hit[1].status, body: JSON.stringify(hit[1].body) };
  };
  return { get, urls };
}

const found = (total: number, issues: object[]) => ({ '/issues/search': { status: 200, body: { total, issues } } });

describe('sonarIssues', () => {
  it('lists BLOCKER and CRITICAL issues of main by default, one line each, behind a total', async () => {
    const { get, urls } = fakeGet(
      found(2, [
        issue('BLOCKER', 'BUG', 'javascript:S2189', 'scripts/capture/menus.mjs', 49, "'ih' is not modified in this loop."),
        issue('CRITICAL', 'CODE_SMELL', 'typescript:S3776', 'src/a.ts', undefined, 'Refactor this function.'),
      ]),
    );
    expect(await sonarIssues([], get)).toEqual({
      ok: true,
      lines: [
        `${KEY} main, BLOCKER and CRITICAL: 2 open`,
        "BLOCKER BUG javascript:S2189 scripts/capture/menus.mjs:49 'ih' is not modified in this loop.",
        'CRITICAL CODE_SMELL typescript:S3776 src/a.ts Refactor this function.',
      ],
    });
    expect(urls).toEqual([
      `https://sonarcloud.io/api/issues/search?componentKeys=${KEY}&branch=main&resolved=false&severities=BLOCKER,CRITICAL&s=SEVERITY&asc=false&ps=50`,
    ]);
  });

  it('with --files asks for just those files, of any severity, and normalises their paths', async () => {
    const { get, urls } = fakeGet(found(1, [issue('MINOR', 'CODE_SMELL', 'typescript:S1481', 'src/engine/x.ts', 7, 'Remove this unused variable.')]));
    const report = await sonarIssues(['--files', '.\\src\\engine\\x.ts', 'src/ui/y.ts'], get);
    expect(report.lines).toEqual([
      `${KEY} main, any severity in src/engine/x.ts, src/ui/y.ts: 1 open`,
      'MINOR CODE_SMELL typescript:S1481 src/engine/x.ts:7 Remove this unused variable.',
    ]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`componentKeys=${encodeURIComponent(`${KEY}:src/engine/x.ts,${KEY}:src/ui/y.ts`)}&`);
    expect(urls[0]).not.toContain('severities=');
  });

  it('prints nothing when the answer reaches past the files asked', async () => {
    const { get } = fakeGet(found(2, [issue('MINOR', 'CODE_SMELL', 'r', 'src/other.ts', 1, 'm')]));
    const report = await sonarIssues(['--files', 'src/a.ts'], get);
    expect(report).toEqual({ ok: false, lines: ['SonarCloud answered for more than the files asked; nothing printed.'] });
  });

  it('says how many more it left out when the total passes the page', async () => {
    const { get } = fakeGet(found(351, [issue('CRITICAL', 'BUG', 'r', 'src/a.ts', 1, 'm')]));
    const lines = (await sonarIssues([], get)).lines;
    expect(lines.at(-1)).toBe("350 more not listed; --files <path>... lists a file's issues of any severity.");
  });

  it('with no open issues, confirms the project is readable before saying so', async () => {
    const { get, urls } = fakeGet({ ...found(0, []), '/components/show': { status: 200, body: { component: { key: KEY } } } });
    expect(await sonarIssues([], get)).toEqual({ ok: true, lines: [`${KEY} main, BLOCKER and CRITICAL: 0 open`] });
    expect(urls[1]).toBe(`https://sonarcloud.io/api/components/show?component=${KEY}`);
  });

  it.each([401, 403, 404])('fails saying the project is unreadable on HTTP %i from the search', async (status) => {
    const { get } = fakeGet({ '/issues/search': { status, body: {} } });
    const report = await sonarIssues([], get);
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toContain(`not readable anonymously (HTTP ${status})`);
    expect(report.lines[1]).toContain('tell the owner');
  });

  it('fails the same way when an empty answer hides a project that is private or gone', async () => {
    const { get } = fakeGet({ ...found(0, []), '/components/show': { status: 404, body: {} } });
    const report = await sonarIssues([], get);
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toContain('not readable anonymously (HTTP 404)');
  });

  it('reports any other status without guessing', async () => {
    const { get } = fakeGet({ '/issues/search': { status: 500, body: {} } });
    const report = await sonarIssues([], get);
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toContain('HTTP 500');
  });

  it.each([['--files'], ['--bogus'], ['--files', 'a b.ts'], ['--files', 'x;rm.ts'], ['src/a.ts']])('rejects the arguments %j with the usage line, asking nothing', async (...args) => {
    const { get, urls } = fakeGet({});
    const report = await sonarIssues(args, get);
    expect(report.ok).toBe(false);
    expect(report.lines[0]).toMatch(/^Usage: npm run sonar:issues/);
    expect(urls).toEqual([]);
  });
});
