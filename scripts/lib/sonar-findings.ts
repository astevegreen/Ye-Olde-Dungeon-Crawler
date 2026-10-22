/**
 * A pull request's SonarCloud findings, read from GitHub: SonarCloud's app posts each analysis to the PR
 * as a check run, one annotation per finding. GitHub serves them to anyone who can read the repo, so no
 * SonarCloud token is needed, and every request is a GET with a fixed shape, so one allow rule covers
 * every run (`npm run sonar -- <pr>`, scripts/sonar.ts).
 */

/** Runs `gh` with an argument array (no shell) and returns its stdout; throws when gh fails. */
type Gh = (args: string[]) => string;

interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  app?: { slug?: string } | null;
  output?: { title?: string | null; summary?: string | null } | null;
}

interface Annotation {
  path: string;
  start_line: number;
  title?: string | null;
  message?: string | null;
}

interface Link {
  text: string;
  url: string;
}

interface SonarReport {
  ok: boolean; // false: bad argument, no Sonar check run, or one still running
  lines: string[];
}

// Printed with the findings, where the agent judging them reads it.
const TRIAGE =
  'Read each flagged line and fix a finding only where the change improves that code; list each one rejected in the PR description with a one-line reason.';
const HELPER_BUILT_TESTS = /Add some tests to this file/i;

const isSonar = (run: CheckRun) => /sonar/i.test(run.name) || /sonar/i.test(run.app?.slug ?? '');

/** The summary's text links ("3 New issues", "0.0% Coverage on New Code"), images and the details link left out. */
function summaryLinks(summary: string): Link[] {
  return [...summary.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)/g)]
    .map(([, text, url]) => ({ text: text!.trim(), url: url! }))
    .filter((link) => /^\d/.test(link.text));
}

/** Findings grouped by message, the most frequent first; each lists its `path:line`s. */
function groupByMessage(annotations: Annotation[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const annotation of annotations) {
    const message = annotation.title?.trim() || annotation.message?.trim() || '(no message)';
    const where = `${annotation.path}:${annotation.start_line}`;
    groups.set(message, [...(groups.get(message) ?? []), where]);
  }
  return [...groups].sort((a, b) => b[1].length - a[1].length);
}

export function sonarReport(prArg: string | undefined, gh: Gh): SonarReport {
  if (!prArg || !/^[1-9]\d*$/.test(prArg)) {
    return { ok: false, lines: ['Usage: npm run sonar -- <pull request number>'] };
  }
  const sha = (JSON.parse(gh(['pr', 'view', prArg, '--json', 'headRefOid'])) as { headRefOid: string }).headRefOid;
  const runs = (JSON.parse(gh(['api', `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`])) as { check_runs: CheckRun[] })
    .check_runs.filter(isSonar);
  const short = sha.slice(0, 8);
  if (runs.length === 0) {
    return { ok: false, lines: [`PR ${prArg} (${short}): no SonarCloud check run yet.`] };
  }
  const run = runs.reduce((newest, candidate) => (candidate.id > newest.id ? candidate : newest));
  if (run.status !== 'completed') {
    return { ok: false, lines: [`PR ${prArg} (${short}): ${run.name} is ${run.status}, not finished: ${run.html_url}`] };
  }

  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/check-runs/${run.id}/annotations?per_page=100`])) as Annotation[][];
  const annotations = pages.flat();
  const links = summaryLinks(run.output?.summary ?? '');
  const gate = run.output?.title?.trim() || `no quality gate result (${run.conclusion ?? 'no conclusion'})`;
  const lines = [`PR ${prArg} (${short}), ${run.name}: ${gate}`];
  if (links.length > 0) lines.push(`  ${links.map((link) => link.text).join(' · ')}`);
  lines.push(`  ${run.html_url}`);

  const newIssues = links.find((link) => /^\d+ New issues?$/i.test(link.text));
  const counted = newIssues ? parseInt(newIssues.text, 10) : undefined;
  if (counted !== undefined && counted > annotations.length) {
    lines.push(
      `Incomplete: SonarCloud counts ${counted} new issues but sent GitHub ${annotations.length}; the rest are on sonarcloud.io, for the owner to read signed in: ${newIssues!.url}`,
    );
  }
  if (annotations.length === 0) {
    lines.push('No findings.');
    return { ok: true, lines };
  }
  lines.push(`Findings (${annotations.length}):`);
  for (const [message, places] of groupByMessage(annotations)) {
    lines.push(`  ${message}`, ...places.map((place) => `    ${place}`));
    if (HELPER_BUILT_TESTS.test(message)) {
      lines.push('    (S2187 cannot see tests a shared helper creates: in such a file, reject it with that reason)');
    }
  }
  lines.push(TRIAGE);
  return { ok: true, lines };
}
