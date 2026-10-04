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

  it('promise no cure for a curse: only the temple lifts one', () => {
    const LIFTS_CURSES = /(purg|lift|break|remov|cleans|dispel)\w*[^.]*\bcurses?\b/i;
    const liars = COTW_ITEMS.filter((d) => LIFTS_CURSES.test(d.description ?? '')).map((d) => `${d.id}: ${d.description}`);
    expect(liars).toEqual([]);
  });
});
