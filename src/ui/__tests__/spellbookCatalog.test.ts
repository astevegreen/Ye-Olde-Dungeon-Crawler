import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { SpellbookTab } from '../characterMenu/spellbookTab';

// The Spells page (5c): every spell a hero can learn, what it does once a stone has shown it,
// where it is found, and the items that teach it.
function open(stones: boolean) {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 }, spellsKnown: ['spark'] });
  player.learningStones.shown.push('frost');
  const manifest = {
    id: 'test_pack',
    name: 'Test Pack',
    spells: [
      { id: 'spark', name: 'Spark', manaCost: 1, element: 'fire', range: 5, school: 'HealingDivination', description: 'A small flame.', effects: [] },
      { id: 'frost', name: 'Frost', manaCost: 2, element: 'cold', range: 5, description: 'A cold touch.', effects: [] },
      { id: 'storm', name: 'Storm', manaCost: 3, element: 'lightning', range: 5, description: 'A hidden storm.', effects: [] },
      { id: 'learn_storm', name: 'Learn Storm', manaCost: 0, range: 0, effects: [{ type: 'learn_spell', spellId: 'storm' }] },
    ],
    magic: stones
      ? {
          learningStones: {
            tileId: 'stone',
            shardItemId: 'shard',
            stones: [{ floor: 4 }, { floor: 6 }, { floor: 12 }],
            zones: [
              { minFloor: 1, maxFloor: 9, spellIds: ['frost'], carrierIds: [] },
              { minFloor: 10, maxFloor: 19, spellIds: ['storm'], carrierIds: [] },
            ],
            elsewhere: [{ spellIds: ['spark'], where: 'Known from the start.' }],
            messages: { tablets: 'Sold in town.', arrival: '', stoneFound: '', shardMarks: '', shortcut: '', learned: '', rune: '' },
          },
        }
      : undefined,
  } as any;
  const engine = new GameEngine({ map: new GameMap(5, 5, TILES.FLOOR), player, manifest });
  const tab = new SpellbookTab();
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } as unknown as HTMLElement;
  tab.mount(container);
  tab.onActivate({ engine, player } as any);
  const press = (code: string) => tab.handleKeyDown({ code, preventDefault: () => {} } as unknown as KeyboardEvent);
  return { tab, container, press };
}

describe('the Spells page', () => {
  it('opens on V and lists every spell, the start ones first, with how many are known', () => {
    const { container, press, tab } = open(true);
    expect(container.innerHTML).toContain('All spells');
    expect(press('KeyV')).toBe(true);
    const html = container.innerHTML;
    expect(html).toContain('1 of 3 known');
    expect(html.indexOf('Spark')).toBeLessThan(html.indexOf('Frost'));
    expect(html.indexOf('Frost')).toBeLessThan(html.indexOf('Storm'));
    expect(html).toContain('Known from the start.');
    expect(tab.footer().actions?.[0]?.label).toBe('Spells known');
  });

  it('shows what a spell does once a stone has shown it, and only its floors before', () => {
    const { container, press } = open(true);
    press('KeyV');
    press('ArrowDown');
    expect(container.innerHTML).toContain('A cold touch.');
    expect(container.innerHTML).toContain('floors 4–6');
    press('ArrowDown');
    expect(container.innerHTML).not.toContain('A hidden storm.');
    expect(container.innerHTML).toContain('Not seen yet');
    expect(container.innerHTML).toContain('floors 12–12');
    expect(container.innerHTML).toContain('Sold in town.');
  });

  it('turns back to the spells known on V, and digits slot nothing on the page', () => {
    const { container, press } = open(true);
    press('KeyV');
    expect(press('Digit1')).toBe(false);
    press('KeyV');
    expect(container.innerHTML).toContain('1 known');
  });

  it('is not offered by a pack without learning stones', () => {
    const { container, press } = open(false);
    expect(container.innerHTML).not.toContain('All spells');
    expect(press('KeyV')).toBe(false);
  });

  it('spaces a school name on the card', () => {
    const { container } = open(false);
    expect(container.innerHTML).toContain('Healing Divination');
  });
});
