import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlsPrimer, type ControlsPrimerOptions } from '../controlsPrimer';

/** Just enough of the DOM for the primer's scrim: it renders into `innerHTML`. */
interface FakeElement {
  id: string;
  className: string;
  innerHTML: string;
  style: Record<string, string>;
  querySelector: () => null;
  appendChild: () => void;
}

function fakeElement(): FakeElement {
  return { id: '', className: '', innerHTML: '', style: {}, querySelector: () => null, appendChild: () => {} };
}

describe('the controls primer names the hero’s magic', () => {
  let created: FakeElement[];

  beforeEach(() => {
    created = [];
    const body = fakeElement();
    vi.stubGlobal('document', {
      body,
      getElementById: () => null,
      createElement: () => {
        const el = fakeElement();
        created.push(el);
        return el;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function render(overrides: Partial<ControlsPrimerOptions> = {}): string {
    const primer = new ControlsPrimer({
      keyFor: () => undefined,
      spellNames: () => [],
      manaName: () => 'Mana',
      onOpenControls: () => {},
      onHideForGood: () => {},
      onClose: () => {},
      ...overrides,
    });
    primer.open();
    return created[0].innerHTML;
  }

  it('names the known spells, the spell resource and the Spellbook key, as rebound', () => {
    const html = render({
      spellNames: () => ['Bolt of Stub', 'Mend'],
      manaName: () => 'Aether',
      keyFor: (action) => (action === 'cast_spell' ? 'Q' : undefined),
    });
    expect(html).toContain('Bolt of Stub and Mend');
    expect(html).toContain('Aether');
    expect(html).toContain('<span class="ui-key">Q</span> opens the Spellbook');
  });

  it('reads the getters when it opens, not when it is built', () => {
    let spells: string[] = [];
    const primer = new ControlsPrimer({
      keyFor: () => undefined,
      spellNames: () => spells,
      manaName: () => 'Aether',
      onOpenControls: () => {},
      onHideForGood: () => {},
      onClose: () => {},
    });
    spells = ['Late Spell'];
    primer.open();
    expect(created[0].innerHTML).toContain('Late Spell');
  });

  it('keeps the potion keys', () => {
    const html = render({ keyFor: (action) => (action === 'drink_potion_1' ? 'P1' : action === 'drink_potion_4' ? 'P4' : undefined) });
    expect(html).toContain('P1');
    expect(html).toContain('P4');
    expect(html).toContain('drink the potions');
  });
});
