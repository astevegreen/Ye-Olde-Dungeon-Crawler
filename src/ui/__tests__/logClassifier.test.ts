import { describe, it, expect } from 'vitest';
import { classifyLogLine, CriticalLineTracker, collapseRepeats, runText } from '../logClassifier';

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
  it('collapses lines repeated in a row, and only in a row', () => {
    const hit = 'Brim-Howler attacks Sven for 2 damage.';
    expect(collapseRepeats([hit, hit, hit, 'Sven is afflicted with slow!', hit])).toEqual([
      { message: hit, count: 3 },
      { message: 'Sven is afflicted with slow!', count: 1 },
      { message: hit, count: 1 },
    ]);
  });

  it('shows a count only when there is more than one', () => {
    expect(runText('Sven waits a moment.', 1)).toBe('Sven waits a moment.');
    expect(runText('Brim-Howler attacks Sven for 2 damage.', 3)).toBe('Brim-Howler attacks Sven for 2 damage. (×3)');
  });
});
