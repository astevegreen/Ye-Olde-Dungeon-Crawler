import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import {
  Container,
  GameEngine,
  GameMap,
  Item,
  Merchant,
  NPC,
  Player,
  addCoinsToContainer,
  formatCurrency,
  getItemSellPrice,
  type GameContentManifest,
  type NpcRole,
} from '../../engine';
import { COTW_PACTS } from '../../content/cotw/pacts';
import { cotwManifest } from '../../content/cotw';
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

const key = (k: string, repeat = false) => ({ key: k, code: k, repeat, preventDefault: () => {} }) as unknown as KeyboardEvent;

// The dialog ignores trading keys for a moment after it opens (R-ui-7). Each read of the
// clock moves it on a second, so the other tests' keys land well after that; the R-ui-7
// tests stop it and move it by hand.
let now = 0;
let tick = 1000;

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
    now = 0;
    tick = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += tick));
    engine = testEngine();
    dispatch = vi.spyOn(engine.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
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

  it("ignores a service's key held into the dialog, or pressed in its first moment (R-ui-7)", () => {
    tick = 0;
    const shop = new ShopDialog();
    shop.open(npc('priest'), null, engine);
    // Vi H (move west) held into the priest is his Heal.
    shop.handleKeyDown(key('h'), engine);
    now += 300;
    shop.handleKeyDown(key('h', true), engine);
    expect(dispatch).not.toHaveBeenCalled();
    shop.handleKeyDown(key('h'), engine);
    expect(commandTypes()).toEqual(['temple_heal']);
  });

  it("teaches the companion skills the pack lists, and offers none it doesn't (R-ui-18)", () => {
    expect(servicePanelFor(engine, npc('trainer'))!.offers.some((o) => o.act === 'teach')).toBe(false);
    const base = testEngine().manifest;
    const taught = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
      manifest: {
        ...base,
        town: { ...base.town, services: { trainerSkills: [{ id: 'test_song', name: 'Test Song', description: 'Sings the pack on.' }] } },
      } as GameContentManifest,
    });
    const sent = vi.spyOn(taught.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
    const shop = new ShopDialog();
    shop.open(npc('trainer'), null, taught);
    expect(html()).toContain('Teach Test Song');
    expect(html()).toContain('Sings the pack on.');
    shop.handleKeyDown(key('w'), taught);
    expect(sent.mock.calls.map((c) => c[0])).toEqual([
      { type: 'trainer_teach_skill', payload: { skillId: 'test_song', skillName: 'Test Song' } },
    ]);
  });

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

    it('ignores a trading key held into the shop: its repeats, and any press in the first moment (R-ui-7)', () => {
      const pack = engine.player.inventory.primaryPack;
      const marked = ware('junk-boot', 'Old Boot');
      marked.junk = true;
      pack.addItem(marked);
      tick = 0;
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      // The bump that opened the shop: the key's next press lands at once.
      for (const k of ['6', 'Enter', ' ', 'j', 'm']) expect(shop.handleKeyDown(key(k), engine)).toBe(true);
      now += 100;
      shop.handleKeyDown(key('2'), engine);
      expect(dispatch).not.toHaveBeenCalled();
      // Past the moment, a held key's repeats still do nothing; a fresh press trades.
      now += 200;
      for (const k of ['3', 'Enter', ' ', 'j', 'm']) shop.handleKeyDown(key(k, true), engine);
      expect(dispatch).not.toHaveBeenCalled();
      // Navigation is never held back.
      shop.handleKeyDown(key('ArrowDown', true), engine);
      expect(shop.selectedBuyIndex).toBe(1);
      shop.handleKeyDown(key('3'), engine);
      shop.handleKeyDown(key('j'), engine);
      expect(commandTypes()).toEqual(['buy_item', 'sell_junk']);
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

    it('counts in the junk bar only what Sell Junk sells: not a junk container filled since (R-econ-19)', () => {
      const pack = engine.player.inventory.primaryPack;
      const belt = new Container({
        id: 'belt', name: 'Spare Belt', category: 'container', slot: 'belt', containerType: 'belt',
        weight: 300, bulk: 300, maxWeightCapacity: 5000, maxBulkCapacity: 5000, identified: true, value: 30,
      });
      pack.addItem(belt);
      belt.junk = true;
      belt.addItem(ware('ring', 'Copper Ring'));
      const shop = new ShopDialog();
      shop.open(npc('merchant'), merchant(), engine);
      shop.handleKeyDown(key('s'), engine);
      // Only the filled belt is marked: no bar, but J still asks, and the merchant says why it stays.
      expect(html()).not.toContain('data-act="sell-junk"');
      shop.handleKeyDown(key('j'), engine);
      expect(commandTypes()).toEqual(['sell_junk']);

      const boot = ware('junk-boot', 'Old Boot');
      boot.junk = true;
      pack.addItem(boot);
      shop.handleKeyDown(key('s'), engine);
      expect(html()).toContain(`Sell all junk (1) for ${formatCurrency(getItemSellPrice(boot))}`);
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

  describe('the temple (2.6)', () => {
    const cotwEngine = () => {
      const e = new GameEngine({ map: new GameMap(20, 20), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }), floor: 0, manifest: cotwManifest });
      dispatch = vi.spyOn(e.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
      return e;
    };
    const cursedRing = (id: string) => {
      const ring = new Item({ id, name: 'Iron Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
      ring.addModifier({ id: `${id}-m`, name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true });
      return ring;
    };
    const payloads = () => dispatch.mock.calls.map((c) => c[0] as { type: string; payload?: Record<string, unknown> });

    it('offers the chosen cursed item with O, and shows the piety the blessings need', () => {
      const e = cotwEngine();
      e.player.inventory.primaryPack.addItem(cursedRing('a'));
      const second = cursedRing('b');
      e.player.inventory.primaryPack.addItem(second);
      const shop = new ShopDialog();
      shop.open(npc('priest'), null, e);
      expect(html()).toContain('Piety');
      expect(html()).toContain("Eir's Mercy");
      shop.handleKeyDown(key('ArrowDown'), e);
      shop.handleKeyDown(key('o'), e);
      expect(payloads()).toEqual([{ type: 'temple_offer', payload: { item: second } }]);
    });

    it('receives the next blessing with R, on the chosen gear for a hallowing', () => {
      const e = cotwEngine();
      dispatch.mockRestore();
      for (let i = 0; i < 12; i++) {
        const ring = cursedRing(`o${i}`);
        e.player.inventory.primaryPack.addItem(ring);
        e.commandBus.dispatch({ type: 'temple_offer', payload: { item: ring } });
      }
      dispatch = vi.spyOn(e.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
      const shop = new ShopDialog();
      shop.open(npc('priest'), null, e);
      shop.handleKeyDown(key('r'), e);
      expect(payloads()[0]).toEqual({ type: 'temple_bless', payload: { blessingId: 'eirs_mercy', item: undefined } });
      // With Eir's Mercy granted, Thor's Hallowing is next: R takes the chosen plain gear.
      dispatch.mockRestore();
      e.commandBus.dispatch({ type: 'temple_bless', payload: { blessingId: 'eirs_mercy' } });
      const sword = new Item({ id: 'sword', name: 'Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500, identified: true });
      e.player.inventory.primaryPack.addItem(sword);
      dispatch = vi.spyOn(e.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
      shop.close();
      shop.open(npc('priest'), null, e);
      expect(html()).toContain('to hallow');
      shop.handleKeyDown(key('r'), e);
      expect(payloads()).toEqual([{ type: 'temple_bless', payload: { blessingId: 'thors_hallowing', item: sword } }]);
    });
  });

  describe("Gunther's forge (2.7)", () => {
    const gunther = new NPC({ id: 'npc-gunther', name: 'Gunther', position: { x: 6, y: 5 }, role: 'merchant', dialogText: 'Steel?' });
    const armory = () => new Merchant('merchant-gunther', 'Gunther', "Gunther's Armory", 'armory', 'Steel?', [ware('nail', 'Nail')]);
    const blade = (id: string, extra: Partial<ConstructorParameters<typeof Item>[0]> = {}) =>
      new Item({ id, name: 'Broadsword', category: 'weapon', slot: 'mainHand', weight: 2000, bulk: 900, identified: true, stats: { attackBonus: 4 }, ...extra });
    const forgeEngine = () => {
      const e = new GameEngine({ map: new GameMap(20, 20), player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }), floor: 0, manifest: cotwManifest });
      dispatch = vi.spyOn(e.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
      return e;
    };
    const sent = () => dispatch.mock.calls.map((c) => c[0] as { type: string; payload?: Record<string, unknown> });

    it('opens the Forge with F, cycles three lists with Tab, and raises the chosen piece with Enter', () => {
      const e = forgeEngine();
      const first = blade('a');
      const second = blade('b', { enchantmentLevel: 2, stats: { attackBonus: 8 } });
      e.player.inventory.primaryPack.addItem(first);
      e.player.inventory.primaryPack.addItem(second);
      const shop = new ShopDialog();
      shop.open(gunther, armory(), e);
      expect(html()).toContain('data-act="tab-forge"');
      shop.handleKeyDown(key('Tab'), e);
      shop.handleKeyDown(key('Tab'), e);
      expect(shop.activeTab).toBe('forge');
      shop.handleKeyDown(key('b'), e);
      shop.handleKeyDown(key('f'), e);
      expect(shop.activeTab).toBe('forge');
      // A +2 sword's next step is the 2,000 CP one.
      expect(html()).toContain('+2 → +3');
      shop.handleKeyDown(key('ArrowDown'), e);
      shop.handleKeyDown(key('Enter'), e);
      expect(sent()).toEqual([{ type: 'smith_upgrade', payload: { npcId: 'npc-gunther', item: second } }]);
    });

    it("offers Ivalda's masterwork with M once she works in town, even on a +3", () => {
      const e = forgeEngine();
      const top = blade('top', { enchantmentLevel: 3, stats: { attackBonus: 10 } });
      e.player.inventory.primaryPack.addItem(top);
      const shop = new ShopDialog();
      shop.open(gunther, armory(), e);
      shop.handleKeyDown(key('f'), e);
      expect(shop.getForgeItems(e)).toEqual([]);
      shop.handleKeyDown(key('m'), e);
      expect(sent()).toEqual([]);
      e.worldState.factions.iron_clans = 0;
      e.setWorldFlag('ivalda_in_town', true);
      shop.close();
      shop.open(gunther, armory(), e);
      shop.handleKeyDown(key('f'), e);
      expect(shop.getForgeItems(e)).toEqual([top]);
      expect(html()).toContain('data-act="masterwork"');
      shop.handleKeyDown(key('m'), e);
      expect(sent()).toEqual([{ type: 'smith_masterwork', payload: { npcId: 'npc-gunther', item: top } }]);
    });

    it('gives a merchant without a forge no Forge list', () => {
      const e = forgeEngine();
      const shop = new ShopDialog();
      shop.open(npc('merchant'), armory(), e);
      expect(html()).not.toContain('data-act="tab-forge"');
      shop.handleKeyDown(key('f'), e);
      expect(shop.activeTab).toBe('buy');
    });
  });

  it('keeps Study and Rumors as the sage\'s second and third lists, picked with ← →, each acting on the chosen row (tracker 4.1)', () => {
    const e = new GameEngine({
      map: new GameMap(20, 20),
      player: new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } }),
      floor: 0,
      manifest: cotwManifest,
    });
    const sent = vi.spyOn(e.commandBus, 'dispatch').mockReturnValue({ success: true, message: 'Done.' });
    const known = e.registries.monsters.getAll().filter((m) => (m.minFloor ?? 1) >= 1).slice(0, 2);
    for (const m of known) e.compendium.recordEncounter(m.id, m.name, 1);

    const shop = new ShopDialog();
    shop.open(npc('sage'), null, e);
    expect(html()).toContain('data-arg="study"');
    expect(html()).toContain('data-act="identify"');

    shop.handleKeyDown(key('ArrowRight'), e);
    expect(shop.sageView).toBe('study');
    expect(html()).toContain(known[0].name);
    expect(html().match(/data-choice=/g)).toHaveLength(2);
    shop.handleKeyDown(key('ArrowDown'), e);
    shop.handleKeyDown(key('s'), e);

    shop.handleKeyDown(key('ArrowRight'), e);
    expect(shop.sageView).toBe('rumors');
    expect(html()).toContain('A creature of floor');
    // A rumor's row never names what it reveals.
    const unmet = e.registries.monsters.getAll().filter((m) => e.compendium.getTier(m.id) === 0 && (m.minFloor ?? 1) >= 1);
    expect(unmet.some((m) => html().includes(`>${m.name}<`))).toBe(false);
    shop.handleKeyDown(key('r'), e);

    const calls = sent.mock.calls.map((c) => c[0] as { type: string; payload?: { definitionId?: string } });
    const studied = [...known].sort((a, b) => (a.minFloor ?? 1) - (b.minFloor ?? 1) || a.name.localeCompare(b.name))[1];
    expect(calls[0]).toEqual({ type: 'sage_study', payload: { definitionId: studied.id } });
    expect(calls[1].type).toBe('sage_rumor');

    shop.handleKeyDown(key('ArrowRight'), e);
    expect(shop.sageView).toBe('items');
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
