import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatSoakFlags, parseSoakFlags } from '../../e2e/soak/soakFlags';

/** K1: an Act II soak starts deep with world flags set (`SOAK_FLAGS`, `npm run soak -- --flags`). */
describe('parseSoakFlags', () => {
  it('sets each named flag true', () => {
    expect(parseSoakFlags('a,b')).toEqual([
      { flag: 'a', value: true },
      { flag: 'b', value: true },
    ]);
  });

  it('sets a flag false with =false, and true with =true', () => {
    expect(parseSoakFlags('c=false,d=true')).toEqual([
      { flag: 'c', value: false },
      { flag: 'd', value: true },
    ]);
  });

  it('trims spaces around names and values', () => {
    expect(parseSoakFlags(' a , c = false ')).toEqual([
      { flag: 'a', value: true },
      { flag: 'c', value: false },
    ]);
  });

  it('sets nothing for an empty or missing list', () => {
    expect(parseSoakFlags(undefined)).toEqual([]);
    expect(parseSoakFlags('')).toEqual([]);
    expect(parseSoakFlags('   ')).toEqual([]);
  });

  it('throws naming an entry with no flag name', () => {
    expect(() => parseSoakFlags('a,,b')).toThrow('entry "" has no flag name');
    expect(() => parseSoakFlags('a, =false')).toThrow('entry " =false" has no flag name');
  });

  it('throws naming an entry whose value is not true or false', () => {
    expect(() => parseSoakFlags('a,c=no')).toThrow('entry "c=no" has value "no", not true or false');
    expect(() => parseSoakFlags('c=')).toThrow('entry "c="');
  });
});

describe('formatSoakFlags', () => {
  it('writes the list back as one SOAK_FLAGS value, which parses to the same flags', () => {
    const flags = parseSoakFlags(' rot_choice_made , rot_spared = false ');
    expect(formatSoakFlags(flags)).toBe('rot_choice_made,rot_spared=false');
    expect(parseSoakFlags(formatSoakFlags(flags))).toEqual(flags);
  });

  it('quotes a list the shell would split', () => {
    expect(formatSoakFlags([{ flag: 'odd name', value: true }])).toBe("'odd name'");
  });
});

describe('npm run soak -- --flags', () => {
  it('names the option in its usage text', () => {
    const help = spawnSync(process.execPath, [resolve(__dirname, '../soak.mjs'), '--help'], { encoding: 'utf-8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--flags <list>\s+World flags set before the run starts/);
  });
});
