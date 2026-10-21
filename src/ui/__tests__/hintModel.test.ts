import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine, GameMap, TILES, Player, Item, Container, ProfileManager, MemoryStorage } from '../../engine';
import { hintFlag, hintsMetByEvent, hintsMetByState, itemHintFlag, itemHintsMet, resolveHintText, unseenHints } from '../hints/hintModel';
import { FirstTimeHints } from '../hints/firstTimeHints';
import { cotwManifest } from '../../content/cotw';

function buildEngine(manifest: Record<string, unknown> = {}) {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 }, stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 } });
  const engine = new GameEngine({ map, player, manifest: { id: 'test_pack', name: 'Test', ...manifest } as any });
  engine.fov.update(engine.map, player.x, player.y, 8);
  return engine;
}

const RUNE = {
  id: 'rune_a',
  name: 'Rune A',
  category: 'quest',
  weight: 1,
  bulk: 1,
  firstPickupHint: { title: 'Rune A', text: 'It hums.' },
};
const carry = (engine: GameEngine, definitionId: string) =>
  engine.player.inventory.storeItem(new Item({ id: `${definitionId}-1`, definitionId, name: definitionId, category: 'quest', weight: 1, bulk: 1 }));

const HINTS = {
  altar: { title: 'Altars', text: 'Burn an offering.' },
  story: { title: 'Your saga', text: 'The Story tab ({key:story}) keeps it.' },
  factionStanding: { title: 'Standing', text: 'It moved.' },
};

describe('first-time hints', () => {
  it('offers only hints the pack wrote and this hero has not been shown, once each', () => {
    const engine = buildEngine({ firstTimeHints: HINTS });
    expect(unseenHints(engine, ['altar', 'companion', 'altar', 'story'])).toEqual(['altar', 'story']);

    engine.player.markTutorialSeen(hintFlag('altar'));
    expect(unseenHints(engine, ['altar', 'story'])).toEqual(['story']);
  });

  it('meets the altar hint on reaching an altar, and the kill-rite hint on a rite', () => {
    expect(hintsMetByEvent({ type: 'altar_reached', turn: 3, data: {} } as any)).toEqual(['altar']);
    expect(hintsMetByEvent({ type: 'kill_rite_performed', turn: 3, data: {} } as any)).toEqual(['killRite']);
    expect(hintsMetByEvent({ type: 'entity_killed', turn: 3, data: {} } as any)).toEqual([]);
  });

  it('meets the standing hint once a faction moves from where it began, not before', () => {
    const engine = buildEngine({ initialWorldState: { flags: {}, counters: {}, factions: { clans: -10 } } });
    engine.worldState.factions.clans = -10;
    expect(hintsMetByState(engine)).not.toContain('factionStanding');
    engine.worldState.factions.clans = -5;
    expect(hintsMetByState(engine)).toContain('factionStanding');
  });

  it('meets the saga hint with the first deed done', () => {
    const engine = buildEngine({ trackedMilestones: [{ id: 'm1', flag: 'deed_one', title: 'One', description: '' }] });
    expect(hintsMetByState(engine)).not.toContain('story');
    engine.worldState.flags.deed_one = true;
    expect(hintsMetByState(engine)).toContain('story');
  });

  it('meets the grimoire hint in the dungeon once the hero knows two spells, not in town', () => {
    const engine = buildEngine({ magic: { grimoires: { layouts: [], stats: [] } as never } });
    engine.player.learnSpell('a');
    engine.player.learnSpell('b');
    engine.currentFloor = 0;
    expect(hintsMetByState(engine)).not.toContain('grimoire');
    engine.currentFloor = 1;
    expect(hintsMetByState(engine)).toContain('grimoire');
    expect(hintsMetByState(buildEngine())).not.toContain('grimoire');
  });

  it('meets the unidentified hint once the hero carries something that can be identified and is not', () => {
    const engine = buildEngine();
    const thing = (id: string, category: string, identified: boolean) =>
      new Item({ id, definitionId: id, name: id, category: category as never, weight: 1, bulk: 1, identified });
    expect(hintsMetByState(engine)).not.toContain('unidentified');
    engine.player.inventory.storeItem(thing('known_sword', 'weapon', true));
    engine.player.inventory.storeItem(thing('odd_stone', 'quest', false));
    expect(hintsMetByState(engine)).not.toContain('unidentified');
    engine.player.inventory.storeItem(thing('strange_sword', 'weapon', false));
    expect(hintsMetByState(engine)).toContain('unidentified');
  });

  it('meets the unidentified hint for an item inside a worn pouch', () => {
    const engine = buildEngine();
    const belt = new Container({ id: 'belt', name: 'Belt', category: 'container', containerType: 'belt', weight: 100, bulk: 100, maxWeightCapacity: 9000, maxBulkCapacity: 9000, maxSlots: 4 });
    engine.player.inventory.paperdoll.equip(belt, 'waist');
    expect(belt.addItem(new Item({ id: 'birch_wand', definitionId: 'birch_wand', name: 'Birch Wand', category: 'wand', weight: 1, bulk: 1 }))).toBe(true);
    expect(hintsMetByState(engine)).toContain('unidentified');
  });

  it('does not meet the unidentified hint on a new cotw hero, who carries only the starting kit', () => {
    const engine = new ProfileManager(new MemoryStorage(), cotwManifest).createCharacter('Hild', { manifest: cotwManifest }).engine;
    const unknown = engine.player.inventory.getAllCarriedItems().filter((item) => !item.identified && item.canBeIdentified());
    expect(unknown.map((item) => item.definitionId)).toEqual([]);
    expect(hintsMetByState(engine)).not.toContain('unidentified');
  });

  it('offers the unidentified hint only from a pack that wrote one', () => {
    const engine = buildEngine({ firstTimeHints: HINTS });
    expect(unseenHints(engine, ['unidentified'])).toEqual([]);
    expect(unseenHints(buildEngine({ firstTimeHints: cotwManifest.firstTimeHints }), ['unidentified'])).toEqual(['unidentified']);
  });

  it('cotw tells, in two sentences at most, who names unknown things: Mimir, the scroll and Lore-Keeper', () => {
    const text = cotwManifest.firstTimeHints?.unidentified?.text ?? '';
    for (const name of ['Sage Mimir', 'Scroll of Identify', 'Lore-Keeper', 'Intelligence 20']) expect(text).toContain(name);
    // Lore-Keeper names only what was carried since the previous stairs (perks.ts, identifyCarriedSinceStairs).
    expect(text).toContain('since the last stairs');
    expect(text.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
  });

  it("meets an item's first-pickup hint once the hero carries one, until it is shown", () => {
    const engine = buildEngine({ items: [RUNE, { ...RUNE, id: 'plain', firstPickupHint: undefined }] });
    expect(itemHintsMet(engine)).toEqual([]);
    carry(engine, 'plain');
    expect(itemHintsMet(engine)).toEqual([]);
    carry(engine, 'rune_a');
    expect(itemHintsMet(engine)).toEqual(['rune_a']);
    engine.player.markTutorialSeen(itemHintFlag('rune_a'));
    expect(itemHintsMet(engine)).toEqual([]);
  });

  it('names the bound key in the text, or the action when nothing is bound', () => {
    expect(resolveHintText(HINTS.story, (a) => (a === 'story' ? 'O' : undefined)).text).toBe('The Story tab (O) keeps it.');
    expect(resolveHintText({ title: 't', text: 'Press {key:channel_rune}.' }, () => undefined).text).toBe('Press channel rune.');
  });
});

/** Just enough DOM for the hint card: elements that hold children, text and listeners. */
class HintEl {
  public className = '';
  public hidden = false;
  public textContent = '';
  public type = '';
  public title = '';
  public children: unknown[] = [];
  setAttribute(): void {}
  append(...children: unknown[]): void {
    this.children.push(...children);
  }
  replaceChildren(...children: unknown[]): void {
    this.children = children;
  }
  addEventListener(): void {}
}

describe('FirstTimeHints', () => {
  let originalDocument: unknown;
  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: () => new HintEl() };
  });
  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('records a hint as seen once it is on screen, so those queued behind it outlive a quit or load (R-ui-17)', () => {
    const engine = buildEngine({ firstTimeHints: HINTS });
    const hints = new FirstTimeHints({ keyFor: () => undefined, enabled: () => true });
    const [, text, next] = (hints.element as unknown as HintEl).children as HintEl[];
    const seen = (id: 'altar' | 'story' | 'factionStanding') => engine.player.tutorialFlags[hintFlag(id)] === true;

    hints.offer(engine, ['altar', 'story', 'factionStanding']);
    expect(text.textContent).toBe('Burn an offering.');
    expect([seen('altar'), seen('story'), seen('factionStanding')]).toEqual([true, false, false]);
    // Met again on the next turn: still queued once.
    hints.offer(engine, ['story', 'factionStanding']);
    expect(next.textContent).toBe('Next hint (2 more)');

    // A load (or hints turned off and on) drops the queue; what wasn't shown comes back.
    hints.clear();
    hints.offer(engine, ['altar', 'story', 'factionStanding']);
    expect(text.textContent).toBe('The Story tab (story) keeps it.');
    expect(next.textContent).toBe('Next hint (1 more)');
    expect(seen('story')).toBe(true);
    hints.dismiss();
    expect(text.textContent).toBe('It moved.');
    expect(seen('factionStanding')).toBe(true);
  });

  it("queues an item's first-pickup hint behind the others, once, and records it when shown", () => {
    const engine = buildEngine({ firstTimeHints: HINTS, items: [RUNE] });
    const hints = new FirstTimeHints({ keyFor: () => undefined, enabled: () => true });
    const [head, text, next] = (hints.element as unknown as HintEl).children as HintEl[];

    hints.offer(engine, ['altar']);
    hints.offerItems(engine, ['rune_a']);
    hints.offerItems(engine, ['rune_a']);
    expect(next.textContent).toBe('Next hint (1 more)');
    expect(engine.player.tutorialFlags[itemHintFlag('rune_a')]).toBeUndefined();
    hints.dismiss();
    expect(text.textContent).toBe('It hums.');
    expect((head.children[0] as HintEl).children).toContain(' Rune A');
    expect(engine.player.tutorialFlags[itemHintFlag('rune_a')]).toBe(true);
  });

  it('shows the unidentified hint once per hero, and never with first-time hints turned off', () => {
    const engine = buildEngine({ firstTimeHints: { unidentified: { title: 'Unknown things', text: 'Ask the sage.' } } });
    let enabled = false;
    const hints = new FirstTimeHints({ keyFor: () => undefined, enabled: () => enabled });
    const [, text] = (hints.element as unknown as HintEl).children as HintEl[];
    expect(hints.hasUnseen(engine)).toBe(true);
    hints.offer(engine, ['unidentified']);
    expect(hints.element.hidden).toBe(true);
    expect(engine.player.tutorialFlags['hint:unidentified']).toBeUndefined();

    enabled = true;
    hints.offer(engine, ['unidentified']);
    expect(text.textContent).toBe('Ask the sage.');
    expect(engine.player.tutorialFlags['hint:unidentified']).toBe(true);
    hints.dismiss();
    hints.offer(engine, ['unidentified']);
    expect(hints.element.hidden).toBe(true);
    expect(hints.hasUnseen(engine)).toBe(false);
  });

  it('offers no item hint with first-time hints turned off', () => {
    const engine = buildEngine({ items: [RUNE] });
    const hints = new FirstTimeHints({ keyFor: () => undefined, enabled: () => false });
    hints.offerItems(engine, ['rune_a']);
    expect(hints.element.hidden).toBe(true);
    expect(engine.player.tutorialFlags[itemHintFlag('rune_a')]).toBeUndefined();
  });
});
