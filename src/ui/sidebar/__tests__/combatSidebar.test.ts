import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CombatSidebar } from '../combatSidebar';

/** Just enough of an element for the sidebar to build itself and hold its listeners. */
interface FakeElement {
  tagName: string;
  className: string;
  children: FakeElement[];
  listeners: Map<string, Array<() => void>>;
  setAttribute(): void;
  appendChild(child: FakeElement): FakeElement;
  append(...children: FakeElement[]): void;
  addEventListener(type: string, fn: () => void): void;
}

function fakeElement(tagName: string): FakeElement {
  const el: FakeElement = {
    tagName,
    className: '',
    children: [],
    listeners: new Map(),
    setAttribute: () => {},
    appendChild: (child) => {
      el.children.push(child);
      return child;
    },
    append: (...children) => {
      el.children.push(...children);
    },
    addEventListener: (type, fn) => {
      el.listeners.set(type, [...(el.listeners.get(type) ?? []), fn]);
    },
  };
  return el;
}

describe('CombatSidebar minimap after a GPU reset', () => {
  let created: FakeElement[];

  beforeEach(() => {
    created = [];
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        const el = fakeElement(tag);
        created.push(el);
        return el;
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws the minimap again, once, when the browser restores its canvas', () => {
    const drawMinimap = vi.fn();
    new CombatSidebar({ drawMinimap, drawEntityIcon: vi.fn(), drawItemIcon: vi.fn(), onPointAt: vi.fn(), onOpenMap: vi.fn() });
    const minimap = created.find((el) => el.tagName === 'canvas' && el.className === 'sb-minimap');
    const restored = minimap?.listeners.get('contextrestored') ?? [];
    expect(restored).toHaveLength(1);

    restored[0]();
    expect(drawMinimap).toHaveBeenCalledTimes(1);
    expect(drawMinimap).toHaveBeenCalledWith(minimap);
  });
});
