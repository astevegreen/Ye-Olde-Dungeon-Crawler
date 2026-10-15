import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpellOfferCard, type SpellOffer } from '../spellOfferCard';

// No DOM library: a scrim stub holding the markup and recording the listeners the card binds.
class FakeScrim {
  id = '';
  className = '';
  innerHTML = '';
  style: Record<string, string> = {};
  appendChild(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): never[] {
    return [];
  }
}

const offer: SpellOffer = {
  id: 'frost_nova',
  name: 'Frost Nova',
  description: 'A ring of cold.',
  canPlace: false,
  known: [
    { id: 'arrow', name: 'Magic Arrow' },
    { id: 'spark', name: 'Spark' },
  ],
};

describe('SpellOfferCard', () => {
  const scrim = new FakeScrim();
  beforeEach(() => {
    scrim.innerHTML = '';
    (globalThis as any).document = {
      getElementById: () => null,
      createElement: () => scrim,
      body: { appendChild: () => {} },
    };
  });
  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('with no free slot, offers each known spell to forget and a Not now, and no Learn it', () => {
    const card = new SpellOfferCard({ onLearn: () => {}, onForgetAndLearn: () => {}, onClose: () => {} });
    card.open(offer);
    expect(card.isOpen).toBe(true);
    expect(scrim.innerHTML).toContain('Learn Frost Nova?');
    expect(scrim.innerHTML).toContain('data-forget-pick="arrow"');
    expect(scrim.innerHTML).toContain('data-forget-pick="spark"');
    expect(scrim.innerHTML).toContain('Not now');
    expect(scrim.innerHTML).not.toContain('spell-offer-learn');
  });

  it('with a free slot, offers Learn it and no forgetting', () => {
    const card = new SpellOfferCard({ onLearn: () => {}, onForgetAndLearn: () => {}, onClose: () => {} });
    card.open({ ...offer, canPlace: true });
    expect(scrim.innerHTML).toContain('spell-offer-learn');
    expect(scrim.innerHTML).not.toContain('data-forget-pick');
  });

  it('Escape is Not now: it closes and reports it', () => {
    let closed = 0;
    const card = new SpellOfferCard({ onLearn: () => {}, onForgetAndLearn: () => {}, onClose: () => closed++ });
    card.open(offer);
    expect(card.handleKeyDown({ key: 'Escape', preventDefault: () => {} } as KeyboardEvent)).toBe(true);
    expect(card.isOpen).toBe(false);
    expect(closed).toBe(1);
  });
});
