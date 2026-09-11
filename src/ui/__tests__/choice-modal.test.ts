import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChoiceModal } from '../choiceModal';
import { GameEngine } from '../../engine/engine';
import { Player } from '../../engine/entities/player';
import { GameMap } from '../../engine/grid/map';
import { TILES } from '../../engine/grid/tile';
import type { ChoiceDefinition } from '../../engine/types/choice';

class MockElement {
  public id: string = '';
  public style: Record<string, string> = {};
  public innerHTML: string = '';
  public eventListeners: Map<string, Set<(e?: any) => void>> = new Map();

  addEventListener(type: string, listener: (e?: any) => void) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (e?: any) => void) {
    this.eventListeners.get(type)?.delete(listener);
  }

  click() {
    const listeners = this.eventListeners.get('click');
    if (listeners) {
      for (const listener of Array.from(listeners)) {
        listener();
      }
    }
  }
}

class MockDocument {
  public elements: Map<string, MockElement> = new Map();
  public body = {
    appendChild: (el: MockElement) => {
      if (el.id) this.elements.set(el.id, el);
    },
  };

  getElementById(id: string): MockElement | null {
    if (this.elements.has(id)) {
      return this.elements.get(id)!;
    }
    for (const el of this.elements.values()) {
      if (el.innerHTML.includes(`id="${id}"`)) {
        const child = new MockElement();
        child.id = id;
        this.elements.set(id, child);
        return child;
      }
    }
    return null;
  }

  createElement(_tag: string): MockElement {
    return new MockElement();
  }
}

describe('ChoiceModal UI Component', () => {
  let mockDoc: MockDocument;
  let originalDocument: any;
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    mockDoc = new MockDocument();
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = mockDoc;

    const map = new GameMap(10, 10, TILES.FLOOR);
    player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player, floor: 3 });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('renders modal with title, narrative text, and options', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'altar_tyr',
      title: 'Ancient Altar of Tyr',
      description: 'You stand before a sacred runic altar.',
      options: [
        {
          id: 'purify',
          label: 'Purify with Holy Waters',
          consequences: [],
        },
        {
          id: 'desecrate',
          label: 'Desecrate for Dark Power',
          consequences: [],
        },
      ],
    };

    const onSelect = vi.fn();
    const onCancel = vi.fn();

    modal.open(choice, engine, onSelect, onCancel);

    expect(modal.isOpen).toBe(true);
    const overlay = mockDoc.getElementById('choice-modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.style.display).toBe('flex');
    expect(overlay?.innerHTML).toContain('Ancient Altar of Tyr');
    expect(overlay?.innerHTML).toContain('Purify with Holy Waters');
    expect(overlay?.innerHTML).toContain('Desecrate for Dark Power');

    // Click option 1
    const optRow = mockDoc.getElementById('choice-opt-purify');
    expect(optRow).not.toBeNull();
    optRow?.click();

    expect(onSelect).toHaveBeenCalledWith('purify');
    expect(modal.isOpen).toBe(false);
  });

  it('renders disabled options with reason when predicate fails', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'locked_choice',
      title: 'Locked Vault Choice',
      description: 'Choose to open.',
      options: [
        {
          id: 'unlocked_opt',
          label: 'Normal Choice',
          consequences: [],
        },
        {
          id: 'locked_opt',
          label: 'Secret Option',
          disabledReason: 'Requires 10 Temple Standing',
          predicate: { type: 'minFaction', faction: 'temple_standing', value: 10 },
          consequences: [],
        },
      ],
    };

    modal.open(choice, engine, vi.fn(), vi.fn());

    const overlay = mockDoc.getElementById('choice-modal-overlay');
    expect(overlay?.innerHTML).toContain('Requires 10 Temple Standing');
    expect(overlay?.innerHTML).toContain('text-decoration: line-through');
  });

  it('handles cancellation via close button', () => {
    const modal = new ChoiceModal();

    const choice: ChoiceDefinition = {
      id: 'test_choice',
      title: 'Test',
      description: 'Desc',
      options: [{ id: 'opt1', label: 'Opt 1', consequences: [] }],
      cancelable: true,
    };

    const onSelect = vi.fn();
    const onCancel = vi.fn();

    modal.open(choice, engine, onSelect, onCancel);

    const cancelBtn = mockDoc.getElementById('btn-choice-cancel');
    expect(cancelBtn).not.toBeNull();
    cancelBtn?.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(modal.isOpen).toBe(false);
  });
});
