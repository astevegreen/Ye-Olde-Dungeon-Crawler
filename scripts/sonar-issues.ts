/**
 * Prints the project's open SonarCloud issues on `main`: BLOCKER and CRITICAL by default, or every severity in
 * the files given. Anonymous, read-only GETs of SonarCloud's public API, so no token (scripts/lib/sonar-issues.ts).
 *
 * Usage: npm run sonar:issues [-- --files <path>...]. Exits 1 on a bad argument, an unreadable project or a network failure.
 */
import { sonarIssues } from './lib/sonar-issues';

async function get(url: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  return { status: response.status, body: await response.text() };
}

try {
  const report = await sonarIssues(process.argv.slice(2), get);
  console.log(report.lines.join('\n'));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
