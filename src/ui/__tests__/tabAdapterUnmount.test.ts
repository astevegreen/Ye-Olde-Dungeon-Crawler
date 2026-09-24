import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PactTabAdapter, CompendiumTabAdapter } from '../characterMenu/tabAdapters';
import type { PactModal } from '../pactModal';
import type { CompendiumModal } from '../help/compendiumModal';

class FakeEl {
  public style: Record<string, string> = {};
  public parentElement: FakeEl | null = null;
  public children: FakeEl[] = [];
  appendChild(child: FakeEl) {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
  }
  removeChild(child: FakeEl) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
  }
  querySelector() {
    return null;
  }
}

/** A wrapped modal whose close() hides its root, like PactModal/CompendiumModal. */
function fakeModal(root: FakeEl) {
  return {
    rootElement: root,
    open: () => {
      root.style.display = 'flex';
    },
    close: () => {
      root.style.display = 'none';
    },
    handleKeyDown: () => false,
  };
}

describe('embedded tab adapters leave their window hidden after unmount', () => {
  let app: FakeEl;
  let original: unknown;

  beforeEach(() => {
    app = new FakeEl();
    original = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = { getElementById: (id: string) => (id === 'app' ? app : null) };
  });
  afterEach(() => {
    (globalThis as { document?: unknown }).document = original;
  });

  it.each([
    ['Pacts', (m: unknown) => new PactTabAdapter(m as PactModal)],
    ['Bestiary', (m: unknown) => new CompendiumTabAdapter(m as CompendiumModal)],
  ])('%s: switching away hides the window instead of stranding it over the game', (_name, make) => {
    const root = new FakeEl();
    const tab = make(fakeModal(root));
    const content = new FakeEl();

    tab.mount(content as unknown as HTMLElement);
    expect(root.parentElement).toBe(content);
    tab.unmount();

    expect(root.parentElement).toBe(app);
    expect(root.style.display).toBe('none');
  });
});
