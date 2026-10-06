import { describe, it, expect } from 'vitest';
import { COTW_ITEMS } from '../items';

// An item's description says only what the item does (N20): the game has no light
// sources, hunger, bleeding, locks to pick, secret-door sense or disarming, so no
// description promises them.
const PROMISES = /casts? [^.]*light|radiant illumination|illuminates|burns with [^.]*light|secret doors|hidden caches|hollow walls|disarm|rations|hunger|bleeding|unlock|lock-masters|flash-freez|constructs|crossing the barrier|toward [^.]*staircases|lock securely|sears the undead/i;

describe('cotw item descriptions', () => {
  it('promise no effect the game lacks', () => {
    const liars = COTW_ITEMS.filter((d) => PROMISES.test(d.description ?? '')).map(
      (d) => `${d.id}: ${d.description}`
    );
    expect(liars).toEqual([]);
  });

  // Five items promised a resistance or an immunity that item definitions had no way to
  // give (6 Oct); `wornEffects` gives it now, and a new promise must come with one.
  it('that promise a resistance or immunity carry it as a worn effect', () => {
    const PROTECTS = /\b(resistance|immunity|immune|wards against|can blind|can stun)\b/i;
    const empty = COTW_ITEMS.filter((d) => PROTECTS.test(d.description ?? '') && !d.wornEffects).map((d) => d.id);
    expect(empty).toEqual([]);
    const effects = Object.fromEntries(COTW_ITEMS.filter((d) => d.wornEffects).map((d) => [d.id, d.wornEffects]));
    expect(effects).toMatchObject({
      ring_of_the_slag_walker: { resistsElements: ['fire'] },
      zealots_seared_crown: { resistsElements: ['fire'] },
      soot_visored_helm: { grantsStatusImmunities: ['blindness'] },
      rootless_striders: { grantsStatusImmunities: ['paralysis'], trapImmune: true },
      corpse_chieftains_eye_coin: { grantsStatusImmunities: ['stunned'] },
    });
  });

  // Three pieces of armour promised to answer a blow but hooked `onHit`, which fires on the
  // wearer's own blows (R-cmbt-12): a reaction to being struck hooks a defender's event.
  it('that promise a reaction to being struck hook an event the wearer is struck by', () => {
    const STRUCK = /when struck|strikes its (wearer|bearer)|whoever strikes|retaliat|reflects? incoming/i;
    const DEFENDER_EVENTS = new Set(['onDamageTaken', 'onBlock']);
    const wrong = COTW_ITEMS.filter(
      (d) =>
        [d.description, ...(d.hooks ?? []).map((h) => h.description)].some((t) => STRUCK.test(t ?? '')) &&
        !(d.hooks ?? []).some((h) => DEFENDER_EVENTS.has(h.event))
    ).map((d) => d.id);
    expect(wrong).toEqual([]);
    const struck = COTW_ITEMS.filter((d) => (d.hooks ?? []).some((h) => h.event === 'onDamageTaken')).map((d) => d.id);
    expect(struck).toEqual(expect.arrayContaining(['bellows_plate_shield', 'mirror_skulker_facet', 'nid_dripping_hauberk']));
  });

  it('promise no cure for a curse: only the temple lifts one', () => {
    const LIFTS_CURSES = /(purg|lift|break|remov|cleans|dispel)\w*[^.]*\bcurses?\b/i;
    const liars = COTW_ITEMS.filter((d) => LIFTS_CURSES.test(d.description ?? '')).map((d) => `${d.id}: ${d.description}`);
    expect(liars).toEqual([]);
  });
});
