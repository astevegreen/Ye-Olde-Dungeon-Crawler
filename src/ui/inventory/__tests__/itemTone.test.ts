import { describe, it, expect } from 'vitest';
import { itemTone, itemToneClass } from '../itemTone';
import { CoinItem, Item } from '../../../engine';

function makeItem(overrides: Partial<Item> = {}): Item {
  const item = new Item({ id: 'test-item', name: 'Test Blade', category: 'weapon', weight: 500, bulk: 300 });
  Object.assign(item, overrides);
  return item;
}

describe('itemTone', () => {
  it('names the role a DOM element colors by, and nothing for a plain or unknown item', () => {
    expect(itemToneClass(makeItem({ identified: true, quality: 'cursed' }))).toBe(' it-tone-cursed');
    expect(itemToneClass(makeItem({ identified: false, quality: 'cursed' }))).toBe('');
    expect(itemToneClass(makeItem({ identified: true }))).toBe('');
    expect(itemToneClass(null)).toBe('');
  });

  it('gives coin stacks their denomination', () => {
    expect(itemTone(new CoinItem({ id: 'c', denomination: 'silver', count: 3 }))).toBe('silver');
  });
});
