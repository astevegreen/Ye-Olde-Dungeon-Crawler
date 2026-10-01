import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { GameEngine, GameMap, Item, Merchant, NPC, Player, addCoinsToContainer, type NpcRole } from '../../engine';
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
      const offers = servicePanelFor(engine, who).offers.filter((o) => !o.disabled);
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
    const markup = servicePanelHtml(servicePanelFor(engine, npc('sage')));
    expect(markup).toMatch(/data-act="identify" disabled/);
    expect(markup).toMatch(/data-act="advise">/);
  });
});
