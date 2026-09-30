import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuickSpellsBar } from '../quickSpellsBar';
import { GameEngine, GameMap, TILES, Player } from '../../engine';

// No DOM library is installed (see bottomStatusBar.test.ts), so this stubs just
// what QuickSpellsBar touches: slot buttons and the name span it fills by selector.
class FakeSlot {
  className = '';
  title = '';
  innerHTML = '';
  hidden = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  readonly nameEl = { textContent: '' };
  type = '';
  addEventListener(): void {}
  setAttribute(): void {}
  appendChild(): void {}
  querySelector(selector: string) {
    return selector === '.slot-badge-name' ? this.nameEl : null;
  }
}

function buildEngine(quickSpells: string[]) {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  player.mana = 5;
  player.maxMana = 20;
  const manifest = {
    id: 'test_pack',
    name: 'Test Pack',
    spells: [
      { id: 'test:arrow', name: 'Magic Arrow', manaCost: 3 },
      { id: 'test:nova', name: 'Frost Nova Of The North', manaCost: 9 },
    ],
  } as any;
  const engine = new GameEngine({ map, player, manifest });
  quickSpells.forEach((id, i) => {
    player.quickSpells[i] = id;
  });
  return engine;
}

describe('QuickSpellsBar', () => {
  const created: FakeSlot[] = [];

  beforeEach(() => {
    created.length = 0;
    (globalThis as any).document = {
      createElement: () => {
        const el = new FakeSlot();
        created.push(el);
        return el;
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  const slots = () => created.slice(1); // created[0] is the bar container

  it('shows filled slots under their full names, plus a single "+ Spell" slot', () => {
    const bar = new QuickSpellsBar({ onTriggerSlot: () => {}, onOpenSpellbook: () => {} });
    bar.update(buildEngine(['test:arrow', 'test:nova']));

    const s = slots();
    expect(s).toHaveLength(10);
    expect(s[0].nameEl.textContent).toBe('Magic Arrow');
    expect(s[1].nameEl.textContent).toBe('Frost Nova Of The North');
    expect(s[2].hidden).toBe(false);
    expect(s[2].className).toContain('quick-spell-slot-add');
    expect(s.slice(3).every((slot) => slot.hidden)).toBe(true);
  });

  it('marks a spell you cannot afford and says why in its tooltip', () => {
    const bar = new QuickSpellsBar({ onTriggerSlot: () => {}, onOpenSpellbook: () => {} });
    bar.update(buildEngine(['test:arrow', 'test:nova']));

    const nova = slots()[1];
    expect(nova.className).toContain('quick-spell-slot-nomana');
    expect(nova.title).toContain('9 MP (you have 5)');
  });

  it('keeps a spell on its own key when earlier keys are empty', () => {
    const bar = new QuickSpellsBar({ onTriggerSlot: () => {}, onOpenSpellbook: () => {} });
    const engine = buildEngine([]);
    engine.player.quickSpells[4] = 'test:arrow';
    bar.update(engine);

    const s = slots();
    expect(s[0].className).toContain('quick-spell-slot-add'); // first free key
    expect(s[1].hidden).toBe(true);
    expect(s[4].hidden).toBe(false);
    expect(s[4].title).toContain('[5] Magic Arrow');
  });
});
