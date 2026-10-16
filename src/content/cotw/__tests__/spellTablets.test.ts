import { describe, it, expect } from 'vitest';
import { createWorldState, evaluatePredicate, getFlag, setFlag } from '../../../engine';
import type { ActionHookContext } from '../../../engine';
import { COTW_TABLET_STOCK, DEEPEST_FLOOR_HOOK } from '../spellTablets';

/** The hook's view of the engine: the player's known spells, the floor and world flags. */
function fakeContext(spellsKnown: string[], currentFloor: number) {
  const worldState = createWorldState();
  const player = { spellsKnown };
  const engine = {
    player,
    currentFloor,
    worldState,
    getWorldFlag: (flag: string) => getFlag(worldState, flag),
    setWorldFlag: (flag: string, value: boolean) => setFlag(worldState, flag, value),
  };
  return { ctx: { actor: player, engine } as unknown as ActionHookContext, worldState, player };
}

const stocked = (worldState: ReturnType<typeof createWorldState>, itemId: string) =>
  evaluatePredicate(COTW_TABLET_STOCK.find((t) => t.itemId === itemId)!.predicate, worldState);

describe("Astrid's rune tablets", () => {
  it('stops selling a tablet once the hero knows its spell', () => {
    const { ctx, worldState, player } = fakeContext(['firebolt'], 12);
    DEEPEST_FLOOR_HOOK.execute(ctx);
    expect(stocked(worldState, 'tablet_firebolt')).toBe(false);
    expect(stocked(worldState, 'tablet_slow')).toBe(true);

    player.spellsKnown.push('slow');
    DEEPEST_FLOOR_HOOK.execute(ctx);
    expect(stocked(worldState, 'tablet_slow')).toBe(false);
  });

  it('keeps a known tablet off the shelf after the spell is forgotten', () => {
    const { ctx, worldState, player } = fakeContext(['firebolt'], 12);
    DEEPEST_FLOOR_HOOK.execute(ctx);
    player.spellsKnown.length = 0;
    DEEPEST_FLOOR_HOOK.execute(ctx);
    expect(stocked(worldState, 'tablet_firebolt')).toBe(false);
  });

  it('still waits for the depth before selling an unknown spell', () => {
    const { ctx, worldState } = fakeContext([], 9);
    DEEPEST_FLOOR_HOOK.execute(ctx);
    expect(stocked(worldState, 'tablet_firebolt')).toBe(false);
  });
});
