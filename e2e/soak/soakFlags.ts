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
