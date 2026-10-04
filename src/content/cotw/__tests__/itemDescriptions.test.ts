import { describe, it, expect } from 'vitest';
import { COTW_ITEMS } from '../items';

// An item's description says only what the item does (N20): the game has no light
// sources, hunger, bleeding, locks to pick, secret-door sense or disarming, so no
// description promises them.
const PROMISES = /casts? [^.]*light|radiant illumination|illuminates|burns with [^.]*light|secret doors|hidden caches|hollow walls|disarm|rations|hunger|bleeding|unlock|lock-masters|flash-freez|constructs|crossing the barrier|toward [^.]*staircases|lock securely|sears the undead/i;

// Pulled from the game in tracker 1.9; they go with their descriptions.
const PULLED = new Set(['wooden_torch', 'torch', 'travel_bread', 'thief_lockpicks', 'lockpicks', 'bog_iron_whetstone', 'ice_stave_rune_tablet']);

describe('cotw item descriptions', () => {
  it('promise no effect the game lacks', () => {
    const liars = COTW_ITEMS.filter((d) => !PULLED.has(d.id) && PROMISES.test(d.description ?? '')).map(
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
