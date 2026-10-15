import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { SpellbookTab } from '../characterMenu/spellbookTab';
import { FIXTURE_GRIMOIRES } from '../../../tests/fixtures/fixture-pack';

// The Spellbook keeps the forgings the hero knows (Q19, Q32): a pair of elements told by a
// read lore entry, or forged onto a known spell.
function render(flags: Record<string, boolean>, forged: Array<{ spellId: string; element: string }>) {
  const grimoireSystem = { ...FIXTURE_GRIMOIRES, forging: { titles: { 'cold+fire': 'steam', 'cold+lightning': 'hail', 'lightning+physical': 'thunder' } } };
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 }, spellsKnown: ['bolt', 'ray'], grimoireSystem });
  player.grimoireState!.forged = forged;
  const manifest = {
    id: 'test_pack',
    name: 'Test Pack',
    branding: { loreTitle: 'Old Words' },
    spells: [
      { id: 'bolt', name: 'Bolt', manaCost: 2, element: 'lightning', range: 5, effects: [] },
      { id: 'ray', name: 'Ray', manaCost: 2, element: 'cold', range: 5, effects: [] },
      { id: 'gone', name: 'Gone', manaCost: 2, element: 'cold', range: 5, effects: [] },
    ],
    loreEntries: [{ flag: 'stone_2', title: 'Accord', verse: 'v', lore: 'l', forgePair: ['fire', 'cold'] }],
    magic: {
      grimoires: grimoireSystem,
      altars: [{ id: 'forge', name: 'The Anvil-Stone', description: '', rite: 'forge', performedMessage: '', spentMessage: '' }],
    },
  } as any;
  const engine = new GameEngine({ map: new GameMap(5, 5, TILES.FLOOR), player, manifest });
  Object.assign(engine.worldState.flags, flags);
  const tab = new SpellbookTab();
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } as unknown as HTMLElement;
  tab.mount(container);
  tab.onActivate({ engine, player } as any);
  return container.innerHTML;
}

describe('Spellbook forging', () => {
  it('lists none known, with where they are forged and where they are told', () => {
    const html = render({}, []);
    expect(html).toContain('Forging');
    expect(html).toContain('0 of 3 known');
    expect(html).toContain('The Anvil-Stone');
    expect(html).toContain('Old Words');
  });

  it('knows a pair from a read lore entry, and one forged onto a known spell, but not one unheard of', () => {
    const html = render({ stone_2: true }, [
      { spellId: 'bolt', element: 'physical' },
      { spellId: 'gone', element: 'lightning' },
    ]);
    expect(html).toContain('2 of 3 known');
    expect(html).toMatch(/steam-forged<\/span>[^<]*<span[^>]*>cold \+ fire/);
    expect(html).toMatch(/thunder-forged<\/span>[^<]*<span[^>]*>lightning \+ physical<\/span><span[^>]*>known/);
    expect(html).not.toContain('hail-forged');
  });
});
