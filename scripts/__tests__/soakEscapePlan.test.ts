import { describe, expect, it } from 'vitest';
import { shouldEscape, type EscapeCheck } from '../../e2e/soak/escapePlan';

/**
 * Soak K4: the bot casts Phase Door when badly hurt in melee. The rule runs in the page (the bot
 * cannot import there), rebuilt from its source text. Numbers: a 50-HP hero, Phase Door and Heal
 * both costing 4 Seiðr (src/content/cotw/spells.ts).
 */

const at = (over: Partial<EscapeCheck>): EscapeCheck => ({
  hp: 12,
  maxHp: 50,
  adjacentFoes: 1,
  mana: 4,
  escapeCost: 4,
  healCost: null,
  justHealed: false,
  ...over,
});

type Choice = 'heal' | 'escape' | 'other';
/** A Heal the bot would cast: castable, and at 55% or below (shouldHeal's line). */
const healWanted = (c: EscapeCheck, heal: { cost: number } | null) => Boolean(heal && c.mana >= heal.cost && c.hp <= c.maxHp * 0.55);

/** The bot's choice before K4: a Heal it would cast first, then the escape at the same lines. */
const todaysChoice = (c: EscapeCheck, heal: { cost: number } | null): Choice => {
  if (healWanted(c, heal)) return 'heal';
  const ringed = c.adjacentFoes >= 3 && c.hp <= c.maxHp * 0.6;
  const castable = c.escapeCost !== null && c.mana >= c.escapeCost;
  return c.adjacentFoes > 0 && (c.hp <= c.maxHp * 0.3 || ringed) && castable ? 'escape' : 'other';
};

/** The choice now (playerBot.ts, a dungeon floor): the escape rule, then the Heal. */
const choiceNow = (c: EscapeCheck, heal: { cost: number } | null): Choice => {
  const wanted = healWanted(c, heal);
  if (shouldEscape({ ...c, healCost: wanted && heal ? heal.cost : null })) return 'escape';
  return wanted ? 'heal' : 'other';
};

/**
 * Seed 9406's death (floor 20): a Fire Giant beside the hero hits for 27 a turn, a Heal restores
 * 25. Plays `turns` turns from 19 of 104 HP and 40 Seiðr and returns the choices made.
 */
const giantFight = (choose: (c: EscapeCheck, heal: { cost: number }) => Choice, turns: number): Choice[] => {
  const heal = { cost: 4 };
  let hp = 19;
  let mana = 40;
  let lastHeal = -1e9;
  const choices: Choice[] = [];
  for (let turn = 0; turn < turns; turn++) {
    const choice = choose(at({ hp, maxHp: 104, mana, justHealed: turn - lastHeal <= 2 }), heal);
    choices.push(choice);
    if (choice === 'escape') break;
    if (choice === 'heal') {
      hp = Math.min(104, hp + 25);
      mana -= heal.cost;
      lastHeal = turn;
    }
    hp -= 27;
    if (hp <= 0) break;
  }
  return choices;
};

describe('shouldEscape', () => {
  it('casts with a foe adjacent at or below 30%, or 60% when three ring the hero (criterion 1)', () => {
    expect(shouldEscape(at({ hp: 15 }))).toBe(true); // exactly 30%
    expect(shouldEscape(at({ hp: 1 }))).toBe(true);
    expect(shouldEscape(at({ hp: 30, adjacentFoes: 3 }))).toBe(true); // exactly 60%, ringed
  });

  it('holds off with no foe adjacent, or above the lines (criterion 1)', () => {
    expect(shouldEscape(at({ adjacentFoes: 0 }))).toBe(false);
    expect(shouldEscape(at({ hp: 16 }))).toBe(false);
    expect(shouldEscape(at({ hp: 16, adjacentFoes: 2 }))).toBe(false);
    expect(shouldEscape(at({ hp: 31, adjacentFoes: 3 }))).toBe(false);
  });

  it('holds off when no escape spell can be cast, so the Phase Door scroll is still read (criterion 5)', () => {
    expect(shouldEscape(at({ escapeCost: null }))).toBe(false);
    expect(shouldEscape(at({ mana: 3 }))).toBe(false);
  });

  it('reproduces the cause: with Heal at Phase Door’s price, the old order never cast the escape (criterion 2)', () => {
    // Whatever the Seiðr, Phase Door affordable meant Heal affordable, and the Heal went first.
    for (let mana = 0; mana <= 40; mana++) {
      expect(todaysChoice(at({ mana }), { cost: 4 })).not.toBe('escape');
    }
    // Seed 9406: healing behind a giant's blows until the hero died, 40 Seiðr notwithstanding.
    expect(giantFight(todaysChoice, 20)).toEqual(Array(10).fill('heal'));
    // Now one Heal, and when it leaves the hero below the line, the escape.
    expect(giantFight(choiceNow, 3)).toEqual(['heal', 'escape']);
    // And the last Heal's worth of Seiðr goes to the escape.
    for (const mana of [4, 5, 6, 7]) {
      expect(choiceNow(at({ mana }), { cost: 4 })).toBe('escape');
    }
  });

  it('lets a Heal the bot would cast come first while the Seiðr pays for both (criterion 3)', () => {
    const heal = { cost: 4 };
    expect(choiceNow(at({ mana: 8 }), heal)).toBe('heal');
    expect(choiceNow(at({ mana: 20 }), heal)).toBe('heal');
    expect(shouldEscape(at({ mana: 8, healCost: 4 }))).toBe(false);
    expect(shouldEscape(at({ mana: 8, healCost: 4, justHealed: true }))).toBe(true);
    expect(shouldEscape(at({ mana: 7, healCost: 4 }))).toBe(true);
    // Ringed at 58%: no Heal wanted there, so the escape, as before.
    expect(choiceNow(at({ hp: 29, adjacentFoes: 3, mana: 20 }), heal)).toBe('escape');
  });

  it('still decides the same when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${shouldEscape.toString()})`)() as typeof shouldEscape;
    const cases = [at({}), at({ adjacentFoes: 0 }), at({ mana: 8, healCost: 4 }), at({ mana: 8, healCost: 4, justHealed: true }), at({ hp: 30, adjacentFoes: 3 }), at({ escapeCost: null })];
    for (const c of cases) {
      expect(rebuilt(c)).toBe(shouldEscape(c));
    }
  });
});
