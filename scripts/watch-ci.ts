/**
 * Waits for the GitHub runs a push to main starts (the Pages deploy and the CI browser tests)
 * and reports how each ended (CLAUDE.md, Pushing). The hooks run on Windows and these on Linux,
 * where a test can fail that passes locally: f36f4b7c's deploy failed that way unnoticed.
 *
 * Usage: npm run ci:watch [-- <sha>]   (default HEAD). Exits 0 only when every run succeeded.
 */
import { execFileSync } from 'node:child_process';

const WORKFLOWS = ['deploy.yml', 'playwright.yml'];
const FIND_WITHIN_MS = 3 * 60_000; // a run is listed seconds after the push lands
const FINISH_WITHIN_MS = 30 * 60_000;
const POLL_MS = 15_000;

interface Run {
  databaseId: number;
  status: string;
  conclusion: string;
  url: string;
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function latestRun(workflow: string, sha: string): Run | undefined {
  const json = run('gh', ['run', 'list', '--workflow', workflow, '--commit', sha, '--limit', '1', '--json', 'databaseId,status,conclusion,url']);
  return (JSON.parse(json) as Run[])[0];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function watch(workflow: string, sha: string): Promise<boolean> {
  const start = Date.now();
  let current = latestRun(workflow, sha);
  while (!current) {
    if (Date.now() - start > FIND_WITHIN_MS) {
      console.log(`${workflow}: no run for ${sha.slice(0, 8)} after ${FIND_WITHIN_MS / 60_000} min (was it pushed to main?)`);
      return false;
    }
    await sleep(POLL_MS);
    current = latestRun(workflow, sha);
  }
  while (current.status !== 'completed') {
    if (Date.now() - start > FINISH_WITHIN_MS) {
      console.log(`${workflow}: still ${current.status} after ${FINISH_WITHIN_MS / 60_000} min: ${current.url}`);
      return false;
    }
    await sleep(POLL_MS);
    current = latestRun(workflow, sha) ?? current;
  }
  if (current.conclusion === 'success') {
    console.log(`${workflow}: success`);
    return true;
  }
  const failedSteps = run('gh', [
    'run', 'view', String(current.databaseId), '--json', 'jobs',
    '--jq', '[.jobs[].steps[] | select(.conclusion == "failure") | .name] | join(", ")',
  ]);
  console.log(`${workflow}: ${current.conclusion}${failedSteps ? ` in "${failedSteps}"` : ''}: ${current.url}`);
  console.log(`  read it: gh run view ${current.databaseId} --log-failed`);
  return false;
}

const sha = process.argv[2] ?? run('git', ['rev-parse', 'HEAD']);
const results = await Promise.all(WORKFLOWS.map((workflow) => watch(workflow, sha)));
process.exit(results.every(Boolean) ? 0 : 1);
