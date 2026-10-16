import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LearningStoneCard } from '../learningStoneCard';
import type { LearningStoneCard as StoneCardData } from '../../engine';

// No DOM library: a scrim stub holding the markup.
class FakeScrim {
  id = '';
  className = '';
  innerHTML = '';
  style: Record<string, string> = {};
  appendChild(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
}

const data = (over: Partial<StoneCardData> = {}): StoneCardData => ({
  stoneName: 'Broken Stone',
  faces: [
    { id: 'firebolt', name: 'Firebolt', description: 'A bolt of fire.' },
    { id: 'phase_door', name: 'Phase Door', description: 'A short hop.' },
  ],
  shortcut: false,
  costShare: 1,
  runeName: 'Fire Rune',
  ...over,
});

const key = (k: string) => ({ key: k, preventDefault: () => {} }) as unknown as KeyboardEvent;

describe('LearningStoneCard', () => {
  const scrim = new FakeScrim();
  let read: Array<string | null>;
  let closed: number;
  const make = () => new LearningStoneCard({ onRead: (id) => read.push(id), onClose: () => closed++ });

  beforeEach(() => {
    read = [];
    closed = 0;
    scrim.innerHTML = '';
    (globalThis as any).document = {
      getElementById: () => null,
      createElement: () => scrim,
      body: { appendChild: () => {} },
    };
  });
  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('shows both faces to read, the rune, and Not now', () => {
    make().open(data());
    expect(scrim.innerHTML).toContain('Read Firebolt');
    expect(scrim.innerHTML).toContain('Read Phase Door');
    expect(scrim.innerHTML).toContain('Take Fire Rune');
    expect(scrim.innerHTML).toContain('Not now');
    expect(scrim.innerHTML).not.toContain('less for the rest');
  });

  it('reads a face by its number key, and closes', () => {
    const card = make();
    card.open(data());
    card.handleKeyDown(key('2'));
    expect(read).toEqual(['phase_door']);
    expect(closed).toBe(1);
    expect(card.isOpen).toBe(false);
  });

  it('closes on Escape without reading', () => {
    const card = make();
    card.open(data());
    card.handleKeyDown(key('Escape'));
    expect(read).toEqual([]);
    expect(closed).toBe(1);
  });

  it('says what a shortcut saves', () => {
    make().open(data({ shortcut: true, costShare: 0.9 }));
    expect(scrim.innerHTML).toContain('10% less for the rest of this run');
    expect(scrim.innerHTML).toContain('The shard sings');
  });

  it('with no spell left, offers only the rune', () => {
    make().open(data({ faces: [] }));
    expect(scrim.innerHTML).not.toContain('Read ');
    expect(scrim.innerHTML).toContain('no spell left');
    expect(scrim.innerHTML).toContain('Take Fire Rune');
  });
});
