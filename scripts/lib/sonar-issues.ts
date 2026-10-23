/**
 * The project's open SonarCloud issues on `main`, read from SonarCloud's public API: the project is public, so
 * anonymous GETs answer and no token is read, sent or asked for. Every request is a GET of `api/issues/search`
 * on one fixed project key (plus `api/components/show` to tell an empty project from an unreadable one), so one
 * allow rule covers every run (`npm run sonar:issues`, scripts/sonar-issues.ts). A pull request's findings are
 * `npm run sonar -- <pr>` (scripts/lib/sonar-findings.ts).
 */

/** One anonymous GET: the status and body; rejects only when the network fails. */
type Get = (url: string) => Promise<{ status: number; body: string }>;

interface Issue {
  severity: string;
  type: string;
  rule: string;
  component: string; // "<project key>:<path>"
  line?: number;
  message: string;
}

interface SonarIssuesReport {
  ok: boolean; // false: bad argument, project unreadable, or network failure
  lines: string[];
}

const PROJECT_KEY = 'astevegreen_Ye-Olde-Dungeon-Crawler';
const API = 'https://sonarcloud.io/api';
const LIMIT = 50; // issues printed; the rest are counted, not listed
const USAGE = 'Usage: npm run sonar:issues [-- --files <path>...]   (default: BLOCKER and CRITICAL issues on main)';
const REPO_PATH = /^[\w.@/+-]+$/;

/** `--files` paths, repo-relative with forward slashes; undefined when the arguments are not the default mode or `--files <path>...`. */
function parseFiles(args: string[]): string[] | undefined | 'bad' {
  if (args.length === 0) return undefined;
  if (args[0] !== '--files' || args.length === 1) return 'bad';
  const paths = args.slice(1).map((arg) => arg.replace(/\\/g, '/').replace(/^\.\//, ''));
  return paths.every((path) => REPO_PATH.test(path)) ? paths : 'bad';
}

const unreadable = (status: number) => [
  `SonarCloud project ${PROJECT_KEY} is not readable anonymously (HTTP ${status}): it has probably turned private or been renamed.`,
  'Sessions hold no SonarCloud token; tell the owner.',
];

export async function sonarIssues(args: string[], get: Get): Promise<SonarIssuesReport> {
  const files = parseFiles(args);
  if (files === 'bad') return { ok: false, lines: [USAGE] };

  // File components are keyed "<project key>:<path>"; the `files` parameter is ignored, so only these keys scope the answer.
  const components = files ? files.map((path) => `${PROJECT_KEY}:${path}`).join(',') : PROJECT_KEY;
  const filter = files ? '' : '&severities=BLOCKER,CRITICAL';
  const url = `${API}/issues/search?componentKeys=${encodeURIComponent(components)}&branch=main&resolved=false${filter}&s=SEVERITY&asc=false&ps=${LIMIT}`;
  const response = await get(url);
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { ok: false, lines: unreadable(response.status) };
  }
  if (response.status !== 200) return { ok: false, lines: [`SonarCloud answered HTTP ${response.status} for ${url}`] };

  const { total, issues } = JSON.parse(response.body) as { total: number; issues: Issue[] };
  if (files && issues.some((issue) => !files.some((path) => issue.component === `${PROJECT_KEY}:${path}`))) {
    return { ok: false, lines: ['SonarCloud answered for more than the files asked; nothing printed.'] };
  }
  if (files && issues.some((issue) => !files.some((path) => issue.component === `${PROJECT_KEY}:${path}`))) {
    return { ok: false, lines: ['SonarCloud ignored the file scope and answered for the whole project; nothing printed.'] };
  }
  // A private or unknown project also answers 200 with no issues, so an empty result is checked against the project itself.
  if (total === 0) {
    const project = await get(`${API}/components/show?component=${PROJECT_KEY}`);
    if (project.status !== 200) return { ok: false, lines: unreadable(project.status) };
  }

  const scope = files ? `any severity in ${files.join(', ')}` : 'BLOCKER and CRITICAL';
  const lines = [`${PROJECT_KEY} main, ${scope}: ${total} open`];
  for (const issue of issues) {
    const path = issue.component.slice(PROJECT_KEY.length + 1);
    const where = issue.line === undefined ? path : `${path}:${issue.line}`;
    lines.push(`${issue.severity} ${issue.type} ${issue.rule} ${where} ${issue.message}`);
  }
  if (total > issues.length) {
    lines.push(`${total - issues.length} more not listed${files ? '' : '; --files <path>... lists a file\'s issues of any severity'}.`);
  }
  return { ok: true, lines };
}
