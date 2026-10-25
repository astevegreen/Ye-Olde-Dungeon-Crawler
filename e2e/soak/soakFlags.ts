import type { Page } from '@playwright/test';

/** A world flag a soak run sets before it starts (`SOAK_FLAGS`). */
export interface SoakFlag {
  flag: string;
  value: boolean;
}

/**
 * `SOAK_FLAGS` (`npm run soak -- --flags <list>`) as flag settings: `a,b` sets both true,
 * `c=false` sets `c` false (`c=true` is the same as `c`). Names and values are trimmed; an
 * empty or missing list sets nothing. An entry with no name, or a value other than `true` or
 * `false`, throws naming the entry: a typo would otherwise start an Act II soak as if a choice
 * had been made that never was.
 */
export function parseSoakFlags(raw: string | undefined): SoakFlag[] {
  if (raw === undefined || raw.trim() === '') return [];
  return raw.split(',').map((entry) => {
    const at = entry.indexOf('=');
    const flag = (at < 0 ? entry : entry.slice(0, at)).trim();
    const value = at < 0 ? 'true' : entry.slice(at + 1).trim();
    if (!flag) throw new Error(`SOAK_FLAGS: entry "${entry}" has no flag name`);
    if (value !== 'true' && value !== 'false') throw new Error(`SOAK_FLAGS: entry "${entry}" has value "${value}", not true or false`);
    return { flag, value: value === 'true' };
  });
}

/** The flags as one `SOAK_FLAGS` value (`a,c=false`), for the log and the repro line; quoted
 *  for the shell when a name holds anything but letters, digits and `_ : . -`. */
export function formatSoakFlags(flags: SoakFlag[]): string {
  const list = flags.map((f) => (f.value ? f.flag : `${f.flag}=false`)).join(',');
  return /^[\w:.,=-]*$/.test(list) ? list : `'${list.replaceAll("'", "'\\''")}'`;
}

/**
 * Sets each flag through the page's engine (`setWorldFlag`) and returns the run's log line.
 * The spec calls it before the deep-start jump, so the floor that builds sees them, and on a
 * run from town before the first action. No flags: nothing is set and nothing logged (`null`).
 */
export async function setSoakFlags(page: Pick<Page, 'evaluate'>, flags: SoakFlag[]): Promise<string | null> {
  if (flags.length === 0) return null;
  await page.evaluate((list: SoakFlag[]) => {
    for (const { flag, value } of list) window.__cotwEngine!.setWorldFlag(flag, value);
  }, flags);
  return `[soak] World flags set: ${flags.map((f) => `${f.flag}=${f.value}`).join(', ')}`;
}

/** What a finding's repro line needs to replay its run. */
export interface SoakReproRun {
  seed: number;
  policy: string;
  opening: string;
  startFloor: number;
  startLevel: number;
  flags: SoakFlag[];
}

/** The command that replays a run up to `actions` actions: a deep start names its floor (and
 *  level), and a run with flags names them, from town too. */
export function soakRepro(run: SoakReproRun, actions: number): string {
  const deep = run.startFloor > 0 ? ` SOAK_START_FLOOR=${run.startFloor}${run.startLevel ? ` SOAK_START_LEVEL=${run.startLevel}` : ''}` : '';
  const flags = run.flags.length > 0 ? ` SOAK_FLAGS=${formatSoakFlags(run.flags)}` : '';
  return `SOAK=1 SOAK_SEED=${run.seed} SOAK_POLICY=${run.policy} SOAK_OPENING=${run.opening}${deep}${flags} SOAK_ACTIONS=${actions} npx playwright test e2e/soak.spec.ts --project=chromium --workers=1`;
}
