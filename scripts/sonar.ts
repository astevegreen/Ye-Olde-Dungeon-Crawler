/**
 * Prints a pull request's SonarCloud findings: the quality gate, the counts, then each finding's message
 * with its `path:line`s. Read-only GETs through `gh`, so it runs under one allow rule with no SonarCloud
 * token (scripts/lib/sonar-findings.ts).
 *
 * Usage: npm run sonar -- <pr>. Exits 1 when there is no finished SonarCloud analysis to read.
 */
import { spawnSync } from 'node:child_process';
import { sonarReport } from './lib/sonar-findings';

function gh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

try {
  const report = sonarReport(process.argv[2], gh);
  console.log(report.lines.join('\n'));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
