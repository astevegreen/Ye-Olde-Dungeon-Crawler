import { describe, expect, it } from 'vitest';
import { quickBarMove, type QuickBarCheck } from '../../e2e/soak/quickBarPlan';

/**
 * Soak T5a: the bot casts only from the quick bar, so it keeps every spell it can cast there.
 * The rule runs in the page (the bot cannot import there), rebuilt from its source text.
 */

/** Before T5a the bot never touched the bar: a spell off it was never cast. */
const today = (_c: QuickBarCheck): null => null;

const TEN = ['magic_arrow', 'heal_spell', 'fireball', 'frost_bolt', 'slow', 'shield', 'blink', 'summon_wolf', 'ice_wall', 'stun'];

const check = (over: Partial<QuickBarCheck>): QuickBarCheck => ({
  castable: [...TEN, 'lightning'],
  quickBar: [...TEN],
  casts: {},
  heals: ['heal_spell'],
  ...over,
});

describe('quickBarMove', () => {
  it('puts a castable spell off the bar on the first empty slot (criterion 2, empty first)', () => {
    const bar: Array<string | null> = [...TEN];
    bar[4] = null;
    bar[7] = null;
    bar[2] = 'forgotten_spell'; // not castable, but an empty slot comes first
    const c = check({ quickBar: bar, castable: ['magic_arrow', 'heal_spell', 'lightning'] });
    expect(today(c)).toBeNull();
    expect(quickBarMove(c)).toEqual({ spellId: 'lightning', slot: 4 });
  });

  it('reads a short bar as empty slots up to key 0', () => {
    expect(quickBarMove(check({ quickBar: ['magic_arrow'], castable: ['magic_arrow', 'slow'] }))).toEqual({ spellId: 'slow', slot: 1 });
  });

  it('next takes the lowest slot holding a spell the hero cannot cast (criterion 2, unslotted second)', () => {
    // fireball and stun sit on the bar but in no grimoire slot: they cannot be cast.
    const castable = [...TEN, 'lightning'].filter((id) => id !== 'fireball' && id !== 'stun');
    const c = check({ castable, casts: { magic_arrow: 40, frost_bolt: 30 } });
    expect(today(c)).toBeNull();
    expect(quickBarMove(c)).toEqual({ spellId: 'lightning', slot: 2 });
  });

  it('then the most-cast spell, never Magic Arrow nor the only Heal (criterion 2, most-cast third)', () => {
    const c = check({ casts: { magic_arrow: 90, heal_spell: 60, frost_bolt: 12, slow: 5 } });
    expect(today(c)).toBeNull();
    expect(quickBarMove(c)).toEqual({ spellId: 'lightning', slot: 3 });
  });

  it('may move a Heal off the bar when a second Heal stays on it', () => {
    const bar = [...TEN];
    bar[5] = 'greater_heal';
    const c = check({ quickBar: bar, castable: [...bar, 'lightning'], heals: ['heal_spell', 'greater_heal'], casts: { heal_spell: 60, frost_bolt: 12 } });
    expect(quickBarMove(c)).toEqual({ spellId: 'lightning', slot: 1 });
  });

  it('breaks a tie on casts by the lowest slot (criterion 2)', () => {
    const c = check({ casts: { fireball: 7, slow: 7, stun: 7 } });
    expect(today(c)).toBeNull();
    expect(quickBarMove(c)).toEqual({ spellId: 'lightning', slot: 2 });
    // Among empty slots and unslotted spells too.
    const bar: Array<string | null> = [...TEN];
    bar[6] = 'gone_a';
    bar[3] = 'gone_b';
    expect(quickBarMove(check({ quickBar: bar, castable: [...bar.filter((id) => !id?.startsWith('gone')), 'lightning'] as string[] }))).toEqual({
      spellId: 'lightning',
      slot: 3,
    });
  });

  it('brings in the least-cast spell off the bar, the first on a tie', () => {
    const c = check({ castable: [...TEN, 'lightning', 'quake', 'mist'], casts: { lightning: 3, quake: 1, mist: 1, fireball: 9 } });
    expect(quickBarMove(c)).toEqual({ spellId: 'quake', slot: 2 });
  });

  it('returns null when every castable spell is on the bar (criterion 1)', () => {
    expect(quickBarMove(check({ castable: [...TEN] }))).toBeNull();
    expect(quickBarMove(check({ castable: ['magic_arrow'], quickBar: ['magic_arrow', null, null] }))).toBeNull();
    expect(quickBarMove(check({ castable: [], quickBar: [] }))).toBeNull();
  });

  it('returns null rather than swap a spell out for one cast as often, so the bar never churns', () => {
    // Nothing on the bar has been cast more than the spell waiting: no swap gains a cast.
    expect(quickBarMove(check({ casts: { lightning: 4, fireball: 4, slow: 2 } }))).toBeNull();
    // Only Magic Arrow and the only Heal were cast: neither leaves.
    expect(quickBarMove(check({ casts: { magic_arrow: 50, heal_spell: 20 } }))).toBeNull();
    // A swap, then the spell swapped out waits: nothing on the bar now outranks it.
    const first = quickBarMove(check({ casts: { fireball: 6 } }))!;
    expect(first).toEqual({ spellId: 'lightning', slot: 2 });
    const bar = [...TEN];
    bar[first.slot] = first.spellId;
    expect(quickBarMove(check({ quickBar: bar, casts: { fireball: 6 } }))).toBeNull();
  });

  it('still decides the same when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${quickBarMove.toString()})`)() as typeof quickBarMove;
    const bar: Array<string | null> = [...TEN];
    bar[8] = null;
    for (const c of [check({}), check({ quickBar: bar }), check({ casts: { fireball: 3 } }), check({ castable: [...TEN] })]) {
      expect(rebuilt(c)).toEqual(quickBarMove(c));
    }
  });
});
