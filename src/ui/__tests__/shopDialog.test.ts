import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { GameEngine, GameMap, Item, Merchant, NPC, Player, addCoinsToContainer, type GameContentManifest, type NpcRole } from '../../engine';
import { COTW_PACTS } from '../../content/cotw/pacts';
import { ShopDialog } from '../shop/shopDialog';
import { servicePanelFor, servicePanelHtml, type ShopAction } from '../shop/shopPanels';

// The tests run under node, so the dialog renders into a stand-in scrim whose
// innerHTML is the dialog's markup; querySelector finds nothing, as with the
// other dialog tests.
class MockElement {
  public id = '';
  public className = '';
  public style: Record<string, string> = {};
  public innerHTML = '';
  appendChild(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
}

class MockDocument {
  public overlay: MockElement | null = null;
  getElementById(id: string): MockElement | null {
    if (id === 'app') {
      const app = new MockElement();
      app.appendChild = (el?: unknown) => {
        this.overlay = el as MockElement;
      };
      return app;
    }
    return this.overlay && this.overlay.id === id ? this.overlay : null;
  }
  createElement(): MockElement {
    return new MockElement();
  }
}

const key = (k: string) => ({ key: k, code: k, preventDefault: () => {} }) as unknown as KeyboardEvent;

function testEngine(): GameEngine {
  return new GameEngine({
    map: new GameMap(20, 20),
    player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
    floor: 0,
  });
}

function npc(role: NpcRole, dialogText = 'Well met, traveler.'): NPC {
  return new NPC({ id: `npc_${role}`, name: `Test ${role}`, position: { x: 6, y: 5 }, role, dialogText });
}

function ware(id: string, name: string): Item {
  return new Item({ id, name, category: 'misc', weight: 800, bulk: 600, quality: 'normal', identified: true, value: 5 });
}

describe('ShopDialog', () => {
  let originalDocument: unknown;
  let doc: MockDocument;
  let engine: GameEngine;
  let dispatch: MockInstance<GameEngine['commandBus']['dispatch']>;

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    doc = new MockDocument();
    (globalThis as any).document = doc;
    engine = testEngine();
    dispatch = vi.spyOn(engine.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  const html = () => doc.overlay?.innerHTML ?? '';
  const commandTypes = () => dispatch.mock.calls.map((c) => (c[0] as { type: string }).type);

  // Each offer's key must reach its own command, so a swapped wiring fails here.
  const EXPECTED: Partial<Record<ShopAction, string>> = {
    cleanse: 'temple_cleanse',
    heal: 'temple_heal',
    identify: 'sage_identify',
    advise: 'sage_advisory',
    compact: 'bank_compact',
    bond: 'trainer_bond_companion',
    revive: 'trainer_revive_companion',
    bodyguard: 'trainer_switch_archetype',
    skirmisher: 'trainer_switch_archetype',
    teach: 'trainer_teach_skill',
  };

  for (const role of ['priest', 'banker', 'trainer'] as NpcRole[]) {
    it(`runs each ${role} offer from its own key`, () => {
      // Loose copper, so the banker has something to exchange.
      addCoinsToContainer(engine.player.inventory.primaryPack, 'copper', 50);
      const shop = new ShopDialog();
      const who = npc(role);
      shop.open(who, null, engine);
      const offers = servicePanelFor(engine, who)!.offers.filter((o) => !o.disabled);
      expect(offers.length).toBeGreaterThan(0);
      for (const offer of offers) {
        dispatch.mockClear();
        shop.handleKeyDown(key(offer.key.toLowerCase()), engine);
        expect(commandTypes(), `${role} ${offer.key}`).toEqual([EXPECTED[offer.act]]);
      }
    });
  }

  it('passes the archetype each trainer key asks for', () => {
    const shop = new ShopDialog();
    shop.open(npc('trainer'), null, engine);
    shop.handleKeyDown(key('g'), engine);
    shop.handleKeyDown(key('k'), engine);
    const archetypes = dispatch.mock.calls.map((c) => (c[0] as { payload?: { archetype?: string } }).payload?.archetype);
    expect(archetypes).toEqual(['bodyguard', 'skirmisher']);
  });

  it("leaves a disabled offer's key inert (nothing to identify)", () => {
    const shop = new ShopDialog();
    shop.open(npc('sage'), null, engine);
    shop.handleKeyDown(key('i'), engine);
    expect(dispatch).not.toHaveBeenCalled();
    shop.handleKeyDown(key('a'), engine);
    expect(commandTypes()).toEqual(['sage_advisory']);
  });

  it('identifies the item the hero chooses, not the first one in the pack (N25)', () => {
    const unknown = (id: string, category: 'weapon' | 'boots' | 'ring') =>
      new Item({ id, name: id, category, weight: 500, bulk: 300, quality: 'normal', identified: false, value: 50 });
    const pack = engine.player.inventory.primaryPack;
    for (const item of [unknown('spear', 'weapon'), unknown('boots', 'boots'), unknown('ring', 'ring')]) pack.addItem(item);
    // A container is never identified, so the sage doesn't offer it (or charge for it).
    pack.addItem(new Item({ id: 'frame', name: 'Tool-Frame', category: 'container', weight: 900, bulk: 900, quality: 'normal', identified: false, value: 50 }));

    const shop = new ShopDialog();
    shop.open(npc('sage'), null, engine);
    expect(html().match(/data-choice=/g)).toHaveLength(3);
    expect(html()).not.toContain('Tool-Frame');
    shop.handleKeyDown(key('ArrowDown'), engine);
    shop.handleKeyDown(key('ArrowDown'), engine);
    shop.handleKeyDown(key('ArrowDown'), engine); // stays on the last row
    expect(html()).toMatch(/is-selected[^>]*data-choice="2"/);
    shop.handleKeyDown(key('i'), engine);
    const sent = dispatch.mock.calls.map((c) => c[0] as { type: string; payload?: { item?: Item } });
    expect(sent.map((c) => [c.type, c.payload?.item?.id])).toEqual([['sage_identify', 'ring']]);
  });

  it('lets only the pact keeper seal and renounce pacts, one number key each', () => {
    const keeperEngine = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
      manifest: { ...testEngine().manifest, pacts: COTW_PACTS, pactKeeperNpcId: 'npc_sage' } as GameContentManifest,
    });
    const keeperDispatch = vi.spyOn(keeperEngine.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Sealed.' });
    expect(servicePanelFor(engine, npc('sage'))!.offers.some((o) => o.act === 'pact')).toBe(false);

    const shop = new ShopDialog();
    shop.open(npc('sage'), null, keeperEngine);
    expect(html()).toContain('Seal the Pact of the Blood Moon');
    shop.handleKeyDown(key('2'), keeperEngine);
    expect(keeperDispatch.mock.calls.map((c) => c[0])).toEqual([{ type: 'pact_toggle', payload: { pactId: COTW_PACTS[1].id } }]);
  });

  it('seals a pact through the command bus, and renounces it the second time', () => {
    const keeperEngine = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
      manifest: { ...testEngine().manifest, pacts: COTW_PACTS } as GameContentManifest,
    });
    const id = COTW_PACTS[0].id;
    expect(keeperEngine.commandBus.dispatch({ type: 'pact_toggle', payload: { pactId: id } }).message).toBe(`Sealed: ${COTW_PACTS[0].name}.`);
    expect(keeperEngine.pacts.isPactActive(id)).toBe(true);
    expect(keeperEngine.commandBus.dispatch({ type: 'pact_toggle', payload: { pactId: id } }).message).toBe(`Renounced: ${COTW_PACTS[0].name}.`);
    expect(keeperEngine.pacts.isPactActive(id)).toBe(false);
    expect(keeperEngine.commandBus.dispatch({ type: 'pact_toggle', payload: { pactId: 'nope' } }).success).toBe(false);
  });

  it("opens the bestiary from the sage's B, which the canvas shop read as its Buy tab", () => {
    const shop = new ShopDialog();
    const onOpenCompendium = vi.fn();
    shop.onOpenCompendium = onOpenCompendium;
    shop.open(npc('sage'), null, engine);
    shop.handleKeyDown(key('b'), engine);
    expect(onOpenCompendium).toHaveBeenCalledTimes(1);
    expect(shop.isOpen).toBe(false);
  });

  it('closes on Escape, tells the stack, and swallows other keys while open', () => {
    const shop = new ShopDialog();
    const onClose = vi.fn();
    shop.onClose = onClose;
    shop.open(npc('guard'), null, engine);
    expect(shop.handleKeyDown(key('q'), engine)).toBe(true);
    expect(shop.handleKeyDown(key('Escape'), engine)).toBe(true);
    expect(shop.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(shop.handleKeyDown(key('q'), engine)).toBe(false);
  });

  describe('merchant', () => {
    const merchant = () =>
      new Merchant('shop', 'Trader', 'General Store', 'general', 'Welcome!', [
        ware('torch', 'Wooden Torch'),
        ware('bread', 'Travel Bread'),
        ware('rope', 'Rope'),
      ]);

    it('buys the selected item by its id with Enter, and any of the first nine at once by number', () => {
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      shop.handleKeyDown(key('ArrowDown'), engine);
      shop.handleKeyDown(key('Enter'), engine);
      shop.handleKeyDown(key('3'), engine);
      const ids = dispatch.mock.calls.map((c) => (c[0] as unknown as { payload: { itemIndex: string } }).payload.itemIndex);
      expect(commandTypes()).toEqual(['buy_item', 'buy_item']);
      expect(ids).toEqual(['bread', 'rope']);
    });

    it('stacks identical goods into one row with a count, and a trade takes one of them', () => {
      const shop = new ShopDialog();
      const stocked = new Merchant('shop', 'Trader', 'General Store', 'general', 'Welcome!', [
        ware('torch-1', 'Wooden Torch'),
        ware('torch-2', 'Wooden Torch'),
        ware('torch-3', 'Wooden Torch'),
        ware('bread', 'Travel Bread'),
      ]);
      shop.open(npc('merchant'), stocked, engine);
      const markup = html();
      expect(markup.match(/data-row=/g)).toHaveLength(2);
      expect(markup).toContain('×3');
      shop.handleKeyDown(key('2'), engine);
      shop.handleKeyDown(key('1'), engine);
      const ids = dispatch.mock.calls.map((c) => (c[0] as unknown as { payload: { itemIndex: string } }).payload.itemIndex);
      expect(ids).toEqual(['bread', 'torch-1']);
    });

    it('keeps the selection inside the list', () => {
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      for (let i = 0; i < 6; i++) shop.handleKeyDown(key('ArrowDown'), engine);
      expect(shop.selectedBuyIndex).toBe(2);
      for (let i = 0; i < 6; i++) shop.handleKeyDown(key('ArrowUp'), engine);
      expect(shop.selectedBuyIndex).toBe(0);
    });

    it('switches lists with B, S and Tab, and sells from the pack', () => {
      engine.player.inventory.primaryPack.addItem(ware('old-boot', 'Old Boot'));
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      shop.handleKeyDown(key('s'), engine);
      expect(shop.activeTab).toBe('sell');
      shop.handleKeyDown(key('Tab'), engine);
      expect(shop.activeTab).toBe('buy');
      shop.handleKeyDown(key('Tab'), engine);
      shop.handleKeyDown(key('Enter'), engine);
      expect(commandTypes()).toEqual(['sell_item']);
      shop.handleKeyDown(key('b'), engine);
      expect(shop.activeTab).toBe('buy');
    });

    it('sells all junk with J and its button, and shows junk apart in the Sell list (2.5)', () => {
      const pack = engine.player.inventory.primaryPack;
      const marked = ware('junk-boot', 'Old Boot');
      marked.junk = true;
      pack.addItem(marked);
      pack.addItem(ware('good-boot', 'Old Boot'));
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      shop.handleKeyDown(key('s'), engine);
      const markup = html();
      // The junk boot is its own row, tagged, and the button names how many and what they fetch.
      expect(markup.match(/data-row=/g)).toHaveLength(2);
      expect(markup).toContain('shop-junk');
      expect(markup).toContain('data-act="sell-junk"');
      expect(markup).toMatch(/Sell all junk \(1\)/);
      shop.handleKeyDown(key('j'), engine);
      expect(commandTypes()).toEqual(['sell_junk']);
    });

    it('offers no junk sale when nothing is marked', () => {
      engine.player.inventory.primaryPack.addItem(ware('good-boot', 'Old Boot'));
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      shop.handleKeyDown(key('s'), engine);
      expect(html()).not.toContain('data-act="sell-junk"');
      shop.handleKeyDown(key('j'), engine);
      expect(commandTypes()).toEqual([]);
    });

    it("shows a ware's stats, its slot and how it compares with what is worn (N20)", () => {
      const worn = new Item({ id: 'old-sword', name: 'Old Sword', category: 'weapon', slot: 'mainHand', weight: 1500, bulk: 900, identified: true, stats: { attackBonus: 2 } });
      engine.player.inventory.paperdoll.equip(worn);
      const sword = new Item({ id: 'sword', name: 'Fine Sword', category: 'weapon', slot: 'mainHand', weight: 1600, bulk: 900, identified: true, value: 90, stats: { attackBonus: 5 }, description: 'A fine blade.' });
      const shop = new ShopDialog();
      shop.open(npc('merchant'), new Merchant('arm', 'Smith', 'Armory', 'armory', 'Hi', [sword]), engine);
      const markup = html();
      expect(markup).toContain('<dt>Attack</dt><dd class="ui-num">+5</dd>');
      expect(markup).toMatch(/Goes on: Main Hand</i);
      expect(markup).toContain('Against your');
      expect(markup).toContain('Old Sword');
      expect(markup).toMatch(/<dt>Attack<\/dt><dd class="ui-num ui-up">\+3<\/dd>/);
      expect(markup).toContain('A fine blade.');
    });

    it("keeps an unidentified ware's description and stats to itself (N20)", () => {
      const blade = new Item({ id: 'blade', name: 'Cursed Cleaver', unidentifiedName: 'Heavy Blade', category: 'weapon', slot: 'mainHand', weight: 1600, bulk: 900, identified: false, value: 90, stats: { attackBonus: 7 }, description: 'Its cursed rot inhibits natural healing.' });
      const shop = new ShopDialog();
      shop.open(npc('merchant'), new Merchant('arm', 'Smith', 'Armory', 'armory', 'Hi', [blade]), engine);
      const markup = html();
      expect(markup).not.toContain('cursed rot');
      expect(markup).not.toContain('+7');
      expect(markup).toContain('unidentified');
    });

    it('shows one price format, the whole greeting, and no internal role label', () => {
      const greeting =
        'Stock up on torches and rations, traveler. The depths do not forgive the unprepared, and neither do I.';
      const shop = new ShopDialog();
      shop.open(npc('merchant', greeting), merchant(), engine);
      const markup = html();
      expect(markup).toContain(greeting);
      expect(markup).not.toMatch(/\(MERCHANT\)|merchant\)/i);
      expect(markup).toContain('General Store');
      expect(markup).toMatch(/\d CP</);
      expect(markup).not.toMatch(/\b(SP|GP|PP)\b/);
      expect(markup).not.toContain('CP total');
    });
  });

  it('renders a disabled offer as a disabled button', () => {
    const markup = servicePanelHtml(servicePanelFor(engine, npc('sage'))!);
    expect(markup).toMatch(/data-act="identify" disabled/);
    expect(markup).toMatch(/data-act="advise">/);
  });

  it("shows a townsperson's advice from the pack, and nothing but the greeting without it", () => {
    const guard = npc('guard');
    expect(servicePanelFor(engine, guard)).toBeNull();
    (engine.manifest as { town: unknown }).town = {
      name: 'Testford',
      npcs: [{ id: guard.id, name: guard.name, role: 'guard', position: { x: 0, y: 0 }, greeting: 'Hail.', advice: 'Mind the well.' }],
    };
    expect(servicePanelHtml(servicePanelFor(engine, guard)!)).toContain('Mind the well.');
  });
});
