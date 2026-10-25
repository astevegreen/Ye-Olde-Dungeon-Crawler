import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatSoakFlags, parseSoakFlags, setSoakFlags, soakRepro } from '../../e2e/soak/soakFlags';

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

describe('setSoakFlags', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A page whose evaluate runs the function here, against a stub engine on `window`. */
  const fakePage = () => {
    const set: Array<[string, boolean]> = [];
    vi.stubGlobal('window', { __cotwEngine: { setWorldFlag: (flag: string, value: boolean) => set.push([flag, value]) } });
    const page = { evaluate: async (fn: (arg: unknown) => unknown, arg: unknown) => fn(arg) };
    return { page: page as unknown as Parameters<typeof setSoakFlags>[0], set };
  };

  it('sets each flag through the engine and returns the run log line', async () => {
    const { page, set } = fakePage();
    const line = await setSoakFlags(page, parseSoakFlags('k1_check,k1_off=false'));
    expect(set).toEqual([
      ['k1_check', true],
      ['k1_off', false],
    ]);
    expect(line).toBe('[soak] World flags set: k1_check=true, k1_off=false');
  });

  it('sets and logs nothing without flags', async () => {
    const { page, set } = fakePage();
    expect(await setSoakFlags(page, [])).toBeNull();
    expect(set).toEqual([]);
  });

  it('runs before the deep-start jump and before the action loop in the soak spec', () => {
    const spec = readFileSync(resolve(__dirname, '../../e2e/soak.spec.ts'), 'utf-8');
    const setAt = spec.indexOf('await setSoakFlags(page, worldFlags)');
    expect(setAt).toBeGreaterThan(0);
    expect(setAt).toBeLessThan(spec.indexOf('e.diagnostics.jumpToFloor('));
    expect(setAt).toBeLessThan(spec.indexOf('const repro = '));
  });
});

describe('soakRepro', () => {
  const base = { seed: 7, policy: 'player', opening: 'skip', startFloor: 0, startLevel: 0, flags: [] };

  it('names the flags so a finding replays with them, from town too', () => {
    const town = soakRepro({ ...base, opening: 'play', flags: parseSoakFlags('a,b=false') }, 12);
    expect(town).toBe('SOAK=1 SOAK_SEED=7 SOAK_POLICY=player SOAK_OPENING=play SOAK_FLAGS=a,b=false SOAK_ACTIONS=12 npx playwright test e2e/soak.spec.ts --project=chromium --workers=1');
  });

  it('names the deep start floor and level beside the flags', () => {
    expect(soakRepro({ ...base, startFloor: 13, startLevel: 9, flags: parseSoakFlags('k1_check') }, 3)).toContain(
      'SOAK_OPENING=skip SOAK_START_FLOOR=13 SOAK_START_LEVEL=9 SOAK_FLAGS=k1_check SOAK_ACTIONS=3 '
    );
  });

  it('adds nothing for a run without flags', () => {
    expect(soakRepro({ ...base, startFloor: 13 }, 3)).not.toContain('SOAK_FLAGS');
  });
});

describe('npm run soak -- --flags', () => {
  it('names the option in its usage text', () => {
    const help = spawnSync(process.execPath, [resolve(__dirname, '../soak.mjs'), '--help'], { encoding: 'utf-8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toMatch(/--flags <list>\s+World flags set before the run starts/);
  });
});
