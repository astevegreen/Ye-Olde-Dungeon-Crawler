import { describe, it, expect } from 'vitest';
import { GameEngine, GameMap, TILES, Player, type GrimoireState } from '../../engine';
import { SpellbookTab, type SpellbookTabOptions } from '../characterMenu/spellbookTab';
import { fixtureManifest, FIXTURE_GRIMOIRES } from '../../../tests/fixtures/fixture-pack';

// The Spellbook under the three-grimoire model: one grimoire at a time, a switcher over the
// ones that have opened, the stat of each axis, and a link where a slot lends its neighbour.

type Handlers = Record<string, Array<() => void>>;
interface FakeEl {
  attrs: Record<string, string>;
  handlers: Handlers;
  getAttribute(name: string): string | null;
  addEventListener(type: string, fn: () => void): void;
}

/** A container that finds `[data-x]` elements in its own markup and records their listeners. */
function fakeContainer(): { el: HTMLElement; find: (attr: string, value?: string) => FakeEl[] } {
  const holder = { innerHTML: '' };
  const cache = new Map<string, FakeEl[]>();
  let lastHtml = '';
  const collect = (attr: string): FakeEl[] => {
    if (lastHtml !== holder.innerHTML) {
      cache.clear();
      lastHtml = holder.innerHTML;
    }
    const hit = cache.get(attr);
    if (hit) return hit;
    const found: FakeEl[] = [];
    const tag = new RegExp(`<(?:button|span|i)[^>]*\\b${attr}="[^"]*"[^>]*>`, 'g');
    for (const m of holder.innerHTML.matchAll(tag)) {
      const attrs: Record<string, string> = {};
      for (const a of m[0].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      found.push({
        attrs,
        handlers: {},
        getAttribute: (n) => attrs[n] ?? null,
        addEventListener(type, fn) {
          (this.handlers[type] ??= []).push(fn);
        },
      });
    }
    cache.set(attr, found);
    return found;
  };
  const el = {
    get innerHTML() {
      return holder.innerHTML;
    },
    set innerHTML(v: string) {
      holder.innerHTML = v;
    },
    querySelectorAll: (sel: string) => {
      const m = sel.match(/^\[([\w-]+)\]$/);
      return m ? collect(m[1]) : [];
    },
    querySelector: () => null,
  } as unknown as HTMLElement;
  return { el, find: (attr, value) => collect(attr).filter((e) => value === undefined || e.attrs[attr] === value) };
}

const KNOWN = ['forge_bolt', 'chain_lightning', 'healing_light'];

function setup(opts: Partial<SpellbookTabOptions> = {}, opened = ['row']) {
  const player = new Player({ position: { x: 2, y: 5 }, spellsKnown: KNOWN, grimoireSystem: FIXTURE_GRIMOIRES });
  const state = player.grimoireState as GrimoireState;
  state.opened = opened;
  state.statPicks = [];
  state.placements = [
    { grimoireId: 'row', x: -1, y: 0, spellId: 'forge_bolt' },
    { grimoireId: 'row', x: 0, y: 0, spellId: 'chain_lightning' },
    { grimoireId: 'row', x: 1, y: 0, spellId: 'healing_light' },
  ];
  const engine = new GameEngine({ map: new GameMap(16, 12, TILES.FLOOR), player, floor: 1, manifest: fixtureManifest });
  const tab = new SpellbookTab(opts);
  const box = fakeContainer();
  tab.mount(box.el);
  tab.onActivate({ engine, player } as any);
  return { tab, player, state, box };
}

describe('Spellbook under the three-grimoire model', () => {
  it('draws the open grimoire as a 3x3 with the cut cells absent, and the three slots in it', () => {
    const { box } = setup();
    const html = box.el.innerHTML;
    expect(box.find('data-gslot').map((e) => e.attrs['data-gslot'])).toEqual(['-1,0', '0,0', '1,0']);
    expect(html.match(/is-void/g)).toHaveLength(6);
    expect(html).toContain('Grimoires');
    expect(box.find('data-grimoire').map((e) => e.attrs['data-grimoire'])).toEqual(['row']);
  });

  it('lights the link where a neighbour lends, and says what is borrowed', () => {
    const { box } = setup();
    const lit = box.el.innerHTML.match(/<i class="sb-link is-h is-on" title="([^"]*)"/g) ?? [];
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.join(' ')).toContain('Burning');
    expect(box.el.innerHTML).toContain('sb-cell-lend');
  });

  it('asks for a stat on an axis that has none, the suggested one first and marked', () => {
    const { box } = setup();
    const picks = box.find('data-pick-stat');
    expect(picks[0].attrs['data-pick-stat']).toBe('power');
    expect(picks[0].attrs['data-pick-axis']).toBe('x');
    expect(box.el.innerHTML).toContain('Power ★');
  });

  it('stops asking once the axis has its stat, and names it', () => {
    const { box, state, tab } = setup();
    state.statPicks = [{ grimoireId: 'row', axis: 'x', statId: 'thrift' }];
    tab.render();
    expect(box.find('data-pick-stat')).toHaveLength(0);
    expect(box.el.innerHTML).toContain('Across: <b>Thrift</b>');
  });

  it('reports the pick, the slot and the forgetting through the options', () => {
    const calls: unknown[][] = [];
    const { box, tab } = setup({
      onPickGrimoireStat: (...a) => calls.push(['pick', ...a]),
      onPlaceGrimoireSpell: (...a) => calls.push(['place', ...a]),
      onForgetSpell: (...a) => calls.push(['forget', ...a]),
    });
    box.find('data-pick-stat', 'power')[0].handlers.click[0]();
    expect(calls).toContainEqual(['pick', 'row', 'x', 'power']);

    // The chosen spell is the first in the list; click the right-hand slot to move it there.
    box.find('data-gslot', '1,0')[0].handlers.click[0]();
    expect(calls).toContainEqual(['place', KNOWN[0], 'row', 1, 0]);

    // Forgetting asks again before it does anything.
    box.find('data-forget', 'ask')[0].handlers.click[0]();
    expect(calls.some((c) => c[0] === 'forget')).toBe(false);
    expect(box.el.innerHTML).toContain('for the rest of this run');
    box.find('data-forget', 'yes')[0].handlers.click[0]();
    expect(calls).toContainEqual(['forget', KNOWN[0]]);
    expect(tab.selectedSpell?.id).toBe(KNOWN[1]);
  });

  it('switches between opened grimoires and shows each one\'s own cells', () => {
    const { box, tab } = setup({}, ['row', 'star']);
    expect(box.find('data-grimoire').map((e) => e.attrs['data-grimoire'])).toEqual(['row', 'star']);
    box.find('data-grimoire', 'star')[0].handlers.click[0]();
    expect(box.find('data-gslot')).toHaveLength(5);
    expect(box.el.innerHTML).toContain('A second grimoire opens: a star of five.');
    expect(tab).toBeTruthy();
  });

  it('describes a slot: its stats, what it casts and what it borrows', () => {
    const { tab, state } = setup();
    state.statPicks = [{ grimoireId: 'row', axis: 'x', statId: 'power' }];
    tab.render();
    const info = (tab as any).grimoireSlotInfo as Record<string, string>;
    expect(info['1,0']).toContain('Power ×1');
    expect(info['0,0']).toContain('Borrows Burning');
    expect(info['-1,0']).toContain('Lends its neighbours Burning');
  });
});
