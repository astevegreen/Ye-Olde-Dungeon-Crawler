import { describe, expect, it } from 'vitest';
import { npcToMeet, type FloorNpc } from '../../e2e/soak/npcMeet';

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
