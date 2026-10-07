import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player } from '../../engine';
import { SpellbookTab } from '../characterMenu/spellbookTab';

// The grimoire grid explains itself (tracker 1.3): lines join slots whose spells shape each
// other, and pointing at a slot says what it does.
function setup() {
  const map = new GameMap(10, 10, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 },
    spellsKnown: ['t:arrow', 't:ward'],
  });
  const manifest = {
    id: 'test_pack',
    name: 'Test Pack',
    spells: [
      { id: 't:arrow', name: 'Arrow', manaCost: 10, element: 'arcane', range: 6, effects: [{ type: 'damage', amount: 10 }] },
      { id: 't:ward', name: 'Ward', manaCost: 2, element: 'arcane', range: 0, effects: [] },
    ],
    magic: {
      grimoire: {
        title: 'Grimoire',
        pageNames: ['I', 'II', 'III'],
        initialOpenSlots: [1, 3, 4, 5, 7],
        centerSlotLabel: 'Hub',
        centerCostPerNeighbor: 0.5,
        centerPowerPerNeighbor: 1,
        lockedSlotLabel: 'Shut',
      },
    },
  } as any;
  player.grimoireOpenSlots = [1, 3, 4, 5, 7];
  const engine = new GameEngine({ map, player, manifest });
  player.setGrimoireSlot(4, 't:arrow');
  player.setGrimoireSlot(3, 't:ward');
  const tab = new SpellbookTab();
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null } as unknown as HTMLElement;
  tab.mount(container);
  tab.onActivate({ engine, player } as any);
  return { tab, container };
}

describe('Spellbook grimoire grid', () => {
  it('lights the link between two slots that shape each other, and only that one', () => {
    const { container } = setup();
    const lit = container.innerHTML.match(/<i class="sb-link is-h is-on" title="([^"]*)"/g) ?? [];
    expect(lit).toHaveLength(1);
    expect(lit[0]).toContain('Slots 4 and 5: Hub draws on its neighbor');
    expect(container.innerHTML.match(/is-on/g)).toHaveLength(1);
  });

  it('describes each slot: the center rule, the cast from it, and a sealed slot', () => {
    const { tab } = setup();
    const info = (tab as any).slotInfo as string[];
    expect(info[4]).toContain('Hub: a spell here costs +50% and gains +100% power for each filled slot beside it.');
    expect(info[4]).toContain('Arrow cast from here: 15');
    expect(info[4]).toContain('power 20');
    expect(info[0]).toContain('Slot 1: Shut.');
    expect(info[5]).toContain('Click to move Arrow here.');
  });
});
