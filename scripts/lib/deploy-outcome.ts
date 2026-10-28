/** How a green deploy.yml run ended for players, from its jobs (`gh run view --json jobs`; scripts/watch-ci.ts). */
export interface Job {
  name: string;
  conclusion?: string;
  steps: { name: string; conclusion: string }[];
}

export const DEPLOY_STEP = 'Deploy to GitHub Pages';

/**
 * A push that ships nothing skips the `deploy` job (scripts/lib/deploy-scope.mjs); one that ships but was overtaken
 * skips only the deploy step, since a newer push deploys itself.
 */
export function deployOutcome(jobs: Job[]): string {
  if (jobs.some((job) => job.steps.some((step) => step.name === DEPLOY_STEP && step.conclusion === 'success'))) return 'deployed';
  if (jobs.some((job) => job.name === 'deploy' && job.conclusion === 'skipped')) {
    return 'not deployed: this push ships nothing (docs, tooling or tests), so only the gates ran';
  }
  return 'not deployed: a newer push to main deploys instead';
}
