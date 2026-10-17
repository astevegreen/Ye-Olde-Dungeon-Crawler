/**
 * Waits for the GitHub run a push to main starts (deploy.yml: the gates and the browser tests,
 * then the Pages deploy once both pass) and reports how it ended (CLAUDE.md, Pushing). The hooks
 * run on Windows and CI on Linux, where a test can fail that passes locally: f36f4b7c's deploy
 * failed that way unnoticed.
 *
 * Usage: npm run ci:watch [-- <sha>]   (default HEAD). Exits 0 only when the run succeeded.
 */
import { execFileSync } from 'node:child_process';

const WORKFLOW = 'deploy.yml';
const DEPLOY_STEP = 'Deploy to GitHub Pages';
const FIND_WITHIN_MS = 3 * 60_000; // a run is listed seconds after the push lands
const FINISH_WITHIN_MS = 30 * 60_000;
const POLL_MS = 15_000;

interface Run {
  databaseId: number;
  status: string;
  conclusion: string;
  url: string;
}

interface Job {
  name: string;
  steps: { name: string; conclusion: string }[];
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function latestRun(sha: string): Run | undefined {
  const json = run('gh', ['run', 'list', '--workflow', WORKFLOW, '--commit', sha, '--limit', '1', '--json', 'databaseId,status,conclusion,url']);
  return (JSON.parse(json) as Run[])[0];
}

function jobsOf(current: Run): Job[] {
  return (JSON.parse(run('gh', ['run', 'view', String(current.databaseId), '--json', 'jobs'])) as { jobs: Job[] }).jobs;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function watch(sha: string): Promise<boolean> {
  const start = Date.now();
  let current = latestRun(sha);
  while (!current) {
    if (Date.now() - start > FIND_WITHIN_MS) {
      console.log(`${WORKFLOW}: no run for ${sha.slice(0, 8)} after ${FIND_WITHIN_MS / 60_000} min (was it pushed to main?)`);
      return false;
    }
    await sleep(POLL_MS);
    current = latestRun(sha);
  }
  while (current.status !== 'completed') {
    if (Date.now() - start > FINISH_WITHIN_MS) {
      console.log(`${WORKFLOW}: still ${current.status} after ${FINISH_WITHIN_MS / 60_000} min: ${current.url}`);
      return false;
    }
    await sleep(POLL_MS);
    current = latestRun(sha) ?? current;
  }
  const jobs = jobsOf(current);
  if (current.conclusion === 'success') {
    const deployed = jobs.some((job) => job.steps.some((step) => step.name === DEPLOY_STEP && step.conclusion === 'success'));
    console.log(`${WORKFLOW}: success${deployed ? ', deployed' : ', not deployed: a newer push to main deploys instead'}`);
    return true;
  }
  const failedSteps = jobs
    .flatMap((job) => job.steps.filter((step) => step.conclusion === 'failure').map((step) => `${job.name}: ${step.name}`))
    .join(', ');
  console.log(`${WORKFLOW}: ${current.conclusion}${failedSteps ? ` in "${failedSteps}"` : ''}: ${current.url}`);
  console.log(`  read it: gh run view ${current.databaseId} --log-failed`);
  return false;
}

const sha = process.argv[2] ?? run('git', ['rev-parse', 'HEAD']);
process.exit((await watch(sha)) ? 0 : 1);
