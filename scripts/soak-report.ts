/**
 * Prints the P-36 soak report for one or more soak folders: the five questions (is magic worth
 * it, the learning path, floor pacing, the Runestones, magic bugs) as Markdown tables.
 *
 *   npm run soak:report -- .prompts/soak/player [.prompts/soak/player-floor12 ...] [--sha <sha>]
 *
 * Reads every `<folder>/<seed>/summary.json`; `--sha` keeps the runs of one game commit. Each
 * folder's `runs.jsonl`, unfiltered, says how the runs and the runner stopped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseRunsJsonl, soakReport, type ReportSummary, type RunsLog } from './lib/soak-report';

/** `src/content/cotw/hearthCold.ts` HEARTH_COLD_STAGES, in turns below town. */
const COLD_STAGES = [3000, 7000, 12000, 20000];

const args = process.argv.slice(2);
const shaAt = args.indexOf('--sha');
const sha = shaAt >= 0 ? args[shaAt + 1] : undefined;
const dirs = args.filter((a, i) => !a.startsWith('--') && (shaAt < 0 || i !== shaAt + 1));
if (dirs.length === 0) {
  console.error('usage: npm run soak:report -- <soak folder> [<soak folder> ...] [--sha <sha>]');
  process.exit(2);
}

const summaries: ReportSummary[] = [];
const runs: RunsLog[] = [];
for (const dir of dirs) {
  const runsFile = join(dir, 'runs.jsonl');
  if (existsSync(runsFile)) runs.push({ folder: dir, lines: parseRunsJsonl(readFileSync(runsFile, 'utf-8')) });
  for (const seed of readdirSync(dir)) {
    const file = join(dir, seed, 'summary.json');
    if (!existsSync(file)) continue;
    try {
      const s = JSON.parse(readFileSync(file, 'utf-8')) as ReportSummary;
      if (!sha || s.sha === sha) summaries.push({ ...s, folder: resolve(dir) });
    } catch {
      console.error(`skipped ${file}: not JSON`);
    }
  }
}
console.log(soakReport(summaries, { coldStages: COLD_STAGES, runs }));
