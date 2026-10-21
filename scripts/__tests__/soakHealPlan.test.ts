import { describe, expect, it } from 'vitest';
import { healReserve, shouldHeal, type HealCheck, type ReserveCheck } from '../../e2e/soak/healPlan';

/**
 * Soak T4a: in a big fight the bot keeps Seiðr for a Heal and tops up early with Seiðr to spare.
 * Both rules run in the page (the bot cannot import there), rebuilt from their source text.
 * Numbers: a 56-HP hero, Heal costing 4 and restoring up to 20 (heal_spell).
 */

/** The rule before T4a: heal at or below 55% of max HP, nothing else. */
const todaysHeal = (c: HealCheck): boolean => c.hp <= c.maxHp * 0.55;
/** The reserve before T4a: one listed Heal cost, only under 70% HP. */
const todaysReserve = (c: ReserveCheck): number =>
  c.listedHealCost !== null && c.hp < c.maxHp * 0.7 ? c.listedHealCost : 0;

const hurt = (over: Partial<HealCheck>): HealCheck => ({
  hp: 34,
  maxHp: 56,
  mana: 12,
  healCost: 4,
  healPower: 20,
  bigFight: true,
  ...over,
});

describe('shouldHeal', () => {
  it('heals at or below 55% of max HP, in any fight and with one Heal of Seiðr (criterion 2)', () => {
    for (const hp of [30, 20, 1]) {
      expect(shouldHeal(hurt({ hp, bigFight: false, mana: 4 }))).toBe(true);
    }
    // 55% of 40 is exactly 22: the boundary heals, one above it does not (small fight).
    expect(shouldHeal(hurt({ hp: 22, maxHp: 40, bigFight: false }))).toBe(true);
    expect(shouldHeal(hurt({ hp: 23, maxHp: 40, bigFight: false }))).toBe(false);
  });

  it('tops up early in a big fight with Seiðr for two Heals and a Heal of HP missing (criterion 3)', () => {
    const c = hurt({ hp: 34 }); // 61%: above today's line, 22 HP missing, 12 Seiðr = three Heals
    expect(todaysHeal(c)).toBe(false);
    expect(shouldHeal(c)).toBe(true);
    // The edges: exactly two Heals of Seiðr, exactly one Heal of HP missing.
    expect(shouldHeal(hurt({ hp: 36, mana: 8 }))).toBe(true);
    // The learning-stone share lowers the cost, so less Seiðr is enough.
    expect(shouldHeal(hurt({ mana: 6, healCost: 3 }))).toBe(true);
  });

  it('holds off above 55% when the fight is small, the hero near full, or the Seiðr short (criterion 4)', () => {
    expect(shouldHeal(hurt({ bigFight: false }))).toBe(false);
    expect(shouldHeal(hurt({ hp: 56 }))).toBe(false);
    expect(shouldHeal(hurt({ hp: 37 }))).toBe(false); // 19 missing: a Heal would overflow
    expect(shouldHeal(hurt({ mana: 7 }))).toBe(false); // one Heal of Seiðr: keep it for the low point
    expect(shouldHeal(hurt({ hp: 40 }))).toBe(false);
  });

  it('still decides the same when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${shouldHeal.toString()})`)() as typeof shouldHeal;
    for (const c of [hurt({}), hurt({ hp: 30, bigFight: false, mana: 4 }), hurt({ mana: 7 }), hurt({ bigFight: false })]) {
      expect(rebuilt(c)).toBe(shouldHeal(c));
    }
  });
});

describe('healReserve', () => {
  const at = (over: Partial<ReserveCheck>): ReserveCheck => ({
    hp: 56,
    maxHp: 56,
    bigFight: true,
    healCost: 3,
    listedHealCost: 4,
    ...over,
  });

  it('keeps one Heal of actual cost at any HP during a big fight (criterion 5)', () => {
    const full = at({});
    expect(todaysReserve(full)).toBe(0);
    expect(healReserve(full)).toBe(3);
    // Hurt too: the actual (learning-stone) cost, not the listed one.
    const low = at({ hp: 20 });
    expect(todaysReserve(low)).toBe(4);
    expect(healReserve(low)).toBe(3);
  });

  it('keeps the old rule outside a big fight, or when no Heal can be cast now (criterion 5)', () => {
    expect(healReserve(at({ bigFight: false }))).toBe(0);
    expect(healReserve(at({ bigFight: false, hp: 39 }))).toBe(4);
    expect(healReserve(at({ bigFight: true, healCost: null, hp: 39 }))).toBe(4);
    expect(healReserve(at({ bigFight: true, healCost: null }))).toBe(0);
    expect(healReserve(at({ healCost: null, listedHealCost: null, hp: 10 }))).toBe(0);
  });

  it('still decides the same when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${healReserve.toString()})`)() as typeof healReserve;
    for (const c of [at({}), at({ bigFight: false, hp: 39 }), at({ healCost: null })]) {
      expect(rebuilt(c)).toBe(healReserve(c));
    }
  });
});
