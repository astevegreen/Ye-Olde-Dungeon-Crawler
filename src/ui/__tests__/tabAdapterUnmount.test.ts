import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PactTabAdapter, CompendiumTabAdapter, SpellbookTabAdapter } from '../characterMenu/tabAdapters';
import type { PactModal } from '../pactModal';
import type { CompendiumModal } from '../help/compendiumModal';
import type { SpellbookModal } from '../spellbookModal';

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

/**
 * A wrapped modal that behaves like PactModal/CompendiumModal: `close()` does nothing when
 * already closed, and otherwise hides its root and then fires the callback given to `open()`.
 */
function fakeModal(root: FakeEl) {
  let isOpen = false;
  let onClose: (() => void) | undefined;
  return {
    rootElement: root,
    mount: (parent: FakeEl) => parent.appendChild(root),
    open: (_engine?: unknown, cb?: () => void) => {
      isOpen = true;
      onClose = cb;
      root.style.display = 'flex';
    },
    close: () => {
      if (!isOpen) return;
      isOpen = false;
      root.style.display = 'none';
      const cb = onClose;
      onClose = undefined;
      cb?.();
    },
    handleKeyDown: () => false,
  };
}

const ADAPTERS = [
  ['Pacts', (m: unknown, onDismiss?: () => void) => new PactTabAdapter(m as PactModal, onDismiss)],
  ['Bestiary', (m: unknown, onDismiss?: () => void) => new CompendiumTabAdapter(m as CompendiumModal, onDismiss)],
  ['Spellbook', (m: unknown, onDismiss?: () => void) => new SpellbookTabAdapter(m as SpellbookModal, onDismiss)],
] as const;

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

  it.each(ADAPTERS.slice(0, 2))('%s: switching away hides the window instead of stranding it over the game', (_name, make) => {
    const root = new FakeEl();
    const tab = make(fakeModal(root));
    const content = new FakeEl();

    tab.mount(content as unknown as HTMLElement);
    expect(root.parentElement).toBe(content);
    tab.unmount();

    expect(root.parentElement).toBe(app);
    expect(root.style.display).toBe('none');
  });

  it.each(ADAPTERS)('%s: closing from its own Done/Close button leaves no window stranded', (_name, make) => {
    const root = new FakeEl();
    const modal = fakeModal(root);
    const content = new FakeEl();
    // Stands in for CharacterMenuModal.close(): the shell unmounts the active tab.
    let tab: ReturnType<typeof make>;
    tab = make(modal, () => tab.unmount());

    tab.mount(content as unknown as HTMLElement);
    tab.onActivate({ engine: {} } as never);
    expect(root.style.display).toBe('flex');

    modal.close(); // the modal's own Done button

    expect(root.parentElement).toBe(app);
    expect(root.style.display).toBe('none');
  });
});
