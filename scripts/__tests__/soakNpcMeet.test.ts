import { describe, expect, it } from 'vitest';
import { isNpcBump, npcChoiceKey, npcToMeet, recordNpcDecision, type FloorNpc, type NpcMeetState } from '../../e2e/soak/npcMeet';

/**
 * K1: the player bot walks to a dungeon NPC with a choice once it has seen it, and bumps it
 * once a run (Ivalda on floor 13 today, Act II's hub NPCs later). The helper runs in the page,
 * rebuilt from its source text.
 */

const IVALDA: FloorNpc = { id: 'ivalda', x: 10, y: 4, choiceId: 'ivalda_forge' };
const HOSTAGE: FloorNpc = { id: 'hostage_1', x: 3, y: 3 };
const all = () => true;

describe('npcToMeet: the dungeon NPC the bot goes to talk to', () => {
  it('picks an NPC with a choice whose tile is explored', () => {
    expect(npcToMeet(13, [IVALDA], all, [])).toBe(IVALDA);
  });

  it('waits until the NPC has been seen', () => {
    expect(npcToMeet(13, [IVALDA], (x, y) => !(x === 10 && y === 4), [])).toBeNull();
  });

  it('never picks one already met this run, so a choice that never resolves is not bumped in a loop', () => {
    expect(npcToMeet(13, [IVALDA], all, ['ivalda'])).toBeNull();
    const second: FloorNpc = { id: 'hub_two', x: 1, y: 1, choiceId: 'hub_two_talk' };
    expect(npcToMeet(13, [IVALDA, second], all, ['ivalda'])).toBe(second);
  });

  it('leaves the town floor to its own handling', () => {
    expect(npcToMeet(0, [IVALDA], all, [])).toBeNull();
  });

  it('passes an NPC without a choice by (the floor-22 hostages stay pathed around)', () => {
    expect(npcToMeet(22, [HOSTAGE], all, [])).toBeNull();
    expect(npcToMeet(22, [HOSTAGE, IVALDA], all, [])).toBe(IVALDA);
  });

  it('picks the same when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${npcToMeet.toString()})`)() as typeof npcToMeet;
    expect(rebuilt(13, [HOSTAGE, IVALDA], all, [])).toEqual(IVALDA);
    expect(rebuilt(0, [IVALDA], all, [])).toBeNull();
    expect(rebuilt(13, [IVALDA], all, ['ivalda'])).toBeNull();
  });
});

describe('isNpcBump: only the step onto the NPC meets it', () => {
  it('is not a bump while the hero walks toward the NPC', () => {
    expect(isNpcBump({ x: 8, y: 4 }, IVALDA)).toBe(false);
    expect(isNpcBump({ x: 9, y: 3 }, IVALDA)).toBe(false);
  });

  it('is a bump when the step targets the NPC tile (the hero stays adjacent)', () => {
    expect(isNpcBump({ x: 10, y: 4 }, IVALDA)).toBe(true);
  });

  it('answers the same when rebuilt from its source text', () => {
    const rebuilt = new Function(`return (${isNpcBump.toString()})`)() as typeof isNpcBump;
    expect(rebuilt({ x: 10, y: 4 }, IVALDA)).toBe(true);
    expect(rebuilt({ x: 9, y: 4 }, IVALDA)).toBe(false);
  });
});

describe('npcChoiceKey: how the bot answers an NPC choice', () => {
  it('leaves with Escape, recording left, when no option is open (Ivalda without Iron Clans standing)', () => {
    expect(npcChoiceKey(null, false)).toEqual({ key: 'Escape', option: 'left' });
  });

  it('presses Enter on the highlighted option and records its id', () => {
    expect(npcChoiceKey('temper', true)).toEqual({ key: 'Enter', option: 'temper' });
  });

  it('highlights the first open option first, recording nothing yet', () => {
    expect(npcChoiceKey(null, true)).toEqual({ key: 'ArrowDown' });
  });

  it('answers the same when rebuilt from its source text', () => {
    const rebuilt = new Function(`return (${npcChoiceKey.toString()})`)() as typeof npcChoiceKey;
    expect(rebuilt(null, false)).toEqual({ key: 'Escape', option: 'left' });
    expect(rebuilt('forge_spell', true)).toEqual({ key: 'Enter', option: 'forge_spell' });
  });
});

describe('recordNpcDecision: what summary.json gets', () => {
  const fresh = (): NpcMeetState => ({ npcsMet: {}, npcChoice: null });

  it('meets nobody on the walk toward the NPC', () => {
    const state = fresh();
    recordNpcDecision(state, 13, {});
    expect(state).toEqual(fresh());
  });

  it('marks the NPC met on the bump, unanswered until its choice is', () => {
    const state = fresh();
    recordNpcDecision(state, 13, { npcBump: { id: 'ivalda' } });
    expect(state.npcsMet).toEqual({ ivalda: { floor: 13, option: 'unanswered' } });
    expect(state.npcChoice).toEqual({ id: 'ivalda' });
  });

  it('records left when the bot escapes the choice, and stops tracking it once it closes', () => {
    const state = fresh();
    recordNpcDecision(state, 13, { npcBump: { id: 'ivalda' } });
    recordNpcDecision(state, 13, { npcKey: { id: 'ivalda', option: 'left' } });
    expect(state.npcsMet.ivalda).toEqual({ floor: 13, option: 'left' });
    recordNpcDecision(state, 13, {});
    expect(state.npcChoice).toBeNull();
    expect(state.npcsMet.ivalda.option).toBe('left');
  });

  it('keeps tracking the choice while the bot highlights, then records the option it entered', () => {
    const state = fresh();
    recordNpcDecision(state, 26, { npcBump: { id: 'hub_two' } });
    recordNpcDecision(state, 26, { npcKey: { id: 'hub_two' } });
    expect(state.npcChoice).toEqual({ id: 'hub_two' });
    expect(state.npcsMet.hub_two.option).toBe('unanswered');
    recordNpcDecision(state, 26, { npcKey: { id: 'hub_two', option: 'spare' } });
    expect(state.npcsMet.hub_two).toEqual({ floor: 26, option: 'spare' });
  });

  it('keeps the NPC met after its choice closes, so npcToMeet never sends the bot back to it', () => {
    const state = fresh();
    recordNpcDecision(state, 13, { npcBump: { id: 'ivalda' } });
    recordNpcDecision(state, 13, { npcKey: { id: 'ivalda', option: 'left' } });
    recordNpcDecision(state, 13, {});
    expect(npcToMeet(13, [IVALDA], all, Object.keys(state.npcsMet))).toBeNull();
  });
});
