import { describe, it, expect } from 'vitest';
import { ActionLogGroups, classifyLogLine, CriticalLineTracker, collapseByAction, runText } from '../logClassifier';

const tone = (msg: string, crits?: ReadonlySet<string>) => classifyLogLine(msg, 'Sven', crits).tone;

describe('classifyLogLine', () => {
  it('reads a monster taking damage as your hit, not as danger', () => {
    expect(tone('Sven attacks Kobold for 5 damage.')).toBe('hit');
    expect(tone("Sven's Magic Arrow strikes Goblin Scout for 8 damage.")).toBe('hit');
    expect(tone('Kobold takes 5 damage.')).toBe('plain');
  });

  it('reads the hero being hurt as danger', () => {
    expect(tone('Kobold attacks Sven for 3 damage.')).toBe('danger');
    expect(tone('Sven suffers periodic poison damage!')).toBe('danger');
    expect(tone('A pressure plate clicks! A dart springs from the wall hitting Sven for 4 damage!')).toBe('danger');
  });

  it('marks a line the critical-hit event named, whatever its wording', () => {
    const line = 'Sven attacks Kobold for 12 damage.';
    expect(tone(line, new Set([line]))).toBe('crit');
  });

  it('keeps a critical against the hero as danger', () => {
    const line = 'Critical hit! Ogre attacks Sven for 20 damage.';
    expect(tone(line, new Set([line]))).toBe('danger');
  });

  it('strips the engine\'s *** emphasis and highlights the line', () => {
    const line = classifyLogLine("*** Bestiary: You uncovered the affinities and weaknesses of Kobold! ***", 'Sven');
    expect(line.text).toBe('Bestiary: You uncovered the affinities and weaknesses of Kobold!');
    expect(line.tone).toBe('highlight');
  });

  it('no longer paints every line mentioning a rune as arcane', () => {
    expect(tone('The Rune of Return hums faintly in your pack.')).toBe('plain');
    expect(tone('Sven casts Magic Arrow.')).toBe('arcane');
  });

  it('treats a hero name with regex characters literally', () => {
    expect(classifyLogLine('Kobold attacks Sven (II) for 3 damage.', 'Sven (II)').tone).toBe('danger');
  });
});

describe('CriticalLineTracker', () => {
  it('remembers the newest message at the moment of the event, up to its capacity', () => {
    const tracker = new CriticalLineTracker(2);
    tracker.markNewest(['a', 'crit one']);
    tracker.markNewest(['crit two']);
    tracker.markNewest(['crit three']);
    expect([...tracker.set]).toEqual(['crit two', 'crit three']);
  });
});

// The soak's "one action logged the same line 3 times" (a Brim-Howler pack): one line, counted.
describe('repeated log lines', () => {
  it('collapses lines repeated in a row, and only in a row, when no line has an action', () => {
    const hit = 'Brim-Howler attacks Sven for 2 damage.';
    expect(collapseByAction([hit, hit, hit, 'Sven is afflicted with slow!', hit])).toEqual([
      { message: hit, count: 3 },
      { message: 'Sven is afflicted with slow!', count: 1 },
      { message: hit, count: 1 },
    ]);
  });

  it('folds one action\'s repeats into the row where each first appeared, even with lines between', () => {
    expect(collapseByAction(['W attacks', 'W waits', 'W attacks', 'W waits', 'W attacks'], [0, 0, 0, 0, 0])).toEqual([
      { message: 'W attacks', count: 3 },
      { message: 'W waits', count: 2 },
    ]);
  });

  it('never folds lines from different actions unless they are in a row', () => {
    expect(collapseByAction(['A', 'B', 'A'], [0, 0, 1])).toEqual([
      { message: 'A', count: 1 },
      { message: 'B', count: 1 },
      { message: 'A', count: 1 },
    ]);
    expect(collapseByAction(['A', 'B', 'B', 'C'], [0, 0, 1, 1])).toEqual([
      { message: 'A', count: 1 },
      { message: 'B', count: 2 },
      { message: 'C', count: 1 },
    ]);
  });

  it('folds only in a row for lines from before the log was first observed', () => {
    expect(collapseByAction(['A', 'B', 'A', 'A'], [undefined, undefined, undefined, 0])).toEqual([
      { message: 'A', count: 1 },
      { message: 'B', count: 1 },
      { message: 'A', count: 2 },
    ]);
  });

  it('shows a count only when there is more than one', () => {
    expect(runText('Sven waits a moment.', 1)).toBe('Sven waits a moment.');
    expect(runText('Brim-Howler attacks Sven for 2 damage.', 3)).toBe('Brim-Howler attacks Sven for 2 damage. (×3)');
  });
});

// The engine's log carries no action boundary, so presentation draws it: what one observe finds new is one action.
describe('ActionLogGroups', () => {
  it('leaves the lines held at the first observe ungrouped, then groups each batch of new lines', () => {
    const groups = new ActionLogGroups();
    const log = ['loaded 1', 'loaded 2'];
    expect(groups.observe(log)).toEqual([undefined, undefined]);
    log.push('a', 'b');
    const first = groups.observe(log);
    log.push('c');
    const second = groups.observe(log);
    expect(second.slice(0, 2)).toEqual([undefined, undefined]);
    expect(second[2]).toBe(second[3]);
    expect(second[2]).toBe(first[2]);
    expect(second[4]).not.toBe(second[3]);
    expect(second[4]).toBeDefined();
  });

  it('finds exactly the new lines at the 150-line cap, and adds no group when nothing is new', () => {
    const groups = new ActionLogGroups();
    const log = Array.from({ length: 149 }, (_, i) => `line ${i}`);
    groups.observe(log);
    log.push('W attacks');
    const previous = groups.observe(log);
    expect(previous).toHaveLength(150);
    // The engine pushes and shifts one line at a time once it holds 150.
    for (const line of ['W attacks', 'W waits', 'W attacks', 'W waits']) {
      log.push(line);
      log.shift();
    }
    const capped = groups.observe(log);
    expect(capped).toHaveLength(150);
    const newest = capped[149];
    expect(newest).toBeDefined();
    expect(capped.filter((g) => g === newest)).toHaveLength(4);
    expect(capped.slice(146).every((g) => g === newest)).toBe(true);
    // The line that was newest before keeps its own group, and the old lines kept theirs.
    expect(capped[145]).toBe(previous[149]);
    expect(capped[145]).not.toBe(newest);
    expect(capped.slice(0, 145)).toEqual(previous.slice(4, 149));

    const again = groups.observe(log);
    expect(again).toEqual(capped);
    expect(new Set(again).size).toBe(new Set(capped).size);
  });

  it('never changes the engine\'s log: every raw line stays for the soak and bug reports', () => {
    const groups = new ActionLogGroups();
    const raw = ['start', 'W attacks', 'W waits', 'W attacks'];
    const log = Object.freeze(raw.slice());
    groups.observe(['start']);
    expect(collapseByAction(log, groups.observe(log))).toHaveLength(3);
    expect(log).toEqual(raw);
  });

  it('after reset, the new engine\'s lines never join the old engine\'s groups', () => {
    const groups = new ActionLogGroups();
    const oldLog = ['start'];
    groups.observe(oldLog);
    oldLog.push('A', 'B');
    const before = groups.observe(oldLog);
    groups.reset();
    const newLog = ['A', 'B'];
    const baseline = groups.observe(newLog);
    expect(baseline).toEqual([undefined, undefined]);
    newLog.push('A');
    const after = groups.observe(newLog);
    expect(after[2]).toBeDefined();
    expect(after[2]).not.toBe(before[1]);
    expect(collapseByAction(newLog, after).map((r) => r.message)).toEqual(['A', 'B', 'A']);
  });
});
