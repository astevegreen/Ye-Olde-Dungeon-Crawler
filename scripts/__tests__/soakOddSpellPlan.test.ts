import { describe, expect, it } from 'vitest';
import { controlTarget, shouldReveal, type ControlCheck, type ControlFoe, type RevealCheck } from '../../e2e/soak/oddSpellPlan';

/**
 * Soak T5b: the bot finds a use for Loki's Switch (a control spell that lays no status) and for
 * Hliðskjálf (a self spell with no type). Both rules run in the page, rebuilt from source text.
 */

/** Before T5b: a self spell with no type was never cast. */
const revealToday = (_c: RevealCheck): boolean => false;

/** Before T5b: only a status spell, on the biggest foe; a spell with no status was skipped. */
const controlToday = (c: ControlCheck): string | null => {
  if (!c.bigFight || !c.ready || c.status === null) return null;
  const biggest = [...c.foes].sort((a, b) => b.maxHp - a.maxHp || a.dist - b.dist)[0];
  if (!biggest || biggest.hp <= biggest.maxHp * 0.3 || biggest.hasStatus || !biggest.reached) return null;
  return biggest.id;
};

const reveal = (over: Partial<RevealCheck>): RevealCheck => ({
  awakeFoeInSight: false,
  downStairsSeen: false,
  triedThisFloor: 0,
  ...over,
});

const foe = (id: string, dist: number, over: Partial<ControlFoe> = {}): ControlFoe => ({
  id,
  dist,
  hp: 20,
  maxHp: 20,
  reached: true,
  hasStatus: false,
  ...over,
});

const swap = (over: Partial<ControlCheck>): ControlCheck => ({
  bigFight: true,
  ready: true,
  status: null,
  wantsHeal: false,
  foes: [foe('a', 1), foe('b', 3), foe('c', 5)],
  ...over,
});

describe('shouldReveal (criterion 2)', () => {
  it('casts on a fresh floor with no awake foe in sight and the stairs down unseen', () => {
    const c = reveal({});
    expect(revealToday(c)).toBe(false);
    expect(shouldReveal(c)).toBe(true);
  });

  it('casts only once a floor', () => {
    expect(shouldReveal(reveal({ triedThisFloor: 1 }))).toBe(false);
  });

  it('waits while an awake foe is in sight', () => {
    expect(shouldReveal(reveal({ awakeFoeInSight: true }))).toBe(false);
  });

  it('does not cast once the stairs down are seen', () => {
    expect(shouldReveal(reveal({ downStairsSeen: true }))).toBe(false);
  });
});

describe('controlTarget, a spell with no status (criterion 3)', () => {
  it('goes on the farthest foe it reaches', () => {
    const c = swap({});
    expect(controlToday(c)).toBeNull();
    expect(controlTarget(c)).toBe('c');
  });

  it('skips a foe out of reach and one beside the hero', () => {
    expect(controlTarget(swap({ foes: [foe('a', 1), foe('b', 3), foe('c', 5, { reached: false })] }))).toBe('b');
    expect(controlTarget(swap({ foes: [foe('a', 1), foe('b', 1)] }))).toBeNull();
  });

  it('takes the first of two equally far foes', () => {
    expect(controlTarget(swap({ foes: [foe('a', 4), foe('b', 4)] }))).toBe('a');
  });

  it('only in a big fight, past the cooldown', () => {
    expect(controlTarget(swap({ bigFight: false }))).toBeNull();
    expect(controlTarget(swap({ ready: false }))).toBeNull();
  });

  it('never while the hero wants a Heal', () => {
    expect(controlTarget(swap({ wantsHeal: true }))).toBeNull();
  });
});

describe('controlTarget, a status spell keeps the old rule (criterion 4)', () => {
  const cases: Array<[string, ControlCheck]> = [
    ['the biggest foe', swap({ status: 'slow', foes: [foe('a', 1), foe('big', 4, { hp: 50, maxHp: 50 }), foe('c', 5)] })],
    ['the nearest of two equally big', swap({ status: 'slow', foes: [foe('a', 2), foe('b', 5)] })],
    ['the biggest, though another is farther', swap({ status: 'slow', foes: [foe('big', 1, { hp: 40, maxHp: 40 }), foe('c', 5)] })],
    ['none when the biggest is nearly dead', swap({ status: 'slow', foes: [foe('big', 3, { hp: 6, maxHp: 50 }), foe('c', 5)] })],
    ['none when the biggest already has it', swap({ status: 'slow', foes: [foe('big', 3, { maxHp: 50, hp: 50, hasStatus: true })] })],
    ['none when the biggest is out of reach', swap({ status: 'slow', foes: [foe('big', 3, { maxHp: 50, hp: 50, reached: false }), foe('c', 2)] })],
    ['none outside a big fight', swap({ status: 'slow', bigFight: false })],
    ['none on cooldown', swap({ status: 'slow', ready: false })],
    ['the biggest even while the hero wants a Heal', swap({ status: 'slow', wantsHeal: true })],
  ];
  for (const [name, c] of cases) {
    it(name, () => {
      expect(controlTarget(c)).toBe(controlToday(c));
    });
  }

  it('picks what the old rule picked', () => {
    expect(controlTarget(cases[0][1])).toBe('big');
    expect(controlTarget(cases[1][1])).toBe('a');
    expect(controlTarget(cases[3][1])).toBeNull();
  });
});
