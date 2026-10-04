import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { SpellbookTab } from '../characterMenu/spellbookTab';

// The Spellbook keeps the fusions the hero knows (Q19, Q32): told by a read lore entry, or
// forged (the fused spell is known).
function render(flags: Record<string, boolean>, spellsKnown: string[]) {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 1, y: 1 }, spellsKnown });
  const manifest = {
    id: 'test_pack',
    name: 'Test Pack',
    branding: { loreTitle: 'Old Words' },
    spells: [
      { id: 'bolt', name: 'Bolt', manaCost: 2, element: 'lightning', range: 5 },
      { id: 'steam', name: 'Steam', manaCost: 9, element: 'fire', range: 7 },
      { id: 'hail', name: 'Hail', manaCost: 9, element: 'cold', range: 7 },
      { id: 'maul', name: 'Maul', manaCost: 9, element: 'lightning', range: 7 },
    ],
    loreEntries: [{ flag: 'stone_2', title: 'Accord', verse: 'v', lore: 'l', fusionSpellId: 'steam' }],
    magic: {
      hybrids: [
        { elements: ['fire', 'cold'], spellId: 'steam' },
        { elements: ['cold', 'lightning'], spellId: 'hail' },
        { elements: ['lightning', 'physical'], spellId: 'maul' },
      ],
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

describe('Spellbook fusions', () => {
  it('lists none known, with where they are forged and where they are told', () => {
    const html = render({}, ['bolt']);
    expect(html).toContain('Fusions');
    expect(html).toContain('0 of 3 known');
    expect(html).toContain('The Anvil-Stone');
    expect(html).toContain('Old Words');
  });

  it('knows a fusion from a read lore entry, and one forged, but not one unheard of', () => {
    const html = render({ stone_2: true }, ['bolt', 'maul']);
    expect(html).toContain('2 of 3 known');
    expect(html).toMatch(/Steam<\/span>[^<]*<span[^>]*>fire \+ cold/);
    expect(html).toContain('Maul');
    expect(html).not.toContain('>Hail<');
  });
});
